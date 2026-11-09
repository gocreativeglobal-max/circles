import { withServiceRoleTransaction } from '@/lib/db/postgres';
import { ForbiddenError } from '@/lib/errors';

export interface PlatformFeatureFlags {
  custom_features_builder: boolean;
  global_public_feed: boolean;
  marketplace_checkout: boolean;
  causes_crowdfunding: boolean;
  allow_circle_creation: boolean;
}

export const DEFAULT_PLATFORM_FEATURE_FLAGS: PlatformFeatureFlags = {
  custom_features_builder: false,
  global_public_feed: true,
  marketplace_checkout: true,
  causes_crowdfunding: true,
  allow_circle_creation: true,
};

export interface CentralAdminCircleRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  visibility: string;
  member_count: number;
  post_count: number;
  created_at: string;
}

export interface CentralAdminUserRow {
  id: string;
  username: string;
  display_name: string;
  email: string;
  is_platform_admin: boolean;
  circle_count: number;
  created_at: string;
}

export interface CentralAdminStats {
  totalUsers: number;
  totalCircles: number;
  totalPosts: number;
  totalListings: number;
  totalOrders: number;
  totalCauses: number;
  openReports: number;
}

export async function getPlatformFeatureFlags(): Promise<PlatformFeatureFlags> {
  return withServiceRoleTransaction(async (tx) => {
    try {
      const res = await tx.query<{ value: Partial<PlatformFeatureFlags> }>(
        `SELECT value FROM public.platform_settings WHERE key = 'feature_flags' LIMIT 1;`
      );
      const val = res.rows[0]?.value ?? {};
      return {
        custom_features_builder: Boolean(val.custom_features_builder ?? false),
        global_public_feed: val.global_public_feed !== false,
        marketplace_checkout: val.marketplace_checkout !== false,
        causes_crowdfunding: val.causes_crowdfunding !== false,
        allow_circle_creation: val.allow_circle_creation !== false,
      };
    } catch {
      return DEFAULT_PLATFORM_FEATURE_FLAGS;
    }
  });
}

export async function ensureOrVerifyPlatformAdmin(actorUserId: string): Promise<boolean> {
  return withServiceRoleTransaction(async (tx) => {
    // 1. Check authoritative platform_roles table (aligned with PostgreSQL RLS is_platform_admin function)
    const userRes = await tx.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM public.platform_roles
         WHERE user_id = $1 AND role IN ('platform_admin', 'trust_safety')
       ) AS exists;`,
      [actorUserId]
    );
    if (userRes.rows[0]?.exists) {
      return true;
    }

    // 2. Check explicitly configured PLATFORM_ADMIN_EMAIL environment variable
    const adminEmail = (process.env.PLATFORM_ADMIN_EMAIL || '').trim().toLowerCase();
    if (adminEmail) {
      const emailCheck = await tx.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM public.profiles
           WHERE id = $1 AND LOWER(email) = $2
         ) AS exists;`,
        [actorUserId, adminEmail]
      );
      if (emailCheck.rows[0]?.exists) {
        await tx.query(
          `INSERT INTO public.platform_roles (user_id, role)
           VALUES ($1, 'platform_admin')
           ON CONFLICT (user_id) DO UPDATE SET role = 'platform_admin';`,
          [actorUserId]
        );
        return true;
      }
    }

    return false;
  });
}

export async function getCentralAdminDashboardData(actorUserId: string): Promise<{
  isPlatformAdmin: boolean;
  stats: CentralAdminStats;
  featureFlags: PlatformFeatureFlags;
  circles: CentralAdminCircleRow[];
  users: CentralAdminUserRow[];
}> {
  const isAdmin = await ensureOrVerifyPlatformAdmin(actorUserId);
  const featureFlags = await getPlatformFeatureFlags();

  if (!isAdmin) {
    return {
      isPlatformAdmin: false,
      stats: {
        totalUsers: 0,
        totalCircles: 0,
        totalPosts: 0,
        totalListings: 0,
        totalOrders: 0,
        totalCauses: 0,
        openReports: 0,
      },
      featureFlags,
      circles: [],
      users: [],
    };
  }

  return withServiceRoleTransaction(async (tx) => {
    const [usersCnt, circlesCnt, postsCnt, listingsCnt, causesCnt, reportsCnt] =
      await Promise.all([
        tx.query<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM public.profiles;`),
        tx.query<{ cnt: number }>(`SELECT COUNT(*)::int AS cnt FROM public.circles;`),
        tx.query<{ cnt: number }>(
          `SELECT COUNT(*)::int AS cnt FROM public.posts WHERE status <> 'removed';`
        ),
        tx.query<{ cnt: number }>(
          `SELECT COUNT(*)::int AS cnt FROM public.marketplace_listings;`
        ),
        tx.query<{ cnt: number }>(
          `SELECT COUNT(*)::int AS cnt FROM public.fundraising_campaigns;`
        ),
        tx.query<{ cnt: number }>(
          `SELECT COUNT(*)::int AS cnt FROM public.content_reports WHERE status = 'open';`
        ),
      ]);

    let ordersCount = 0;
    try {
      const ordRes = await tx.query<{ cnt: number }>(
        `SELECT COUNT(*)::int AS cnt FROM public.marketplace_orders;`
      );
      ordersCount = ordRes.rows[0]?.cnt ?? 0;
    } catch {
      ordersCount = 0;
    }

    const circlesRes = await tx.query<CentralAdminCircleRow>(
      `SELECT c.id, c.name, c.slug, c.category, c.visibility, c.created_at,
         (SELECT COUNT(*)::int FROM public.circle_memberships m WHERE m.circle_id = c.id AND m.status = 'active') AS member_count,
         (SELECT COUNT(*)::int FROM public.posts p WHERE p.circle_id = c.id AND p.status <> 'removed') AS post_count
       FROM public.circles c
       ORDER BY c.created_at DESC
       LIMIT 100;`
    );

    const usersRes = await tx.query<CentralAdminUserRow>(
      `SELECT u.id, u.username, u.display_name, u.email,
         EXISTS (
           SELECT 1 FROM public.platform_roles pr
           WHERE pr.user_id = u.id AND pr.role IN ('platform_admin', 'trust_safety')
         ) AS is_platform_admin,
         u.created_at,
         (SELECT COUNT(*)::int FROM public.circle_memberships m WHERE m.user_id = u.id AND m.status = 'active') AS circle_count
       FROM public.profiles u
       ORDER BY is_platform_admin DESC, u.created_at DESC
       LIMIT 100;`
    );

    return {
      isPlatformAdmin: true,
      stats: {
        totalUsers: usersCnt.rows[0]?.cnt ?? 0,
        totalCircles: circlesCnt.rows[0]?.cnt ?? 0,
        totalPosts: postsCnt.rows[0]?.cnt ?? 0,
        totalListings: listingsCnt.rows[0]?.cnt ?? 0,
        totalOrders: ordersCount,
        totalCauses: causesCnt.rows[0]?.cnt ?? 0,
        openReports: reportsCnt.rows[0]?.cnt ?? 0,
      },
      featureFlags,
      circles: circlesRes.rows,
      users: usersRes.rows,
    };
  });
}

export async function updatePlatformFeatureFlags(
  actorUserId: string,
  updates: Partial<PlatformFeatureFlags>
): Promise<PlatformFeatureFlags> {
  const isAdmin = await ensureOrVerifyPlatformAdmin(actorUserId);
  if (!isAdmin) {
    throw new ForbiddenError('Only Circles Central Administrators can update global feature flags.');
  }

  const current = await getPlatformFeatureFlags();
  const nextFlags: PlatformFeatureFlags = {
    ...current,
    ...updates,
  };

  return withServiceRoleTransaction(async (tx) => {
    await tx.query(
      `INSERT INTO public.platform_settings (key, value, updated_by, updated_at)
       VALUES ('feature_flags', $1::jsonb, $2, NOW())
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW();`,
      [JSON.stringify(nextFlags), actorUserId]
    );
    return nextFlags;
  });
}

export async function toggleUserPlatformAdmin(
  actorUserId: string,
  targetUserId: string,
  makeAdmin: boolean
): Promise<void> {
  const isAdmin = await ensureOrVerifyPlatformAdmin(actorUserId);
  if (!isAdmin) {
    throw new ForbiddenError('Only Circles Central Administrators can manage admin roles.');
  }

  await withServiceRoleTransaction(async (tx) => {
    if (makeAdmin) {
      await tx.query(
        `INSERT INTO public.platform_roles (user_id, role)
         VALUES ($1, 'platform_admin')
         ON CONFLICT (user_id) DO UPDATE SET role = 'platform_admin';`,
        [targetUserId]
      );
    } else {
      await tx.query(
        `DELETE FROM public.platform_roles WHERE user_id = $1;`,
        [targetUserId]
      );
    }
  });
}

export async function deleteCircleAsCentralAdmin(
  actorUserId: string,
  circleId: string
): Promise<void> {
  const isAdmin = await ensureOrVerifyPlatformAdmin(actorUserId);
  if (!isAdmin) {
    throw new ForbiddenError('Only Circles Central Administrators can delete communities.');
  }

  await withServiceRoleTransaction(async (tx) => {
    await tx.query(`DELETE FROM public.circles WHERE id = $1;`, [circleId]);
  });
}
