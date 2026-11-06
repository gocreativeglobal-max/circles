import crypto from 'crypto';
import { z } from 'zod';
import { withRlsTransaction, withServiceRoleTransaction } from '@/lib/db/postgres';
import {
  CircleRole,
  CircleVisibility,
  ListingInquiryItem,
  MarketplaceCircleSettings,
  MarketplaceListingItem,
  MarketplaceOrderItem,
  MembershipStatus,
  MemberWalletBalanceItem,
  MemberWalletTransactionItem,
  ServiceBookingItem,
} from '@/types/domain';
import {
  CapabilityDisabledError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { createNotification } from '@/features/notifications/service';
import { isBachsSupportedCurrency } from '@/lib/payments/currencies';
import { calculatePlatformFee } from '@/features/finances/platform-fees';

const COMMERCE_CAPABILITY_KEYS = [
  'marketplace',
  'listings_discovery',
  'services_bookings',
  'rentals_sharing',
  'housing_property',
];

export const availabilityScheduleSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).default('17:00'),
  slotDurationMinutes: z.number().int().min(15).max(480).default(60),
  bufferMinutes: z.number().int().min(0).max(120).default(0),
  timezone: z.string().optional(),
});

export const createListingSchema = z.object({
  circleId: z.string().uuid(),
  listingType: z.string().trim().min(1).max(40).default('product'),
  category: z.string().trim().min(1).max(60).default('general'),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(10000).default(''),
  priceAmount: z.number().min(0).max(100000000).nullable().optional(),
  priceCurrency: z
    .string()
    .trim()
    .min(3)
    .max(4)
    .toUpperCase()
    .refine((c) => isBachsSupportedCurrency(c), 'Unsupported currency code.')
    .default('USD'),
  pricingUnit: z
    .enum(['fixed', 'hourly', 'daily', 'monthly', 'free', 'negotiable'])
    .default('fixed'),
  transactionType: z
    .enum(['free', 'fixed', 'rate', 'range', 'negotiable'])
    .default('fixed'),
  rateInterval: z
    .enum(['hourly', 'daily', 'weekly', 'monthly', 'annually'])
    .nullable()
    .optional(),
  priceMin: z.number().min(0).max(100000000).nullable().optional(),
  priceMax: z.number().min(0).max(100000000).nullable().optional(),
  actionType: z.enum(['inquiry', 'booking', 'application', 'link', 'checkout']).default('inquiry'),
  actionUrl: z.string().trim().max(2048).nullable().optional(),
  customFields: z.record(z.unknown()).default({}),
  tags: z.array(z.string().trim().max(40)).default([]),
  condition: z
    .enum(['new', 'like_new', 'good', 'fair', 'not_applicable'])
    .nullable()
    .optional(),
  location: z.string().trim().max(200).nullable().optional(),
  contactPreference: z.enum(['in_app_inquiry', 'email', 'both']).default('in_app_inquiry'),
  imageUrls: z.array(z.string().trim().min(1).max(1000)).max(12).default([]),
  serviceDurationMinutes: z.number().int().min(15).max(1440).nullable().optional(),
  availableFrom: z.string().datetime().nullable().optional(),
  availableUntil: z.string().datetime().nullable().optional(),
  availabilitySchedule: availabilityScheduleSchema.optional().nullable(),
  isInstantBookable: z.boolean().default(false),
  status: z.enum(['draft', 'published']).default('published'),
});

export const updateListingSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().max(10000).optional(),
  category: z.string().trim().min(1).max(60).optional(),
  listingType: z.string().trim().min(1).max(40).optional(),
  priceAmount: z.number().min(0).max(100000000).nullable().optional(),
  priceCurrency: z
    .string()
    .trim()
    .min(3)
    .max(4)
    .toUpperCase()
    .refine((c) => isBachsSupportedCurrency(c), 'Unsupported currency code.')
    .optional(),
  pricingUnit: z.enum(['fixed', 'hourly', 'daily', 'monthly', 'free', 'negotiable']).optional(),
  transactionType: z.enum(['free', 'fixed', 'rate', 'range', 'negotiable']).optional(),
  rateInterval: z.enum(['hourly', 'daily', 'weekly', 'monthly', 'annually']).nullable().optional(),
  priceMin: z.number().min(0).max(100000000).nullable().optional(),
  priceMax: z.number().min(0).max(100000000).nullable().optional(),
  actionType: z.enum(['inquiry', 'booking', 'application', 'link', 'checkout']).optional(),
  actionUrl: z.string().trim().max(2048).nullable().optional(),
  customFields: z.record(z.unknown()).optional(),
  tags: z.array(z.string().trim().max(40)).optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'not_applicable']).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  imageUrls: z.array(z.string().trim().min(1).max(1000)).max(12).optional(),
  availabilitySchedule: availabilityScheduleSchema.optional().nullable(),
  isInstantBookable: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'reserved', 'sold', 'archived', 'removed']).optional(),
});

export const createInquirySchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

export const respondInquirySchema = z.object({
  status: z.enum(['responded', 'accepted', 'declined', 'closed']),
  sellerResponse: z.string().trim().min(1).max(2000).optional(),
});

export const createBookingSchema = z.object({
  bookingType: z.enum(['service', 'rental']).default('service'),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  notes: z.string().trim().max(2000).default(''),
});

export const updateBookingSchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled', 'completed', 'returned']),
  providerNote: z.string().trim().max(2000).optional(),
});

export const checkoutListingSchema = z.object({
  paymentMethod: z.enum(['bachs', 'card', 'mobile_money', 'bank_transfer', 'stablecoin']).default('bachs'),
  buyerNote: z.string().trim().max(1000).default(''),
});

export const withdrawWalletSchema = z.object({
  currency: z
    .string()
    .trim()
    .min(3)
    .max(4)
    .toUpperCase()
    .refine((c) => isBachsSupportedCurrency(c), 'Unsupported currency code.'),
  amountCents: z.number().int().min(100),
  payoutDestination: z.string().trim().min(3).max(240),
});

export function normalizeMarketplaceSettings(
  raw?: Record<string, unknown> | null
): Required<MarketplaceCircleSettings> {
  const s = raw ?? {};
  const defaultCurrency =
    typeof s.defaultCurrency === 'string' && isBachsSupportedCurrency(s.defaultCurrency)
      ? s.defaultCurrency.toUpperCase()
      : 'USD';
  const allowMultiCurrency = s.allowMultiCurrency !== false;
  const commissionPercentage = Math.min(
    30,
    Math.max(0, Number(s.commissionPercentage ?? 0) || 0)
  );
  const payToPostEnabled = Boolean(s.payToPostEnabled);
  const payToPostFeeAmount = Math.max(0, Number(s.payToPostFeeAmount ?? 0) || 0);
  const payToPostTypes = Array.isArray(s.payToPostTypes)
    ? (s.payToPostTypes as string[])
    : ['job', 'property'];
  const allowedListingTypes =
    Array.isArray(s.allowedListingTypes) && s.allowedListingTypes.length > 0
      ? (s.allowedListingTypes as string[])
      : ['product', 'service', 'rental', 'property', 'job', 'custom'];
  const postingPolicy = s.postingPolicy === 'admins_only' ? 'admins_only' : 'all_members';

  return {
    defaultCurrency,
    allowMultiCurrency,
    commissionPercentage,
    payToPostEnabled,
    payToPostFeeAmount,
    payToPostTypes,
    allowedListingTypes,
    postingPolicy,
  };
}

async function assertCommerceCapability(
  tx: { query: <T>(sql: string, values?: unknown[]) => Promise<{ rows: T[] }> },
  circleId: string,
  actorUserId: string | null
): Promise<{
  circle: {
    id: string;
    slug: string;
    visibility: CircleVisibility;
    plan_tier?: 'free' | 'pro' | 'platinum' | 'enterprise';
    custom_platform_fee_percentage?: number | null;
  };
  membership: { role: CircleRole; status: MembershipStatus } | null;
  enabledKeys: Set<string>;
  marketplaceSettings: Required<MarketplaceCircleSettings>;
}> {
  const circleRes = await tx.query<{
    id: string;
    slug: string;
    visibility: CircleVisibility;
    plan_tier?: 'free' | 'pro' | 'platinum' | 'enterprise';
    custom_platform_fee_percentage?: number | null;
  }>(
    `SELECT id, slug, visibility, plan_tier, custom_platform_fee_percentage
     FROM public.circles WHERE id = $1 LIMIT 1;`,
    [circleId]
  );
  const circle = circleRes.rows[0];
  if (!circle) {
    throw new NotFoundError('Circle not found.');
  }

  const capRes = await tx.query<{
    capability_key: string;
    settings: Record<string, unknown> | null;
  }>(
    `SELECT capability_key, settings FROM public.circle_capabilities
     WHERE circle_id = $1 AND capability_key = ANY($2::text[]) AND enabled = true;`,
    [circleId, COMMERCE_CAPABILITY_KEYS]
  );

  if (capRes.rows.length === 0) {
    throw new CapabilityDisabledError('marketplace');
  }

  const mktCap =
    capRes.rows.find((r) => r.capability_key === 'marketplace') ?? capRes.rows[0];
  const marketplaceSettings = normalizeMarketplaceSettings(mktCap?.settings);

  let membership: { role: CircleRole; status: MembershipStatus } | null = null;
  if (actorUserId) {
    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    membership = memRes.rows[0] ?? null;
  }

  return {
    circle,
    membership,
    enabledKeys: new Set(capRes.rows.map((r) => r.capability_key)),
    marketplaceSettings,
  };
}

function normalizeListingRow(
  row: MarketplaceListingItem & {
    seller_username?: string;
    seller_display_name?: string;
    seller_avatar_url?: string | null;
    viewer_has_saved?: boolean;
  }
): MarketplaceListingItem {
  return {
    id: row.id,
    circle_id: row.circle_id,
    seller_id: row.seller_id,
    listing_type: row.listing_type,
    category: row.category,
    title: row.title,
    description: row.description,
    price_amount: row.price_amount !== null && row.price_amount !== undefined ? Number(row.price_amount) : null,
    price_currency: row.price_currency,
    pricing_unit: row.pricing_unit,
    transaction_type: row.transaction_type ?? 'fixed',
    rate_interval: row.rate_interval ?? null,
    price_min: row.price_min !== null && row.price_min !== undefined ? Number(row.price_min) : null,
    price_max: row.price_max !== null && row.price_max !== undefined ? Number(row.price_max) : null,
    action_type: row.action_type ?? 'inquiry',
    action_url: row.action_url ?? null,
    custom_fields: typeof row.custom_fields === 'object' && row.custom_fields !== null ? row.custom_fields : {},
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    condition: row.condition ?? null,
    location: row.location ?? null,
    contact_preference: row.contact_preference,
    image_urls: Array.isArray(row.image_urls) ? (row.image_urls as string[]) : [],
    service_duration_minutes: row.service_duration_minutes ?? null,
    available_from: row.available_from ?? null,
    available_until: row.available_until ?? null,
    availability_schedule: row.availability_schedule ?? null,
    is_instant_bookable: Boolean(row.is_instant_bookable),
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    seller: row.seller_username
      ? {
          id: row.seller_id,
          username: row.seller_username,
          display_name: row.seller_display_name ?? row.seller_username,
          avatar_url: row.seller_avatar_url ?? null,
        }
      : undefined,
    viewer_has_saved: Boolean(row.viewer_has_saved),
  };
}

export async function createMarketplaceListing(
  actorUserId: string,
  input: z.input<typeof createListingSchema>
): Promise<MarketplaceListingItem> {
  const parsed = createListingSchema.parse(input);

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership, marketplaceSettings } = await assertCommerceCapability(
      tx,
      parsed.circleId,
      actorUserId
    );
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can publish marketplace listings.');
    }

    const isStaff = ['owner', 'admin', 'moderator'].includes(membership.role);
    if (marketplaceSettings.postingPolicy === 'admins_only' && !isStaff) {
      throw new ForbiddenError('Only Circle admins and moderators can post listings in this Circle.');
    }

    const resolvedCurrency = marketplaceSettings.allowMultiCurrency
      ? parsed.priceCurrency.toUpperCase()
      : marketplaceSettings.defaultCurrency;

    const listingId = crypto.randomUUID();
    const res = await tx.query<MarketplaceListingItem>(
      `INSERT INTO public.marketplace_listings (
         id, circle_id, seller_id, listing_type, category, title, description,
         price_amount, price_currency, pricing_unit, condition, location,
         contact_preference, image_urls, service_duration_minutes,
         available_from, available_until, availability_schedule, is_instant_bookable, status,
         transaction_type, rate_interval, price_min, price_max, action_type, action_url, custom_fields, tags
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11, $12,
         $13, $14::jsonb, $15,
         $16, $17, $18::jsonb, $19::boolean, $20,
         $21, $22, $23, $24, $25, $26, $27::jsonb, $28::jsonb
       ) RETURNING *;`,
      [
        listingId,
        parsed.circleId,
        actorUserId,
        parsed.listingType,
        parsed.category,
        parsed.title,
        parsed.description,
        parsed.priceAmount ?? null,
        resolvedCurrency,
        parsed.pricingUnit,
        parsed.condition ?? null,
        parsed.location ?? null,
        parsed.contactPreference,
        JSON.stringify(parsed.imageUrls),
        parsed.serviceDurationMinutes ?? null,
        parsed.availableFrom ?? null,
        parsed.availableUntil ?? null,
        parsed.availabilitySchedule
          ? JSON.stringify(parsed.availabilitySchedule)
          : JSON.stringify({
              days: [1, 2, 3, 4, 5],
              startTime: '09:00',
              endTime: '17:00',
              slotDurationMinutes: parsed.serviceDurationMinutes ?? 60,
              bufferMinutes: 0,
            }),
        Boolean(parsed.isInstantBookable),
        parsed.status,
        parsed.transactionType,
        parsed.rateInterval ?? null,
        parsed.priceMin ?? null,
        parsed.priceMax ?? null,
        parsed.actionType,
        parsed.actionUrl ?? null,
        JSON.stringify(parsed.customFields || {}),
        JSON.stringify(parsed.tags || []),
      ]
    );

    const requiresPayToPost =
      !isStaff &&
      marketplaceSettings.payToPostEnabled &&
      marketplaceSettings.payToPostFeeAmount > 0 &&
      (marketplaceSettings.payToPostTypes.includes('all') ||
        marketplaceSettings.payToPostTypes.includes(parsed.listingType));

    return {
      listing: normalizeListingRow(res.rows[0]),
      requiresPayToPost,
      payToPostFeeAmount: marketplaceSettings.payToPostFeeAmount,
      payToPostCurrency: marketplaceSettings.defaultCurrency,
      circle,
    };
  });

  if (outcome.requiresPayToPost) {
    const grossFeeCents = Math.round(outcome.payToPostFeeAmount * 100);
    const feeBreakdown = calculatePlatformFee(
      outcome.circle.plan_tier || 'free',
      grossFeeCents,
      outcome.circle.custom_platform_fee_percentage
    );
    await withServiceRoleTransaction(async (stx) => {
      await stx.query(
        `INSERT INTO public.community_treasury_ledger (
           id, circle_id, entry_type, category, amount_cents, currency,
           description, is_public_to_members, recorded_by, metadata
         ) VALUES ($1, $2, 'revenue', 'other', $3, $4, $5, true, $6, $7::jsonb);`,
        [
          crypto.randomUUID(),
          parsed.circleId,
          feeBreakdown.creatorNetCents,
          outcome.payToPostCurrency,
          `Pay-to-post listing fee: ${outcome.listing.title}`,
          actorUserId,
          JSON.stringify({
            listing_id: outcome.listing.id,
            gross_cents: grossFeeCents,
            platform_fee_cents: feeBreakdown.feeCents,
          }),
        ]
      );
    });
  }

  return outcome.listing;
}

export async function listMarketplaceListings(
  actorUserId: string | null,
  circleId: string,
  options?: {
    listingType?: string;
    category?: string;
    transactionType?: string;
    actionType?: string;
    tag?: string;
    search?: string;
    status?: string;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: 'newest' | 'price_asc' | 'price_desc';
    limit?: number;
    offset?: number;
  }
): Promise<MarketplaceListingItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership } = await assertCommerceCapability(tx, circleId, actorUserId);
    if (
      !canReadCircleContent(circle.visibility, {
        userId: actorUserId,
        circleRole: membership?.role ?? null,
        membershipStatus: membership?.status ?? null,
      })
    ) {
      throw new ForbiddenError('You do not have permission to view listings in this Circle.');
    }

    const res = await tx.query<
      MarketplaceListingItem & {
        seller_username: string;
        seller_display_name: string;
        seller_avatar_url: string | null;
        viewer_has_saved: boolean;
      }
    >(
      `SELECT l.*,
         COALESCE(u.username, 'member') AS seller_username,
         COALESCE(u.display_name, 'Member') AS seller_display_name,
         u.avatar_url AS seller_avatar_url,
         EXISTS (
           SELECT 1 FROM public.marketplace_saved_listings s
           WHERE s.listing_id = l.id AND s.user_id = $2
         ) AS viewer_has_saved
       FROM public.marketplace_listings l
       LEFT JOIN public.profiles u ON u.id = l.seller_id
       WHERE l.circle_id = $1
       ORDER BY l.created_at DESC;`,
      [circleId, actorUserId]
    );

    let items = res.rows.map(normalizeListingRow);

    if (options?.listingType && options.listingType !== 'all') {
      items = items.filter((item) => item.listing_type === options.listingType);
    }
    if (options?.transactionType) {
      items = items.filter((item) => item.transaction_type === options.transactionType);
    }
    if (options?.actionType) {
      items = items.filter((item) => item.action_type === options.actionType);
    }
    if (options?.tag) {
      const targetTag = options.tag.toLowerCase();
      items = items.filter((item) => item.tags?.some((t) => t.toLowerCase() === targetTag));
    }
    if (options?.category) {
      items = items.filter(
        (item) => item.category.toLowerCase() === options.category!.toLowerCase()
      );
    }
    if (options?.status) {
      items = items.filter((item) => item.status === options.status);
    }
    if (options?.search) {
      const q = options.search.trim().toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.location ?? '').toLowerCase().includes(q) ||
          item.tags?.some((t) => t.toLowerCase().includes(q)) ||
          JSON.stringify(item.custom_fields || {}).toLowerCase().includes(q)
      );
    }
    if (options?.minPrice !== undefined) {
      items = items.filter(
        (item) => item.price_amount !== null && item.price_amount >= options.minPrice!
      );
    }
    if (options?.maxPrice !== undefined) {
      items = items.filter(
        (item) => item.price_amount !== null && item.price_amount <= options.maxPrice!
      );
    }

    if (options?.sortBy === 'price_asc') {
      items.sort((a, b) => (a.price_amount ?? 0) - (b.price_amount ?? 0));
    } else if (options?.sortBy === 'price_desc') {
      items.sort((a, b) => (b.price_amount ?? 0) - (a.price_amount ?? 0));
    }

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;
    return items.slice(offset, offset + limit);
  });
}

export async function getMarketplaceListing(
  actorUserId: string | null,
  circleId: string,
  listingId: string
): Promise<MarketplaceListingItem | null> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership } = await assertCommerceCapability(tx, circleId, actorUserId);
    if (
      !canReadCircleContent(circle.visibility, {
        userId: actorUserId,
        circleRole: membership?.role ?? null,
        membershipStatus: membership?.status ?? null,
      })
    ) {
      throw new ForbiddenError('You do not have permission to view listings in this Circle.');
    }

    const res = await tx.query<
      MarketplaceListingItem & {
        seller_username: string;
        seller_display_name: string;
        seller_avatar_url: string | null;
        viewer_has_saved: boolean;
      }
    >(
      `SELECT l.*,
         COALESCE(u.username, 'member') AS seller_username,
         COALESCE(u.display_name, 'Member') AS seller_display_name,
         u.avatar_url AS seller_avatar_url,
         EXISTS (
           SELECT 1 FROM public.marketplace_saved_listings s
           WHERE s.listing_id = l.id AND s.user_id = $3
         ) AS viewer_has_saved
       FROM public.marketplace_listings l
       LEFT JOIN public.profiles u ON u.id = l.seller_id
       WHERE l.circle_id = $1 AND l.id = $2
       LIMIT 1;`,
      [circleId, listingId, actorUserId]
    );

    const row = res.rows[0];
    if (!row) return null;
    return normalizeListingRow(row);
  });
}

export async function updateMarketplaceListing(
  actorUserId: string,
  circleId: string,
  listingId: string,
  input: z.input<typeof updateListingSchema>
): Promise<MarketplaceListingItem> {
  const parsed = updateListingSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const { membership } = await assertCommerceCapability(tx, circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Active Circle membership required.');
    }

    const existingRes = await tx.query<MarketplaceListingItem>(
      `SELECT * FROM public.marketplace_listings WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [listingId, circleId]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new NotFoundError('Listing not found in this Circle.');
    }

    const isStaff = ['owner', 'admin', 'moderator'].includes(membership.role);
    if (existing.seller_id !== actorUserId && !isStaff) {
      throw new ForbiddenError('Only the listing owner or a Circle moderator can modify this listing.');
    }

    await tx.query(
      `UPDATE public.marketplace_listings
       SET title = $1,
           description = $2,
           category = $3,
           price_amount = $4,
           pricing_unit = $5,
           condition = $6,
           location = $7,
           status = $8,
           image_urls = CASE WHEN $9::text IS NOT NULL THEN $9::jsonb ELSE image_urls END,
           availability_schedule = CASE WHEN $10::text IS NOT NULL THEN $10::jsonb ELSE availability_schedule END,
           is_instant_bookable = CASE WHEN $11::boolean IS NOT NULL THEN $11::boolean ELSE is_instant_bookable END,
           listing_type = COALESCE($12, listing_type),
           transaction_type = COALESCE($13, transaction_type),
           rate_interval = CASE WHEN $14::boolean THEN $15 ELSE rate_interval END,
           price_min = CASE WHEN $16::boolean THEN $17::numeric ELSE price_min END,
           price_max = CASE WHEN $18::boolean THEN $19::numeric ELSE price_max END,
           action_type = COALESCE($20, action_type),
           action_url = CASE WHEN $21::boolean THEN $22 ELSE action_url END,
           custom_fields = CASE WHEN $23::text IS NOT NULL THEN $23::jsonb ELSE custom_fields END,
           tags = CASE WHEN $24::text IS NOT NULL THEN $24::jsonb ELSE tags END,
           updated_at = NOW()
       WHERE id = $25 AND circle_id = $26;`,
      [
        parsed.title ?? existing.title,
        parsed.description ?? existing.description,
        parsed.category ?? existing.category,
        parsed.priceAmount !== undefined ? parsed.priceAmount : existing.price_amount,
        parsed.pricingUnit ?? existing.pricing_unit,
        parsed.condition !== undefined ? parsed.condition : existing.condition,
        parsed.location !== undefined ? parsed.location : existing.location,
        parsed.status ?? existing.status,
        parsed.imageUrls ? JSON.stringify(parsed.imageUrls) : null,
        parsed.availabilitySchedule !== undefined
          ? parsed.availabilitySchedule
            ? JSON.stringify(parsed.availabilitySchedule)
            : null
          : null,
        parsed.isInstantBookable !== undefined ? parsed.isInstantBookable : null,
        parsed.listingType ?? null,
        parsed.transactionType ?? null,
        parsed.rateInterval !== undefined,
        parsed.rateInterval ?? null,
        parsed.priceMin !== undefined,
        parsed.priceMin ?? null,
        parsed.priceMax !== undefined,
        parsed.priceMax ?? null,
        parsed.actionType ?? null,
        parsed.actionUrl !== undefined,
        parsed.actionUrl ?? null,
        parsed.customFields ? JSON.stringify(parsed.customFields) : null,
        parsed.tags ? JSON.stringify(parsed.tags) : null,
        listingId,
        circleId,
      ]
    );

    const fullRes = await tx.query<
      MarketplaceListingItem & {
        seller_username: string;
        seller_display_name: string;
        seller_avatar_url: string | null;
        viewer_has_saved: boolean;
      }
    >(
      `SELECT l.*,
         COALESCE(u.username, 'member') AS seller_username,
         COALESCE(u.display_name, 'Member') AS seller_display_name,
         u.avatar_url AS seller_avatar_url,
         EXISTS (
           SELECT 1 FROM public.marketplace_saved_listings s
           WHERE s.listing_id = l.id AND s.user_id = $2
         ) AS viewer_has_saved
       FROM public.marketplace_listings l
       LEFT JOIN public.profiles u ON u.id = l.seller_id
       WHERE l.id = $1 AND l.circle_id = $3
       LIMIT 1;`,
      [listingId, actorUserId, circleId]
    );

    return normalizeListingRow(fullRes.rows[0]);
  });
}

export async function toggleSavedListing(
  actorUserId: string,
  circleId: string,
  listingId: string
): Promise<{ saved: boolean }> {
  return withRlsTransaction(actorUserId, async (tx) => {
    await assertCommerceCapability(tx, circleId, actorUserId);

    const existing = await tx.query<{ id: string }>(
      `SELECT id FROM public.marketplace_saved_listings
       WHERE listing_id = $1 AND circle_id = $2 AND user_id = $3 LIMIT 1;`,
      [listingId, circleId, actorUserId]
    );

    if (existing.rows[0]) {
      await tx.query(`DELETE FROM public.marketplace_saved_listings WHERE id = $1;`, [
        existing.rows[0].id,
      ]);
      return { saved: false };
    }

    await tx.query(
      `INSERT INTO public.marketplace_saved_listings (id, circle_id, listing_id, user_id)
       VALUES ($1, $2, $3, $4);`,
      [crypto.randomUUID(), circleId, listingId, actorUserId]
    );
    return { saved: true };
  });
}

export async function createListingInquiry(
  actorUserId: string,
  circleId: string,
  listingId: string,
  input: z.input<typeof createInquirySchema>
): Promise<ListingInquiryItem> {
  const parsed = createInquirySchema.parse(input);

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership } = await assertCommerceCapability(tx, circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can contact listing sellers.');
    }

    const listingRes = await tx.query<MarketplaceListingItem>(
      `SELECT * FROM public.marketplace_listings WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [listingId, circleId]
    );
    const listing = listingRes.rows[0];
    if (!listing) {
      throw new NotFoundError('Listing not found in this Circle.');
    }

    if (listing.seller_id === actorUserId) {
      throw new ValidationError('You cannot submit an inquiry on your own listing.');
    }

    if (listing.status !== 'published' && listing.status !== 'reserved') {
      throw new ValidationError(`This listing is currently ${listing.status} and not accepting inquiries.`);
    }

    const inquiryRes = await tx.query<ListingInquiryItem>(
      `INSERT INTO public.listing_inquiries (
         id, circle_id, listing_id, buyer_id, seller_id, message, status
       ) VALUES ($1, $2, $3, $4, $5, $6, 'open')
       RETURNING *;`,
      [crypto.randomUUID(), circleId, listingId, actorUserId, listing.seller_id, parsed.message]
    );

    return {
      inquiry: inquiryRes.rows[0],
      listingTitle: listing.title,
      sellerId: listing.seller_id,
      circleSlug: circle.slug,
    };
  });

  await createNotification({
    recipientId: outcome.sellerId,
    actorId: actorUserId,
    circleId,
    eventType: 'listing_inquiry',
    title: `New Inquiry: ${outcome.listingTitle}`,
    body: parsed.message.slice(0, 140),
    linkUrl: `/circles/${outcome.circleSlug}/marketplace`,
  });

  return outcome.inquiry;
}

export async function respondToListingInquiry(
  actorUserId: string,
  circleId: string,
  inquiryId: string,
  input: z.input<typeof respondInquirySchema>
): Promise<ListingInquiryItem> {
  const parsed = respondInquirySchema.parse(input);

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership } = await assertCommerceCapability(tx, circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Active Circle membership required.');
    }

    const existingRes = await tx.query<ListingInquiryItem>(
      `SELECT * FROM public.listing_inquiries WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [inquiryId, circleId]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new NotFoundError('Inquiry not found.');
    }

    const isStaff = ['owner', 'admin', 'moderator'].includes(membership.role);
    if (existing.seller_id !== actorUserId && !isStaff) {
      throw new ForbiddenError('Only the listing seller or a moderator can respond to this inquiry.');
    }

    const updated = await tx.query<ListingInquiryItem>(
      `UPDATE public.listing_inquiries
       SET status = $1,
           seller_response = COALESCE($2, seller_response),
           updated_at = NOW()
       WHERE id = $3 AND circle_id = $4
       RETURNING *;`,
      [parsed.status, parsed.sellerResponse ?? null, inquiryId, circleId]
    );

    return {
      inquiry: updated.rows[0],
      circleSlug: circle.slug,
    };
  });

  await createNotification({
    recipientId: outcome.inquiry.buyer_id,
    actorId: actorUserId,
    circleId,
    eventType: 'listing_inquiry',
    title: `Inquiry Update (${outcome.inquiry.status})`,
    body: outcome.inquiry.seller_response ?? `Your inquiry status changed to ${outcome.inquiry.status}.`,
    linkUrl: `/circles/${outcome.circleSlug}/marketplace`,
  });

  return outcome.inquiry;
}

export async function listCircleInquiries(
  actorUserId: string,
  circleId: string
): Promise<ListingInquiryItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    await assertCommerceCapability(tx, circleId, actorUserId);

    const res = await tx.query<
      ListingInquiryItem & {
        listing_title: string;
        buyer_username: string;
        buyer_display_name: string;
        seller_username: string;
        seller_display_name: string;
      }
    >(
      `SELECT i.*,
         l.title AS listing_title,
         COALESCE(bu.username, 'buyer') AS buyer_username,
         COALESCE(bu.display_name, 'Buyer') AS buyer_display_name,
         COALESCE(su.username, 'seller') AS seller_username,
         COALESCE(su.display_name, 'Seller') AS seller_display_name
       FROM public.listing_inquiries i
       LEFT JOIN public.marketplace_listings l ON l.id = i.listing_id
       LEFT JOIN public.profiles bu ON bu.id = i.buyer_id
       LEFT JOIN public.profiles su ON su.id = i.seller_id
       WHERE i.circle_id = $1
       ORDER BY i.created_at DESC;`,
      [circleId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      circle_id: r.circle_id,
      listing_id: r.listing_id,
      listing_title: r.listing_title,
      buyer_id: r.buyer_id,
      seller_id: r.seller_id,
      message: r.message,
      seller_response: r.seller_response,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      buyer: {
        id: r.buyer_id,
        username: r.buyer_username,
        display_name: r.buyer_display_name,
      },
      seller: {
        id: r.seller_id,
        username: r.seller_username,
        display_name: r.seller_display_name,
      },
    }));
  });
}

export async function createServiceOrRentalBooking(
  actorUserId: string,
  circleId: string,
  listingId: string,
  input: z.input<typeof createBookingSchema>
): Promise<ServiceBookingItem> {
  const parsed = createBookingSchema.parse(input);
  if (new Date(parsed.endsAt).getTime() <= new Date(parsed.startsAt).getTime()) {
    throw new ValidationError('Booking end time must be after start time.');
  }

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership } = await assertCommerceCapability(tx, circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can request bookings or rentals.');
    }

    const listingRes = await tx.query<MarketplaceListingItem>(
      `SELECT * FROM public.marketplace_listings WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [listingId, circleId]
    );
    const listing = listingRes.rows[0];
    if (!listing) {
      throw new NotFoundError('Listing not found in this Circle.');
    }

    if (listing.seller_id === actorUserId) {
      throw new ValidationError('You cannot book or borrow your own listing.');
    }

    if (listing.status !== 'published') {
      throw new ValidationError(`This listing is currently ${listing.status} and unavailable for booking.`);
    }

    // Check if an approved booking already conflicts with the requested time window
    const conflictRes = await tx.query<{ id: string }>(
      `SELECT id FROM public.service_bookings
       WHERE listing_id = $1
         AND circle_id = $2
         AND status = 'approved'
         AND $3::timestamptz < ends_at
         AND $4::timestamptz > starts_at
       LIMIT 1;`,
      [listingId, circleId, parsed.startsAt, parsed.endsAt]
    );
    if (conflictRes.rows[0]) {
      throw new ConflictError(
        'Booking conflict: another approved booking or rental already overlaps this time window.'
      );
    }

    const bookingId = crypto.randomUUID();
    const calendarUid = `booking-${bookingId}@circles.dev`;
    const initialStatus = listing.is_instant_bookable ? 'approved' : 'pending';

    const bookingRes = await tx.query<ServiceBookingItem>(
      `INSERT INTO public.service_bookings (
         id, circle_id, listing_id, requester_id, provider_id,
         booking_type, starts_at, ends_at, notes, status, calendar_uid
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *;`,
      [
        bookingId,
        circleId,
        listingId,
        actorUserId,
        listing.seller_id,
        parsed.bookingType,
        parsed.startsAt,
        parsed.endsAt,
        parsed.notes,
        initialStatus,
        calendarUid,
      ]
    );

    return {
      booking: bookingRes.rows[0],
      listingTitle: listing.title,
      circleSlug: circle.slug,
      isInstant: Boolean(listing.is_instant_bookable),
    };
  });

  await createNotification({
    recipientId: outcome.booking.provider_id,
    actorId: actorUserId,
    circleId,
    eventType: 'booking_status',
    title: outcome.isInstant
      ? `Instant Booking Confirmed: ${outcome.listingTitle}`
      : `New ${parsed.bookingType === 'rental' ? 'Rental' : 'Service Booking'} Request: ${outcome.listingTitle}`,
    body: outcome.isInstant
      ? `A member booked ${outcome.listingTitle} from ${new Date(parsed.startsAt).toISOString().slice(0, 16)}.`
      : `A member requested ${outcome.listingTitle} from ${new Date(parsed.startsAt).toISOString().slice(0, 16)}.`,
    linkUrl: `/circles/${outcome.circleSlug}/marketplace`,
  });

  if (outcome.isInstant) {
    await createNotification({
      recipientId: actorUserId,
      actorId: outcome.booking.provider_id,
      circleId,
      eventType: 'booking_status',
      title: `Booking Confirmed: ${outcome.listingTitle}`,
      body: `Your booking for ${outcome.listingTitle} starting ${new Date(parsed.startsAt).toISOString().slice(0, 16)} was instantly confirmed!`,
      linkUrl: `/circles/${outcome.circleSlug}/marketplace`,
    });
  }

  return outcome.booking;

  return outcome.booking;
}

export async function updateServiceOrRentalBookingStatus(
  actorUserId: string,
  circleId: string,
  bookingId: string,
  input: z.input<typeof updateBookingSchema>
): Promise<ServiceBookingItem> {
  const parsed = updateBookingSchema.parse(input);

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const { circle, membership } = await assertCommerceCapability(tx, circleId, actorUserId);
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Active Circle membership required.');
    }

    const existingRes = await tx.query<ServiceBookingItem>(
      `SELECT * FROM public.service_bookings WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [bookingId, circleId]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new NotFoundError('Booking not found in this Circle.');
    }

    const isStaff = ['owner', 'admin', 'moderator'].includes(membership.role);
    const isProvider = existing.provider_id === actorUserId;
    const isRequester = existing.requester_id === actorUserId;

    if (parsed.status === 'cancelled') {
      if (!isRequester && !isProvider && !isStaff) {
        throw new ForbiddenError('Not authorized to cancel this booking.');
      }
    } else if (!isProvider && !isStaff) {
      throw new ForbiddenError(
        'Only the service/rental provider or a Circle moderator can approve, reject, complete, or mark returned.'
      );
    }

    try {
      const updatedRes = await tx.query<ServiceBookingItem>(
        `UPDATE public.service_bookings
         SET status = $1,
             provider_note = COALESCE($2, provider_note),
             returned_at = CASE WHEN $1 = 'returned' THEN NOW() ELSE returned_at END,
             updated_at = NOW()
         WHERE id = $3 AND circle_id = $4
         RETURNING *;`,
        [parsed.status, parsed.providerNote ?? null, bookingId, circleId]
      );

      return {
        booking: updatedRes.rows[0],
        circleSlug: circle.slug,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Booking conflict')) {
        throw new ConflictError(msg);
      }
      throw err;
    }
  });

  const targetRecipient =
    actorUserId === outcome.booking.provider_id
      ? outcome.booking.requester_id
      : outcome.booking.provider_id;

  await createNotification({
    recipientId: targetRecipient,
    actorId: actorUserId,
    circleId,
    eventType: 'booking_status',
    title: `Booking ${outcome.booking.status.toUpperCase()}`,
    body:
      outcome.booking.provider_note ??
      `Your ${outcome.booking.booking_type} request status is now ${outcome.booking.status}.`,
    linkUrl: `/circles/${outcome.circleSlug}/marketplace`,
  });

  return outcome.booking;
}

export async function listCircleBookings(
  actorUserId: string,
  circleId: string
): Promise<ServiceBookingItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    await assertCommerceCapability(tx, circleId, actorUserId);

    const res = await tx.query<
      ServiceBookingItem & {
        listing_title: string;
        requester_username: string;
        requester_display_name: string;
        provider_username: string;
        provider_display_name: string;
      }
    >(
      `SELECT b.*,
         l.title AS listing_title,
         COALESCE(ru.username, 'requester') AS requester_username,
         COALESCE(ru.display_name, 'Requester') AS requester_display_name,
         COALESCE(pu.username, 'provider') AS provider_username,
         COALESCE(pu.display_name, 'Provider') AS provider_display_name
       FROM public.service_bookings b
       LEFT JOIN public.marketplace_listings l ON l.id = b.listing_id
       LEFT JOIN public.profiles ru ON ru.id = b.requester_id
       LEFT JOIN public.profiles pu ON pu.id = b.provider_id
       WHERE b.circle_id = $1
       ORDER BY b.starts_at ASC;`,
      [circleId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      circle_id: r.circle_id,
      listing_id: r.listing_id,
      listing_title: r.listing_title,
      requester_id: r.requester_id,
      provider_id: r.provider_id,
      booking_type: r.booking_type,
      starts_at: r.starts_at,
      ends_at: r.ends_at,
      notes: r.notes,
      status: r.status,
      provider_note: r.provider_note,
      returned_at: r.returned_at,
      calendar_uid: (r as unknown as { calendar_uid?: string | null }).calendar_uid ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
      requester: {
        id: r.requester_id,
        username: r.requester_username,
        display_name: r.requester_display_name,
      },
      provider: {
        id: r.provider_id,
        username: r.provider_username,
        display_name: r.provider_display_name,
      },
    }));
  });
}

export async function getCircleMarketplaceSettings(
  actorUserId: string | null,
  circleId: string
): Promise<Required<MarketplaceCircleSettings>> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const { marketplaceSettings } = await assertCommerceCapability(tx, circleId, actorUserId);
    return marketplaceSettings;
  });
}

export async function checkoutMarketplaceListing(
  actorUserId: string,
  circleId: string,
  listingId: string,
  input?: z.input<typeof checkoutListingSchema>
): Promise<{
  order: MarketplaceOrderItem;
  updatedListing: MarketplaceListingItem;
}> {
  const parsed = checkoutListingSchema.parse(input ?? {});

  const outcome = await withServiceRoleTransaction(async (tx) => {
    const { circle, membership, marketplaceSettings } = await assertCommerceCapability(
      tx,
      circleId,
      actorUserId
    );

    if (
      !canReadCircleContent(circle.visibility, {
        userId: actorUserId,
        circleRole: membership?.role ?? null,
        membershipStatus: membership?.status ?? null,
      })
    ) {
      throw new ForbiddenError('You do not have permission to purchase listings in this Circle.');
    }

    const listingRes = await tx.query<MarketplaceListingItem>(
      `SELECT * FROM public.marketplace_listings WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [listingId, circleId]
    );
    const listing = listingRes.rows[0];
    if (!listing) {
      throw new NotFoundError('Listing not found in this Circle.');
    }
    if (listing.status !== 'published') {
      throw new ValidationError('This listing is no longer available for purchase.');
    }
    if (listing.seller_id === actorUserId) {
      throw new ValidationError('You cannot purchase your own listing.');
    }

    const priceAmount = Number(listing.price_amount ?? 0);
    if (!priceAmount || priceAmount <= 0) {
      throw new ValidationError('Only priced listings can be purchased via checkout.');
    }

    const grossAmountCents = Math.round(priceAmount * 100);
    const feeBreakdown = calculatePlatformFee(
      circle.plan_tier || 'free',
      grossAmountCents,
      circle.custom_platform_fee_percentage
    );
    const platformFeeCents = feeBreakdown.feeCents;
    const rawCommissionCents = Math.round(
      grossAmountCents * (marketplaceSettings.commissionPercentage / 100)
    );
    const circleCommissionCents = Math.min(
      Math.max(0, grossAmountCents - platformFeeCents),
      rawCommissionCents
    );
    const sellerNetCents = Math.max(
      0,
      grossAmountCents - platformFeeCents - circleCommissionCents
    );

    const orderId = crypto.randomUUID();
    const paymentRef = `BACHS-MKT-${orderId.slice(0, 8).toUpperCase()}`;

    const orderRes = await tx.query<MarketplaceOrderItem>(
      `INSERT INTO public.marketplace_orders (
         id, circle_id, listing_id, buyer_id, seller_id,
         gross_amount_cents, platform_fee_cents, circle_commission_cents, seller_net_cents,
         currency, payment_method, payment_reference, buyer_note, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'completed')
       RETURNING *;`,
      [
        orderId,
        circleId,
        listing.id,
        actorUserId,
        listing.seller_id,
        grossAmountCents,
        platformFeeCents,
        circleCommissionCents,
        sellerNetCents,
        listing.price_currency,
        parsed.paymentMethod,
        paymentRef,
        parsed.buyerNote,
      ]
    );

    // Credit Seller's Member Wallet
    if (sellerNetCents > 0) {
      await tx.query(
        `INSERT INTO public.member_wallet_transactions (
           id, user_id, circle_id, order_id, entry_type,
           amount_cents, currency, description, status
         ) VALUES ($1, $2, $3, $4, 'sale_credit', $5, $6, $7, 'completed');`,
        [
          crypto.randomUUID(),
          listing.seller_id,
          circleId,
          orderId,
          sellerNetCents,
          listing.price_currency,
          `Sale of "${listing.title}"`,
        ]
      );
    }

    // Credit Circle Admin Treasury if commission > 0
    if (circleCommissionCents > 0) {
      await tx.query(
        `INSERT INTO public.community_treasury_ledger (
           id, circle_id, entry_type, category, amount_cents, currency,
           description, is_public_to_members, recorded_by, metadata
         ) VALUES ($1, $2, 'revenue', 'other', $3, $4, $5, true, $6, $7::jsonb);`,
        [
          crypto.randomUUID(),
          circleId,
          circleCommissionCents,
          listing.price_currency,
          `Marketplace commission (${marketplaceSettings.commissionPercentage}%): ${listing.title}`,
          actorUserId,
          JSON.stringify({
            order_id: orderId,
            listing_id: listing.id,
            gross_amount_cents: grossAmountCents,
            platform_fee_cents: platformFeeCents,
            seller_net_cents: sellerNetCents,
          }),
        ]
      );
    }

    // Auto-mark physical/item listings as sold
    const shouldMarkSold = listing.listing_type === 'product' || listing.transaction_type === 'fixed';
    const nextStatus = shouldMarkSold ? 'sold' : listing.status;
    const updatedRes = await tx.query<MarketplaceListingItem>(
      `UPDATE public.marketplace_listings
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND circle_id = $3
       RETURNING *;`,
      [nextStatus, listing.id, circleId]
    );

    const rawOrder = orderRes.rows[0];
    return {
      order: {
        ...rawOrder,
        listing_title: listing.title,
        gross_amount_cents: Number(rawOrder.gross_amount_cents),
        platform_fee_cents: Number(rawOrder.platform_fee_cents),
        circle_commission_cents: Number(rawOrder.circle_commission_cents),
        seller_net_cents: Number(rawOrder.seller_net_cents),
      },
      updatedListing: normalizeListingRow(updatedRes.rows[0]),
      circleSlug: circle.slug,
    };
  });

  await createNotification({
    recipientId: outcome.order.seller_id,
    actorId: actorUserId,
    circleId,
    eventType: 'listing_inquiry',
    title: `Listing Sold: ${outcome.updatedListing.title}`,
    body: `Your listing "${outcome.updatedListing.title}" was purchased on-platform and funds have been credited to your Member Wallet.`,
    linkUrl: `/circles/${outcome.circleSlug}/marketplace`,
  });

  return {
    order: outcome.order,
    updatedListing: outcome.updatedListing,
  };
}

export async function getMemberWalletSummary(actorUserId: string): Promise<{
  balances: MemberWalletBalanceItem[];
  transactions: MemberWalletTransactionItem[];
}> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<MemberWalletTransactionItem>(
      `SELECT * FROM public.member_wallet_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100;`,
      [actorUserId]
    );

    const transactions: MemberWalletTransactionItem[] = res.rows.map((r) => ({
      ...r,
      amount_cents: Number(r.amount_cents),
    }));

    const byCurrency = new Map<
      string,
      { earned: number; withdrawn: number }
    >();

    for (const t of transactions) {
      if (t.status === 'rejected') continue;
      const cur = t.currency.toUpperCase();
      const entry = byCurrency.get(cur) ?? { earned: 0, withdrawn: 0 };
      if (t.entry_type === 'sale_credit') {
        entry.earned += t.amount_cents;
      } else if (t.entry_type === 'withdrawal' || t.entry_type === 'refund_debit') {
        entry.withdrawn += t.amount_cents;
      }
      byCurrency.set(cur, entry);
    }

    const balances: MemberWalletBalanceItem[] = Array.from(byCurrency.entries()).map(
      ([currency, { earned, withdrawn }]) => ({
        currency,
        available_cents: Math.max(0, earned - withdrawn),
        total_earned_cents: earned,
        total_withdrawn_cents: withdrawn,
      })
    );

    return { balances, transactions };
  });
}

export async function requestMemberWalletWithdrawal(
  actorUserId: string,
  input: z.input<typeof withdrawWalletSchema>
): Promise<MemberWalletTransactionItem> {
  const parsed = withdrawWalletSchema.parse(input);
  const summary = await getMemberWalletSummary(actorUserId);
  const bal = summary.balances.find((b) => b.currency === parsed.currency);
  if (!bal || bal.available_cents < parsed.amountCents) {
    throw new ValidationError(
      `Insufficient ${parsed.currency} wallet balance for this withdrawal.`
    );
  }

  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<MemberWalletTransactionItem>(
      `INSERT INTO public.member_wallet_transactions (
         id, user_id, entry_type, amount_cents, currency,
         description, payout_destination, status
       ) VALUES ($1, $2, 'withdrawal', $3, $4, $5, $6, 'completed')
       RETURNING *;`,
      [
        crypto.randomUUID(),
        actorUserId,
        parsed.amountCents,
        parsed.currency,
        `Payout to ${parsed.payoutDestination}`,
        parsed.payoutDestination,
      ]
    );
    const row = res.rows[0];
    return {
      ...row,
      amount_cents: Number(row.amount_cents),
    };
  });
}

export { generateAvailableSlots, generateBookingIcs } from '@/features/marketplace/calendar-utils';
