import { DbTransaction, withRlsTransaction } from '@/lib/db/postgres';
import { ForbiddenError } from '@/lib/errors';
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
    feature === 'circle_sponsor_engine' || feature === 'direct_erp_sync'
      ? 'Platinum ($99/mo)'
      : 'Pro ($29/mo)';

  const featureNames: Record<GatedTierFeature, string> = {
    ad_free_experience: 'Ad-Free Community Experience',
    custom_domain: 'Custom Domain Mapping',
    white_label_emails: 'White-Label Branding & Email Sender',
    circle_sponsor_engine: 'Circle Sponsor Engine',
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
