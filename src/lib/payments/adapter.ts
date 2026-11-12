import crypto from 'crypto';
import { logger } from '@/lib/logging';

export interface CheckoutSessionInput {
  circleId: string;
  invoiceId: string;
  planId?: string | null;
  userId: string;
  amountCents: number;
  currency: string;
  title: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
  provider: 'bachs' | 'mock';
}

export interface WebhookVerificationResult {
  isValid: boolean;
  eventType: string;
  invoiceId?: string;
  circleId?: string;
  paymentReference?: string;
  amountCents?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentProcessorAdapter {
  readonly name: string;
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult>;
  verifyWebhookSignature(
    rawBody: string,
    signature: string,
    secret: string,
    timestamp?: string
  ): Promise<WebhookVerificationResult>;
}

export function ensureAbsoluteHttpUrl(urlStr: string | undefined | null, fallbackPath = ''): string {
  let val = (urlStr || '').trim();
  const defaultBase = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://joincircles.online').trim().replace(/\/+$/, '');

  if (!val) {
    return `${defaultBase}${fallbackPath.startsWith('/') ? fallbackPath : `/${fallbackPath}`}`;
  }

  // If relative path like "/circles/..."
  if (val.startsWith('/')) {
    val = `${defaultBase}${val}`;
  }

  // If scheme is missing (e.g. "localhost:3000/..." or "joincircles.online/...")
  if (!val.startsWith('http://') && !val.startsWith('https://')) {
    const isLocal = val.includes('localhost') || val.includes('127.0.0.1');
    val = isLocal ? `http://${val}` : `https://${val}`;
  }

  try {
    const parsed = new URL(val);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // fallback
  }

  return `${defaultBase}${fallbackPath.startsWith('/') ? fallbackPath : `/${fallbackPath}`}`;
}

/**
 * Bachs Payment Processor Adapter (https://bachs.io)
 * Dedicated sole payment processor for Circles with support for international cards,
 * African bank transfers & mobile money (NGN, GHS, KES, ZAR), and crypto stablecoins.
 */
export class BachsPaymentProcessorAdapter implements PaymentProcessorAdapter {
  readonly name = 'bachs';
  private readonly secretKey: string;
  private readonly baseUrl: string;

  constructor(secretKey: string, baseUrl?: string) {
    this.secretKey = secretKey.trim();
    if (baseUrl) {
      this.baseUrl = baseUrl.replace(/\/+$/, '');
    } else {
      this.baseUrl = this.secretKey.startsWith('sk_sandbox_')
        ? 'https://sandbox-api.bachs.io'
        : 'https://api.bachs.io';
    }
  }

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    const safeSuccessUrl = ensureAbsoluteHttpUrl(input.successUrl);
    const safeCancelUrl = ensureAbsoluteHttpUrl(input.cancelUrl);
    const decimalAmount = (Math.max(0, Number(input.amountCents) || 0) / 100).toFixed(2);

    const payload = {
      customer: {
        email: input.customerEmail || 'member@joincircles.online',
      },
      pricing: {
        amount: decimalAmount,
        currency: input.currency.toUpperCase(),
      },
      metadata: {
        circleId: input.circleId,
        invoiceId: input.invoiceId,
        planId: input.planId || '',
        userId: input.userId,
      },
      success_url: safeSuccessUrl,
      cancel_url: safeCancelUrl,
    };

    const res = await fetch(`${this.baseUrl}/v1/checkout-sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error('Bachs Checkout creation failed', { status: res.status, error: errText });
      throw new Error(`Bachs API error (${res.status}): ${errText.slice(0, 200)}`);
    }

    const session = (await res.json()) as { id: string; checkout_url: string };
    return {
      sessionId: session.id,
      checkoutUrl: session.checkout_url,
      provider: 'bachs',
    };
  }

  async verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string,
    secret: string,
    timestampHeader?: string
  ): Promise<WebhookVerificationResult> {
    if (!signatureHeader || !secret) {
      return { isValid: false, eventType: 'missing_signature_or_secret' };
    }

    // Bachs signs timestamp + "." + rawBody
    const timestamp = timestampHeader || '';
    if (timestamp) {
      const tsSec = Number(timestamp);
      // If timestamp is numeric, verify within 300s (5-minute) tolerance window
      if (!Number.isNaN(tsSec) && tsSec > 0) {
        const nowSec = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSec - tsSec) > 300) {
          logger.warn('Bachs webhook timestamp expired or out of tolerance window', {
            webhookTimestamp: tsSec,
            serverTimestamp: nowSec,
            driftSeconds: Math.abs(nowSec - tsSec),
          });
          return { isValid: false, eventType: 'timestamp_expired' };
        }
      }
    }

    const signedPayload = timestamp ? `${timestamp}.${rawBody}` : rawBody;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    const sigBuf = Buffer.from(signatureHeader, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');
    const isValid =
      sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

    if (!isValid) {
      return { isValid: false, eventType: 'invalid_signature' };
    }

    try {
      const parsed = JSON.parse(rawBody);
      const dataObj = parsed.data || {};
      const sessionObj = dataObj.object || dataObj;
      const metadata = sessionObj.metadata || parsed.metadata || {};

      let resolvedAmountCents: number | undefined;
      const rawCents = sessionObj.amount_cents ?? sessionObj.amount_total_cents;
      if (typeof rawCents === 'number' && !Number.isNaN(rawCents)) {
        resolvedAmountCents = rawCents;
      } else {
        const rawAmount = sessionObj.amount ?? sessionObj.amount_total ?? parsed.amount;
        if (typeof rawAmount === 'number' && !Number.isNaN(rawAmount)) {
          resolvedAmountCents = Math.round(rawAmount * 100);
        } else if (typeof rawAmount === 'string') {
          const num = parseFloat(rawAmount);
          if (!Number.isNaN(num)) {
            resolvedAmountCents = Math.round(num * 100);
          }
        }
      }

      return {
        isValid: true,
        eventType: parsed.type || parsed.event || 'collection.succeeded',
        invoiceId: metadata.invoiceId || sessionObj.internal_order_id || parsed.invoiceId,
        circleId: metadata.circleId || parsed.circleId,
        paymentReference: sessionObj.id || sessionObj.reference || `BACHS_${Date.now()}`,
        amountCents: resolvedAmountCents ?? sessionObj.amount_cents ?? parsed.amountCents,
        currency: (sessionObj.currency || parsed.currency || 'USD').toUpperCase(),
        metadata,
      };
    } catch {
      return { isValid: false, eventType: 'malformed_payload' };
    }
  }
}

/**
 * Local Development Bachs Simulator Adapter
 */
export class MockPaymentProcessorAdapter implements PaymentProcessorAdapter {
  readonly name = 'mock';

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSessionResult> {
    const sessionId = `bachs_sess_${crypto.randomBytes(12).toString('hex')}`;
    logger.info('Created simulated Bachs checkout session', {
      invoiceId: input.invoiceId,
      amountCents: input.amountCents,
      sessionId,
    });

    return {
      sessionId,
      checkoutUrl: `/circles/${input.circleId}/finances?session=${sessionId}&invoice=${input.invoiceId}`,
      provider: 'mock',
    };
  }

  async verifyWebhookSignature(
    rawBody: string,
    signature: string,
    secret: string,
    timestamp?: string
  ): Promise<WebhookVerificationResult> {
    const signedPayload = timestamp ? `${timestamp}.${rawBody}` : rawBody;
    const computedHmac = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    const isValid = signature === computedHmac || signature.startsWith('mock_sig_') || signature.length > 0;

    try {
      const parsed = JSON.parse(rawBody);
      const dataObj = parsed.data || {};
      const sessionObj = dataObj.object || dataObj;
      const metadata = sessionObj.metadata || parsed.metadata || {};

      return {
        isValid,
        eventType: parsed.type || parsed.event || 'collection.succeeded',
        invoiceId: metadata.invoiceId || sessionObj.internal_order_id || parsed.invoiceId,
        circleId: metadata.circleId || parsed.circleId,
        paymentReference: sessionObj.id || `BACHS_TX_${Date.now()}`,
        amountCents: sessionObj.amount_cents || sessionObj.amount_total || parsed.amountCents,
        currency: (sessionObj.currency || parsed.currency || 'USD').toUpperCase(),
        metadata,
      };
    } catch {
      return {
        isValid: false,
        eventType: 'unknown',
      };
    }
  }
}

export function isBachsConfigured(): boolean {
  return Boolean(process.env.BACHS_SECRET_KEY && process.env.BACHS_SECRET_KEY.trim().length > 0);
}

export function getPaymentProcessor(): PaymentProcessorAdapter {
  if (isBachsConfigured() && process.env.BACHS_SECRET_KEY) {
    return new BachsPaymentProcessorAdapter(process.env.BACHS_SECRET_KEY);
  }
  return new MockPaymentProcessorAdapter();
}
