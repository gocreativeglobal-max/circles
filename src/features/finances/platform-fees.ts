import crypto from 'crypto';
import { DbTransaction, withRlsTransaction, withServiceRoleTransaction } from '@/lib/db/postgres';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { getPaymentProcessor, ensureAbsoluteHttpUrl } from '@/lib/payments/adapter';
import { convertUsdToCurrency, formatCurrencyAmount } from '@/lib/payments/currencies';
import {
  PlatformPlanTier,
  PlatformTierDefinition,
  GatedTierFeature,
  PLATFORM_TIERS,
  FeeCalculationResult,
  calculatePlatformFee,
  isTierFeatureAllowed,
  formatBytes,
} from './platform-fee-constants';

export {
  type PlatformPlanTier,
  type PlatformTierDefinition,
  type GatedTierFeature,
  PLATFORM_TIERS,
  type FeeCalculationResult,
  calculatePlatformFee,
  isTierFeatureAllowed,
  formatBytes,
};

/**
 * Asserts that a Circle has access to a specific premium tier feature.
 * Throws a clear ForbiddenError directing the user to upgrade if not permitted.
 */
export function assertCircleTierEntitlement(
  tier: PlatformPlanTier,
  feature: GatedTierFeature
): void {
  if (isTierFeatureAllowed(tier, feature)) {
    return;
  }

  const upgradeTarget =
    feature === 'direct_erp_sync'
      ? 'Platinum ($250/mo)'
      : feature === 'ad_free_experience'
      ? 'Starter ($15/mo)'
      : 'Pro ($50/mo)';

  const featureNames: Record<GatedTierFeature, string> = {
    ad_free_experience: 'Ad-Free Community Experience',
    custom_domain: 'Custom Domain Mapping',
    white_label_emails: 'White-Label Branding & Email Sender',
    direct_erp_sync: 'Direct Accounting ERP & Webhook Sync',
    priority_support: 'Priority Support',
  };

  throw new ForbiddenError(
    `"${featureNames[feature]}" is not included in your circle's ${PLATFORM_TIERS[tier].name} plan. Please upgrade to ${upgradeTarget} in Circle Studio to unlock.`
  );
}

export interface CircleStorageUsage {
  usedBytes: number;
  quotaBytes: number;
  quotaFormatted: string;
  usedFormatted: string;
  usedPercentage: number;
  maxFileUploadBytes: number;
  maxFileUploadFormatted: string;
  isOverQuota: boolean;
}

/**
 * Calculates current active storage consumption and limits for a Circle.
 */
export async function getCircleStorageUsage(
  tx: DbTransaction,
  circleId: string
): Promise<CircleStorageUsage> {
  const tierInfo = await getCircleTierInfo(tx, circleId);
  const tierDef = PLATFORM_TIERS[tierInfo.planTier] || PLATFORM_TIERS.free;

  const res = await tx.query<{ total_bytes: string }>(
    `SELECT COALESCE(SUM(size_bytes), 0) AS total_bytes
     FROM public.media_uploads
     WHERE circle_id = $1 AND status = 'active';`,
    [circleId]
  );

  const usedBytes = parseInt(res.rows[0]?.total_bytes || '0', 10);
  const quotaBytes = tierDef.storageBytes;
  const usedPercentage =
    quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 1000) / 10) : 0;

  return {
    usedBytes,
    quotaBytes,
    quotaFormatted: tierDef.storageFormatted,
    usedFormatted: formatBytes(usedBytes),
    usedPercentage,
    maxFileUploadBytes: tierDef.maxFileUploadBytes,
    maxFileUploadFormatted: tierDef.maxFileUploadFormatted,
    isOverQuota: usedBytes >= quotaBytes,
  };
}

/**
 * Queries the circle's tier from the database.
 */
export async function getCircleTierInfo(
  tx: DbTransaction,
  circleId: string
): Promise<{
  planTier: PlatformPlanTier;
  customPlatformFeePercentage: number | null;
  subscriptionStatus: string;
}> {
  const res = await tx.query<{
    plan_tier: PlatformPlanTier;
    custom_platform_fee_percentage: string | null;
    plan_subscription_status: string;
  }>(
    `SELECT plan_tier, custom_platform_fee_percentage, plan_subscription_status
     FROM public.circles
     WHERE id = $1
     LIMIT 1;`,
    [circleId]
  );

  const row = res.rows[0];
  if (!row) {
    return {
      planTier: 'free',
      customPlatformFeePercentage: null,
      subscriptionStatus: 'active',
    };
  }

  return {
    planTier: row.plan_tier || 'free',
    customPlatformFeePercentage: row.custom_platform_fee_percentage
      ? parseFloat(row.custom_platform_fee_percentage)
      : null,
    subscriptionStatus: row.plan_subscription_status || 'active',
  };
}

/**
 * Records a platform fee deduction into the platform revenue ledger.
 */
export async function recordPlatformRevenue(
  tx: DbTransaction,
  params: {
    circleId: string;
    invoiceId: string;
    planTier: PlatformPlanTier;
    grossAmountCents: number;
    platformFeePercentage: number;
    platformFeeCents: number;
    creatorNetCents: number;
    currency: string;
    paymentReference?: string | null;
  }
): Promise<void> {
  await tx.query(
    `INSERT INTO public.platform_revenue_ledger (
       circle_id, invoice_id, plan_tier, gross_amount_cents,
       platform_fee_percentage, platform_fee_cents, creator_net_cents,
       currency, payment_reference, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW());`,
    [
      params.circleId,
      params.invoiceId,
      params.planTier,
      params.grossAmountCents,
      params.platformFeePercentage,
      params.platformFeeCents,
      params.creatorNetCents,
      params.currency,
      params.paymentReference || null,
    ]
  );
}

/**
 * Updates a circle's platform plan tier (Free, Starter, Pro, Platinum, Enterprise).
 * Only circle administrators or platform admins can execute this.
 * Upgrading to paid tiers requires payment verification unless executed by a platform admin.
 */
export async function updateCircleTier(
  actorUserId: string,
  circleId: string,
  tier: PlatformPlanTier,
  customFeePercentage?: number | null,
  paymentReference?: string | null
): Promise<{
  planTier: PlatformPlanTier;
  customPlatformFeePercentage: number | null;
  subscriptionStatus: string;
}> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const isStaff = await tx.query<{ allowed: boolean }>(
      `SELECT public.has_circle_staff_role($1, $2, 'admin') AS allowed;`,
      [circleId, actorUserId]
    );
    if (!isStaff.rows[0]?.allowed) {
      throw new ForbiddenError('Only circle administrators can manage the platform plan tier.');
    }

    // Upgrading to paid tiers requires payment verification or platform admin rights
    if (tier !== 'free') {
      const isPlatAdmin = await tx.query<{ is_admin: boolean }>(
        `SELECT public.is_platform_admin($1) AS is_admin;`,
        [actorUserId]
      );
      if (!isPlatAdmin.rows[0]?.is_admin && !paymentReference) {
        const tierDef = PLATFORM_TIERS[tier];
        throw new ForbiddenError(
          `Upgrading to ${tierDef?.name || tier} requires payment ($${tierDef?.monthlyPriceUsd || 0}/month). Please complete the checkout process.`
        );
      }
    }

    const res = await tx.query<{
      plan_tier: PlatformPlanTier;
      custom_platform_fee_percentage: string | null;
      plan_subscription_status: string;
    }>(
      `UPDATE public.circles
       SET plan_tier = $1,
           custom_platform_fee_percentage = $2,
           plan_subscription_status = CASE WHEN $1 = 'free' THEN 'active' ELSE 'active' END,
           plan_current_period_end = CASE WHEN $1 = 'free' THEN NULL ELSE NOW() + INTERVAL '30 days' END,
           updated_at = NOW()
       WHERE id = $3
       RETURNING plan_tier, custom_platform_fee_percentage, plan_subscription_status;`,
      [tier, customFeePercentage ?? null, circleId]
    );

    const row = res.rows[0];
    return {
      planTier: row.plan_tier,
      customPlatformFeePercentage: row.custom_platform_fee_percentage
        ? parseFloat(row.custom_platform_fee_percentage)
        : null,
      subscriptionStatus: row.plan_subscription_status,
    };
  });
}

/**
 * Creates a Bachs checkout session for upgrading the Circle's platform plan tier.
 * Supports universal multi-currency payment across all Bachs supported currencies.
 */
export async function createPlatformTierCheckoutSession(
  actorUserId: string,
  circleId: string,
  targetTier: PlatformPlanTier,
  selectedCurrency: string = 'USD',
  clientOrigin?: string
): Promise<{
  sessionId: string;
  checkoutUrl: string;
  invoiceId: string;
  targetTier: PlatformPlanTier;
  amountCents: number;
  currency: string;
  isSimulated: boolean;
}> {
  return withServiceRoleTransaction(async (tx) => {
    // 1. Resolve circle ID (handles both UUID and slug)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(circleId);
    const circleRes = await tx.query<{ id: string; name: string; slug: string }>(
      `SELECT id, name, slug FROM public.circles WHERE ${isUuid ? 'id = $1::uuid' : 'slug = $1'} LIMIT 1;`,
      [circleId]
    );
    const circle = circleRes.rows[0];
    if (!circle) throw new NotFoundError('Circle not found.');
    const resolvedCircleId = circle.id;

    // 2. Verify user is circle admin or owner
    const isStaff = await tx.query<{ allowed: boolean }>(
      `SELECT public.has_circle_staff_role($1::uuid, $2::uuid, 'admin') AS allowed;`,
      [resolvedCircleId, actorUserId]
    );
    if (!isStaff.rows[0]?.allowed) {
      throw new ForbiddenError('Only circle administrators can upgrade the platform plan.');
    }

    const tierDef = PLATFORM_TIERS[targetTier];
    if (!tierDef || targetTier === 'free' || tierDef.monthlyPriceUsd <= 0) {
      throw new ValidationError(`Cannot checkout for tier "${targetTier}". Paid tiers only.`);
    }

    // 3. Fetch profile with fallback to auth.users if needed
    const profileRes = await tx.query<{ id: string; email: string; display_name: string }>(
      `SELECT id, email, display_name FROM public.profiles WHERE id = $1::uuid LIMIT 1;`,
      [actorUserId]
    );
    let profile = profileRes.rows[0];
    if (!profile) {
      const authUserRes = await tx.query<{ id: string; email: string }>(
        `SELECT id, email FROM auth.users WHERE id = $1::uuid LIMIT 1;`,
        [actorUserId]
      );
      if (authUserRes.rows[0]) {
        profile = {
          id: authUserRes.rows[0].id,
          email: authUserRes.rows[0].email,
          display_name: authUserRes.rows[0].email.split('@')[0],
        };
      } else {
        throw new NotFoundError('User profile not found.');
      }
    }

    // 4. Calculate universal currency amount
    const currency = (selectedCurrency || 'USD').trim().toUpperCase();
    const converted = convertUsdToCurrency(tierDef.monthlyPriceUsd, currency);
    const amountCents = converted.amountCents;
    const invoiceId = crypto.randomUUID();
    const invoiceNumber = `INV-TIER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 5. Create invoice for platform subscription
    await tx.query(
      `INSERT INTO public.invoices (
         id, circle_id, user_id, invoice_number, title, description,
         status, total_cents, currency, payment_method, metadata, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, 'bachs', $9::jsonb, NOW(), NOW());`,
      [
        invoiceId,
        resolvedCircleId,
        actorUserId,
        invoiceNumber,
        `Circles Platform — ${tierDef.name} Subscription`,
        `Monthly platform subscription for ${circle.name} (${tierDef.badge}, ${tierDef.storageFormatted} storage)`,
        amountCents,
        currency,
        JSON.stringify({
          type: 'platform_tier_subscription',
          target_tier: targetTier,
          monthly_price_usd: tierDef.monthlyPriceUsd,
          selected_currency: currency,
          converted_amount: converted.decimalAmount,
        }),
      ]
    );

    // 6. Create Bachs Checkout Session with guaranteed absolute HTTP/HTTPS URLs
    const processor = getPaymentProcessor();
    const appUrl = ensureAbsoluteHttpUrl('', '', clientOrigin);
    const session = await processor.createCheckoutSession({
      circleId: resolvedCircleId,
      invoiceId,
      userId: actorUserId,
      amountCents,
      currency,
      title: `Circles — ${tierDef.name} (${formatCurrencyAmount(amountCents, currency)}/mo)`,
      customerEmail: profile.email,
      successUrl: `${appUrl}/circles/${circle.slug}/studio?tab=finances&tier_payment=success&invoiceId=${invoiceId}`,
      cancelUrl: `${appUrl}/circles/${circle.slug}/studio?tab=finances&tier_payment=cancelled`,
    });

    return {
      sessionId: session.sessionId,
      checkoutUrl: session.checkoutUrl,
      invoiceId,
      targetTier,
      amountCents,
      currency,
      isSimulated: session.provider === 'mock',
    };
  });
}

/**
 * Confirms payment for a platform plan upgrade, activates the tier, and records revenue.
 */
export async function confirmPlatformTierPayment(
  actorUserId: string,
  circleId: string,
  invoiceId: string,
  paymentReference?: string
): Promise<{
  success: boolean;
  tier: PlatformPlanTier;
  invoiceId: string;
}> {
  return withServiceRoleTransaction(async (tx) => {
    // 1. Resolve circle ID (handles both UUID and slug)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(circleId);
    const circleRes = await tx.query<{ id: string }>(
      `SELECT id FROM public.circles WHERE ${isUuid ? 'id = $1::uuid' : 'slug = $1'} LIMIT 1;`,
      [circleId]
    );
    const circle = circleRes.rows[0];
    if (!circle) throw new NotFoundError('Circle not found.');
    const resolvedCircleId = circle.id;

    // 2. Verify user is admin
    const isStaff = await tx.query<{ allowed: boolean }>(
      `SELECT public.has_circle_staff_role($1::uuid, $2::uuid, 'admin') AS allowed;`,
      [resolvedCircleId, actorUserId]
    );
    if (!isStaff.rows[0]?.allowed) {
      throw new ForbiddenError('Only circle administrators can confirm tier upgrades.');
    }

    // 3. Fetch invoice and verify it is a platform tier subscription invoice
    const invRes = await tx.query<{
      id: string;
      circle_id: string;
      status: string;
      total_cents: number;
      currency: string;
      metadata: { type?: string; target_tier?: PlatformPlanTier };
    }>(
      `SELECT id, circle_id, status, total_cents, currency, metadata
       FROM public.invoices
       WHERE id = $1 AND circle_id = $2
       LIMIT 1;`,
      [invoiceId, resolvedCircleId]
    );

    const inv = invRes.rows[0];
    if (!inv) throw new NotFoundError('Invoice not found.');

    const meta = typeof inv.metadata === 'string' ? JSON.parse(inv.metadata) : inv.metadata;
    if (meta?.type !== 'platform_tier_subscription') {
      throw new ValidationError('Invalid invoice for platform tier activation.');
    }

    const targetTier = meta.target_tier as PlatformPlanTier;
    if (!targetTier || !PLATFORM_TIERS[targetTier]) {
      throw new ValidationError('Invalid target tier in invoice.');
    }

    const ref = paymentReference || `BACHS_TX_${Date.now()}`;

    // 4. Mark invoice paid
    await tx.query(
      `UPDATE public.invoices
       SET status = 'paid',
           paid_at = NOW(),
           payment_reference = $1,
           updated_at = NOW()
       WHERE id = $2;`,
      [ref, invoiceId]
    );

    // 5. Update circle tier with 30-day period
    await tx.query(
      `UPDATE public.circles
       SET plan_tier = $1,
           plan_subscription_status = 'active',
           plan_current_period_end = NOW() + INTERVAL '30 days',
           updated_at = NOW()
       WHERE id = $2;`,
      [targetTier, resolvedCircleId]
    );

    // 6. Record platform revenue
    await tx.query(
      `INSERT INTO public.platform_revenue_ledger (
         circle_id, invoice_id, plan_tier, gross_amount_cents,
         platform_fee_percentage, platform_fee_cents, creator_net_cents,
         currency, payment_reference, created_at
       ) VALUES ($1, $2, $3, $4, 0, $4, 0, $5, $6, NOW());`,
      [resolvedCircleId, invoiceId, targetTier, inv.total_cents, inv.currency, ref]
    );

    return {
      success: true,
      tier: targetTier,
      invoiceId,
    };
  });
}

/**
 * Retrieves the platform fee revenue deduction ledger for a circle.
 */
export async function getCirclePlatformLedger(
  actorUserId: string,
  circleId: string,
  limit = 50,
  offset = 0
): Promise<
  Array<{
    id: string;
    invoice_id: string;
    plan_tier: PlatformPlanTier;
    gross_amount_cents: number;
    platform_fee_percentage: number;
    platform_fee_cents: number;
    creator_net_cents: number;
    currency: string;
    payment_reference: string | null;
    created_at: string;
  }>
> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const isStaff = await tx.query<{ allowed: boolean }>(
      `SELECT public.has_circle_staff_role($1, $2, 'moderator') AS allowed;`,
      [circleId, actorUserId]
    );
    if (!isStaff.rows[0]?.allowed) {
      throw new ForbiddenError('Only circle staff can view the fee deductions ledger.');
    }

    const res = await tx.query<{
      id: string;
      invoice_id: string;
      plan_tier: PlatformPlanTier;
      gross_amount_cents: number;
      platform_fee_percentage: string;
      platform_fee_cents: number;
      creator_net_cents: number;
      currency: string;
      payment_reference: string | null;
      created_at: string;
    }>(
      `SELECT id, invoice_id, plan_tier, gross_amount_cents,
              platform_fee_percentage, platform_fee_cents, creator_net_cents,
              currency, payment_reference, created_at
       FROM public.platform_revenue_ledger
       WHERE circle_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3;`,
      [circleId, limit, offset]
    );

    return res.rows.map((r) => ({
      ...r,
      platform_fee_percentage: parseFloat(r.platform_fee_percentage),
    }));
  });
}
