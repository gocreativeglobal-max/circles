import { NextRequest, NextResponse } from 'next/server';
import { getPaymentProcessor } from '@/lib/payments/adapter';
import { withServiceRoleTransaction } from '@/lib/db/postgres';
import { fulfillInvoiceEntitlements } from '@/features/finances/service';
import { dispatchFinancialWebhookEvent } from '@/features/finances/integrations';
import {
  recordPlatformRevenue,
  getCircleTierInfo,
  calculatePlatformFee,
} from '@/features/finances/platform-fees';
import { InvoiceItem } from '@/types/domain';
import { logger } from '@/lib/logging';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get('x-bachs-signature') ||
      req.headers.get('x-payment-signature') ||
      req.headers.get('stripe-signature') ||
      req.headers.get('x-signature') ||
      '';
    const timestamp =
      req.headers.get('x-bachs-timestamp') ||
      req.headers.get('x-timestamp') ||
      '';

    const isProduction = process.env.NODE_ENV === 'production';
    const configuredSecret = process.env.BACHS_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

    if (!configuredSecret && isProduction) {
      logger.error('Payment webhook rejected: BACHS_WEBHOOK_SECRET is not configured in production environment.');
      return NextResponse.json(
        { error: 'Webhook configuration error in production environment' },
        { status: 500 }
      );
    }

    const secret = configuredSecret || 'whsec_local_dev';
    const processor = getPaymentProcessor();

    const verification = await processor.verifyWebhookSignature(rawBody, signature, secret, timestamp);

    if (!verification.isValid) {
      logger.warn('Bachs payment webhook signature verification failed', {
        provider: processor.name,
      });
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    const { eventType, invoiceId, paymentReference } = verification;

    if (
      eventType === 'collection.succeeded' ||
      eventType === 'checkout.completed' ||
      eventType === 'checkout.session.completed' ||
      eventType === 'invoice.payment_succeeded' ||
      eventType === 'payment_intent.succeeded'
    ) {
      if (!invoiceId) {
        return NextResponse.json({ received: true, note: 'No invoice attached' });
      }

      await withServiceRoleTransaction(async (tx) => {
        const invRes = await tx.query<InvoiceItem>(
          `SELECT * FROM public.invoices WHERE id = $1 LIMIT 1;`,
          [invoiceId]
        );
        const invoice = invRes.rows[0];
        if (!invoice || invoice.status === 'paid') {
          return;
        }

        // Security check: Validate against underpayment price-tampering
        if (
          verification.amountCents !== undefined &&
          verification.amountCents < invoice.total_cents
        ) {
          logger.warn('Bachs payment rejected due to underpayment mismatch', {
            invoiceId,
            expectedCents: invoice.total_cents,
            receivedCents: verification.amountCents,
          });
          return;
        }

        // Security check: Validate currency match
        if (
          verification.currency &&
          verification.currency.toUpperCase() !== invoice.currency.toUpperCase()
        ) {
          logger.warn('Bachs payment rejected due to currency mismatch', {
            invoiceId,
            expectedCurrency: invoice.currency,
            receivedCurrency: verification.currency,
          });
          return;
        }

        // Update invoice to paid via Bachs
        const updatedInvRes = await tx.query<InvoiceItem>(
          `UPDATE public.invoices
           SET status = 'paid',
               payment_method = 'bachs',
               payment_reference = $1,
               paid_at = NOW(),
               updated_at = NOW()
           WHERE id = $2
           RETURNING *;`,
          [paymentReference || `BACHS_${Date.now()}`, invoiceId]
        );
        const paidInvoice = updatedInvRes.rows[0];

        // Automatically fulfill and activate plan entitlements
        const granted = await fulfillInvoiceEntitlements(tx, paidInvoice);

        // Record platform revenue and creator net revenue in community treasury ledger
        if (paidInvoice.total_cents > 0) {
          const tierInfo = await getCircleTierInfo(tx, paidInvoice.circle_id);
          const feeCalc = calculatePlatformFee(
            tierInfo.planTier,
            paidInvoice.total_cents,
            tierInfo.customPlatformFeePercentage
          );

          // Record Circles platform revenue cut
          await recordPlatformRevenue(tx, {
            circleId: paidInvoice.circle_id,
            invoiceId: paidInvoice.id,
            planTier: feeCalc.planTier,
            grossAmountCents: paidInvoice.total_cents,
            platformFeePercentage: feeCalc.feePercentage,
            platformFeeCents: feeCalc.feeCents,
            creatorNetCents: feeCalc.creatorNetCents,
            currency: paidInvoice.currency,
            paymentReference,
          });

          // Record net creator revenue in community treasury ledger
          await tx.query(
            `INSERT INTO public.community_treasury_ledger (
               id, circle_id, entry_type, category, amount_cents, currency,
               description, is_public_to_members, invoice_id, recorded_by, entry_date
             ) VALUES ($1, $2, 'revenue', 'dues', $3, $4, $5, true, $6, $7, NOW());`,
            [
              crypto.randomUUID(),
              paidInvoice.circle_id,
              feeCalc.creatorNetCents,
              paidInvoice.currency,
              `Bachs payment for ${paidInvoice.title} (Net payout after ${feeCalc.feePercentage}% platform fee; Ref: ${paymentReference})`,
              paidInvoice.id,
              paidInvoice.user_id,
            ]
          );
        }

        // Dispatch outbound webhook event to external systems
        dispatchFinancialWebhookEvent(paidInvoice.circle_id, 'invoice.paid', {
          invoice: paidInvoice,
          entitlementsCount: granted.length,
          paymentReference,
        }).catch((e) => logger.error('Outbound webhook dispatch error', { error: e }));
      });
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    logger.error('Error handling Bachs payment webhook', { error: err });
    return NextResponse.json({ error: 'Internal webhook error' }, { status: 500 });
  }
}
