import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';
import { withRlsTransaction } from '@/lib/db/postgres';
import {
  PLATFORM_TIERS,
  getUserCommunityQuota,
  createAccountTierCheckoutSession,
  confirmPlatformTierPayment,
} from '@/features/finances/platform-fees';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const quota = await withRlsTransaction(user.id, async (tx) => {
      return getUserCommunityQuota(tx, user.id);
    });

    return NextResponse.json({
      quota,
      tiers: PLATFORM_TIERS,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === 'upgrade_checkout') {
      if (!body.tier || !['starter', 'pro', 'platinum'].includes(body.tier)) {
        throw new ValidationError('Valid paid tier (starter, pro, platinum) is required for checkout.');
      }
      const originHeader = req.headers.get('origin') || req.headers.get('referer');
      let clientOrigin: string | undefined;
      if (typeof body.origin === 'string' && body.origin.trim().length > 0) {
        clientOrigin = body.origin.trim();
      } else if (originHeader) {
        try {
          clientOrigin = new URL(originHeader).origin;
        } catch {
          // ignore
        }
      }

      const session = await createAccountTierCheckoutSession(
        user.id,
        body.tier,
        body.currency || 'USD',
        clientOrigin
      );
      return NextResponse.json(session, { status: 200 });
    }

    if (action === 'confirm_payment') {
      if (!body.invoiceId) {
        throw new ValidationError('invoiceId is required to confirm payment.');
      }
      const result = await confirmPlatformTierPayment(
        user.id,
        'account',
        body.invoiceId,
        body.paymentReference
      );
      return NextResponse.json(result, { status: 200 });
    }

    throw new ValidationError(`Unknown action: "${action}"`);
  } catch (error) {
    return handleApiError(error);
  }
}
