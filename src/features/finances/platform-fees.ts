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
  TIER_RANK,
  getHigherTier,
} from './platform-fee-constants';

export {
  type PlatformPlanTier,
  type PlatformTierDefinition,
  type GatedTierFeature,
  PLATFORM_TIERS,
  TIER_RANK,
  getHigherTier,
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
 * Supports All-in-One Account Subscriptions:
 * If the circle owner holds an active account-level subscription tier higher than
 * the circle's standalone tier, the circle automatically inherits all account tier benefits!
 */
export async function getCircleTierInfo(
  tx: DbTransaction,
  circleId: string
): Promise<{
  planTier: PlatformPlanTier;
  customPlatformFeePercentage: number | null;
  subscriptionStatus: string;
  inheritedFromOwner?: boolean;
  ownerSubscriptionTier?: PlatformPlanTier;
  circlePlanTier?: PlatformPlanTier;
}> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(circleId);
  const res = await tx.query<{
    plan_tier: PlatformPlanTier;
    custom_platform_fee_percentage: string | null;
    plan_subscription_status: string;
    owner_id: string | null;
    owner_subscription_tier: PlatformPlanTier | null;
    owner_subscription_status: string | null;
  }>(
    `SELECT c.plan_tier, c.custom_platform_fee_percentage, c.plan_subscription_status,
            c.owner_id, p.subscription_tier AS owner_subscription_tier,
            p.plan_subscription_status AS owner_subscription_status
     FROM public.circles c
     LEFT JOIN public.profiles p ON p.id = c.owner_id
     WHERE ${isUuid ? 'c.id = $1::uuid' : 'c.slug = $1'}
     LIMIT 1;`,
    [circleId]
  );

  const row = res.rows[0];
  if (!row) {
    return {
      planTier: 'free',
      customPlatformFeePercentage: null,
      subscriptionStatus: 'active',
      inheritedFromOwner: false,
    };
  }

  const circleTier = row.plan_tier || 'free';
  const circleStatus = row.plan_subscription_status || 'active';
  const ownerTier = row.owner_subscription_tier || 'free';
  const ownerStatus = row.owner_subscription_status || 'active';

  // If the owner has an active All-in-One account subscription with higher tier than the circle's standalone tier
  const ownerTierActive = ownerStatus === 'active';
  const ownerIsHigher = ownerTierActive && (TIER_RANK[ownerTier] ?? 0) > (TIER_RANK[circleTier] ?? 0);

  const effectiveTier = ownerIsHigher ? ownerTier : circleTier;
  const effectiveStatus = ownerIsHigher ? ownerStatus : circleStatus;

  return {
    planTier: effectiveTier,
    customPlatformFeePercentage: row.custom_platform_fee_percentage
      ? parseFloat(row.custom_platform_fee_percentage)
      : null,
    subscriptionStatus: effectiveStatus,
    inheritedFromOwner: ownerIsHigher,
    ownerSubscriptionTier: ownerTier,
    circlePlanTier: circleTier,
  };
}

export interface UserCommunityQuota {
  subscriptionTier: PlatformPlanTier;
  subscriptionStatus: string;
  ownedCount: number;
  maxCommunitiesAllowed: number;
  canCreateMore: boolean;
  tierName: string;
  storageFormatted: string;
}

/**
 * Calculates a creator's community quota under their All-in-One Account Subscription.
 */
export async function getUserCommunityQuota(
  tx: DbTransaction,
  userId: string
): Promise<UserCommunityQuota> {
  const profileRes = await tx.query<{
    subscription_tier: PlatformPlanTier | null;
    plan_subscription_status: string | null;
    custom_max_communities: number | null;
  }>(
    `SELECT subscription_tier, plan_subscription_status, custom_max_communities
     FROM public.profiles
     WHERE id = $1::uuid
     LIMIT 1;`,
    [userId]
  );
  const profile = profileRes.rows[0];
  const tier: PlatformPlanTier = profile?.subscription_tier || 'free';
  const status = profile?.plan_subscription_status || 'active';
  const tierDef = PLATFORM_TIERS[tier] || PLATFORM_TIERS.free;

  const countRes = await tx.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM public.circles WHERE owner_id = $1::uuid;`,
    [userId]
  );
  const ownedCount = parseInt(countRes.rows[0]?.count || '0', 10);

  const maxCommunities =
    profile?.custom_max_communities != null
      ? profile.custom_max_communities
      : status === 'active'
        ? tierDef.maxCommunitiesAllowed
        : PLATFORM_TIERS.free.maxCommunitiesAllowed;

  return {
    subscriptionTier: tier,
    subscriptionStatus: status,
    ownedCount,
    maxCommunitiesAllowed: maxCommunities,
    canCreateMore: ownedCount < maxCommunities,
    tierName: tierDef.name,
    storageFormatted: tierDef.storageFormatted,
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
 * Creates a Bachs checkout session for upgrading the Circle or Account platform plan tier.
 * Supports All-in-One account subscriptions (upgrades creator account and all owned circles)
 * as well as single-circle upgrades.
 * Supports universal multi-currency payment across all Bachs supported currencies.
 */
export async function createPlatformTierCheckoutSession(
  actorUserId: string,
  circleId: string,
  targetTier: PlatformPlanTier,
  selectedCurrency: string = 'USD',
  clientOrigin?: string,
  scope: 'circle' | 'account' = 'account'
): Promise<{
  sessionId: string;
  checkoutUrl: string;
  invoiceId: string;
  targetTier: PlatformPlanTier;
  amountCents: number;
  currency: string;
  isSimulated: boolean;
  scope: 'circle' | 'account';
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

    const title =
      scope === 'account'
        ? `All-in-One Account Plan: ${tierDef.name}`
        : `Circles Platform: ${tierDef.name} (${circle.name})`;
    const description =
      scope === 'account'
        ? `Unlocks up to ${tierDef.maxCommunitiesAllowed} communities, ${tierDef.platformFeePercentage}% fees, and ${tierDef.storageFormatted} storage across all your circles.`
        : `Monthly platform subscription for ${circle.name} (${tierDef.badge}, ${tierDef.storageFormatted} storage).`;

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
        title,
        description,
        amountCents,
        currency,
        JSON.stringify({
          type: 'platform_tier_subscription',
          target_tier: targetTier,
          scope,
          user_id: actorUserId,
          circle_id: resolvedCircleId,
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
      title: `${title} (${formatCurrencyAmount(amountCents, currency)}/mo)`,
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
      scope,
    };
  });
}

/**
 * Creates a Bachs checkout session for an account-wide All-in-One subscription
 * directly for a user (without requiring a specific circle).
 */
export async function createAccountTierCheckoutSession(
  actorUserId: string,
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
    // If user already owns a circle, use the standard flow with account scope
    const circleRes = await tx.query<{ id: string }>(
      `SELECT id FROM public.circles WHERE owner_id = $1::uuid ORDER BY created_at ASC LIMIT 1;`,
      [actorUserId]
    );
    if (circleRes.rows[0]) {
      return createPlatformTierCheckoutSession(
        actorUserId,
        circleRes.rows[0].id,
        targetTier,
        selectedCurrency,
        clientOrigin,
        'account'
      );
    }

    const tierDef = PLATFORM_TIERS[targetTier];
    if (!tierDef || targetTier === 'free' || tierDef.monthlyPriceUsd <= 0) {
      throw new ValidationError(`Cannot checkout for tier "${targetTier}". Paid tiers only.`);
    }

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
        throw new NotFoundError('User profile not found for checkout.');
      }
    }

    const currency = (selectedCurrency || 'USD').trim().toUpperCase();
    const converted = convertUsdToCurrency(tierDef.monthlyPriceUsd, currency);
    const amountCents = converted.amountCents;
    const invoiceId = crypto.randomUUID();
    const invoiceNumber = `INV-ACT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await tx.query(
      `INSERT INTO public.invoices (
         id, circle_id, user_id, invoice_number, title, description,
         status, total_cents, currency, payment_method, metadata, created_at, updated_at
       ) VALUES ($1, NULL, $2, $3, $4, $5, 'open', $6, $7, 'bachs', $8::jsonb, NOW(), NOW());`,
      [
        invoiceId,
        actorUserId,
        invoiceNumber,
        `All-in-One Account Plan: ${tierDef.name}`,
        `Unlocks up to ${tierDef.maxCommunitiesAllowed} communities, ${tierDef.platformFeePercentage}% fees, and ${tierDef.storageFormatted} storage across all your circles.`,
        amountCents,
        currency,
        JSON.stringify({
          type: 'platform_tier_subscription',
          target_tier: targetTier,
          scope: 'account',
          user_id: actorUserId,
          monthly_price_usd: tierDef.monthlyPriceUsd,
          selected_currency: currency,
          converted_amount: converted.decimalAmount,
        }),
      ]
    );

    const processor = getPaymentProcessor();
    const appUrl = ensureAbsoluteHttpUrl('', '', clientOrigin);
    const session = await processor.createCheckoutSession({
      circleId: 'account',
      invoiceId,
      userId: actorUserId,
      amountCents,
      currency,
      title: `All-in-One Account Plan: ${tierDef.name} (${formatCurrencyAmount(amountCents, currency)}/mo)`,
      customerEmail: profile.email,
      successUrl: `${appUrl}/circles/new?account_upgraded=true&invoiceId=${invoiceId}`,
      cancelUrl: `${appUrl}/circles/new?checkout_cancelled=true`,
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
 * For All-in-One account subscriptions, activates the user's account tier and all circles owned by them!
 */
export async function confirmPlatformTierPayment(
  actorUserId: string,
  circleIdOrScope: string,
  invoiceId: string,
  paymentReference?: string
): Promise<{
  success: boolean;
  tier: PlatformPlanTier;
  invoiceId: string;
  scope?: string;
}> {
  return withServiceRoleTransaction(async (tx) => {
    // 1. Fetch invoice and verify it is a platform tier subscription invoice
    const invRes = await tx.query<{
      id: string;
      circle_id: string | null;
      user_id: string;
      status: string;
      total_cents: number;
      currency: string;
      metadata: { type?: string; target_tier?: PlatformPlanTier; scope?: 'circle' | 'account'; user_id?: string };
    }>(
      `SELECT id, circle_id, user_id, status, total_cents, currency, metadata
       FROM public.invoices
       WHERE id = $1
       LIMIT 1;`,
      [invoiceId]
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

    const isAccountScope = meta?.scope === 'account' || circleIdOrScope === 'account';
    const targetUserId = meta?.user_id || inv.user_id || actorUserId;
    const ref = paymentReference || `BACHS_TX_${Date.now()}`;

    // 2. Mark invoice paid
    await tx.query(
      `UPDATE public.invoices
       SET status = 'paid',
           paid_at = NOW(),
           payment_reference = $1,
           updated_at = NOW()
       WHERE id = $2;`,
      [ref, invoiceId]
    );

    // 3. Update tiers based on scope
    if (isAccountScope) {
      // Activate All-in-One Account Tier on Creator's profile
      await tx.query(
        `UPDATE public.profiles
         SET subscription_tier = $1,
             plan_subscription_status = 'active',
             plan_current_period_end = NOW() + INTERVAL '30 days',
             updated_at = NOW()
         WHERE id = $2;`,
        [targetTier, targetUserId]
      );

      // Update all circles owned by this creator so they immediately inherit and reflect the new tier
      await tx.query(
        `UPDATE public.circles
         SET plan_tier = $1,
             plan_subscription_status = 'active',
             plan_current_period_end = NOW() + INTERVAL '30 days',
             updated_at = NOW()
         WHERE owner_id = $2;`,
        [targetTier, targetUserId]
      );
    } else if (inv.circle_id) {
      // Update specific standalone circle
      await tx.query(
        `UPDATE public.circles
         SET plan_tier = $1,
             plan_subscription_status = 'active',
             plan_current_period_end = NOW() + INTERVAL '30 days',
             updated_at = NOW()
         WHERE id = $2;`,
        [targetTier, inv.circle_id]
      );
    }

    // 4. Record platform revenue in ledger
    await tx.query(
      `INSERT INTO public.platform_revenue_ledger (
         circle_id, user_id, invoice_id, plan_tier, gross_amount_cents,
         platform_fee_percentage, platform_fee_cents, creator_net_cents,
         currency, payment_reference, created_at
       ) VALUES ($1, $2, $3, $4, $5, 0, $5, 0, $6, $7, NOW());`,
      [inv.circle_id || null, targetUserId, invoiceId, targetTier, inv.total_cents, inv.currency, ref]
    );

    return {
      success: true,
      tier: targetTier,
      invoiceId,
      scope: isAccountScope ? 'account' : 'circle',
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
