import { logger } from '@/lib/logging';

export interface TransactionalEmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailDeliveryResult {
  status: 'delivered' | 'skipped_unconfigured' | 'failed';
  providerReference?: string;
  errorMessage?: string;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim().length > 0);
}

/**
 * Returns the configured sender email.
 * Defaults to 'Circles <onboarding@resend.dev>' if unconfigured or set to example.com,
 * which allows testing with standard Resend API keys without domain verification blockers.
 */
export function getSenderEmail(): string {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  if (configured && !configured.includes('example.com')) {
    return configured;
  }
  return 'Circles <onboarding@resend.dev>';
}

export async function sendTransactionalEmail(
  payload: TransactionalEmailPayload
): Promise<EmailDeliveryResult> {
  if (!isResendConfigured()) {
    logger.info('Resend API key not configured; skipping external email delivery.', {
      to: payload.to,
      subject: payload.subject,
    });
    return {
      status: 'skipped_unconfigured',
      errorMessage: 'RESEND_API_KEY is not configured in environment variables.',
    };
  }

  const from = getSenderEmail();

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.warn('Resend transactional email delivery failed', {
        to: payload.to,
        from,
        subject: payload.subject,
        statusCode: response.status,
        response: errText.slice(0, 300),
      });
      return {
        status: 'failed',
        errorMessage: `Resend HTTP ${response.status}: ${errText.slice(0, 200)}`,
      };
    }

    const data = (await response.json()) as { id?: string };
    logger.info('Resend transactional email delivered successfully', {
      to: payload.to,
      subject: payload.subject,
      providerReference: data.id,
    });
    return {
      status: 'delivered',
      providerReference: data.id,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown email transport error';
    logger.error('Resend transactional email transport exception', {
      to: payload.to,
      subject: payload.subject,
      error: errorMsg,
    });
    return {
      status: 'failed',
      errorMessage: errorMsg,
    };
  }
}
