import { DbTransaction, withRlsTransaction } from '@/lib/db/postgres';
import { ForbiddenError } from '@/lib/errors';
import {
  PlatformPlanTier,
  PlatformTierDefinition,
  PLATFORM_TIERS,
  FeeCalculationResult,
  calculatePlatformFee,
} from './platform-fee-constants';

export {
  type PlatformPlanTier,
  type PlatformTierDefinition,
  PLATFORM_TIERS,
  type FeeCalculationResult,
  calculatePlatformFee,
};

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
 * Updates a circle's platform plan tier (Free, Pro, Platinum, Enterprise).
 * Only circle administrators or platform admins can execute this.
 */
export async function updateCircleTier(
  actorUserId: string,
  circleId: string,
  tier: PlatformPlanTier,
  customFeePercentage?: number | null
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

    const res = await tx.query<{
      plan_tier: PlatformPlanTier;
      custom_platform_fee_percentage: string | null;
      plan_subscription_status: string;
    }>(
      `UPDATE public.circles
       SET plan_tier = $1,
           custom_platform_fee_percentage = $2,
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
