import { beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { registerUser } from '@/features/auth/service';
import { createCircle } from '@/features/circles/service';
import { runDatabaseMigrations, withRlsTransaction } from '@/lib/db/postgres';
import {
  getCircleTierInfo,
  getUserCommunityQuota,
  createPlatformTierCheckoutSession,
  confirmPlatformTierPayment,
  PLATFORM_TIERS,
} from '@/features/finances/platform-fees';
import { GET as accountSubscriptionGet, POST as accountSubscriptionPost } from '@/app/api/account/subscription/route';
import { GET as financesGetRoute } from '@/app/api/circles/[circleId]/finances/route';

function makeRequest(url: string, method: string, body?: unknown, token?: string): NextRequest {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:3000',
    'Host': 'localhost:3000',
  });
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('All-in-One Account Subscriptions & Community Quotas', () => {
  beforeAll(async () => {
    await runDatabaseMigrations();
  });

  it('1. Enforces Free tier community quota and reports accurate slot usage', async () => {
    const { user: creator } = await registerUser({
      email: `creator-quota-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `quota_${Date.now()}`,
      displayName: 'Quota Creator',
    });

    // Check initial quota on Free tier
    const initialQuota = await withRlsTransaction(creator.id, async (tx) => {
      return getUserCommunityQuota(tx, creator.id);
    });

    expect(initialQuota.subscriptionTier).toBe('free');
    expect(initialQuota.ownedCount).toBe(0);
    expect(initialQuota.maxCommunitiesAllowed).toBe(3);
    expect(initialQuota.canCreateMore).toBe(true);

    // Create 3 communities (max allowed on Free tier)
    const circle1 = await createCircle(creator.id, {
      name: `Circle 1 ${Date.now()}`,
      slug: `c1-${Date.now()}`,
      category: 'creator',
    });
    const circle2 = await createCircle(creator.id, {
      name: `Circle 2 ${Date.now()}`,
      slug: `c2-${Date.now()}`,
      category: 'creator',
    });
    const circle3 = await createCircle(creator.id, {
      name: `Circle 3 ${Date.now()}`,
      slug: `c3-${Date.now()}`,
      category: 'creator',
    });

    expect(circle1.id).toBeDefined();
    expect(circle2.id).toBeDefined();
    expect(circle3.id).toBeDefined();

    // Check quota after creating 3 communities
    const fullQuota = await withRlsTransaction(creator.id, async (tx) => {
      return getUserCommunityQuota(tx, creator.id);
    });

    expect(fullQuota.ownedCount).toBe(3);
    expect(fullQuota.canCreateMore).toBe(false);

    // Attempting to create a 4th community on Free tier must be blocked
    await expect(
      createCircle(creator.id, {
        name: `Circle 4 Exceeded ${Date.now()}`,
        slug: `c4-${Date.now()}`,
        category: 'creator',
      })
    ).rejects.toThrow(/You have reached the maximum of 3 communities/);
  });

  it('2. Upgrading to All-in-One Pro plan unlocks 10 communities and propagates to all owned circles', async () => {
    const { user: creator, sessionToken } = await registerUser({
      email: `creator-pro-${Date.now()}@test.local`,
      password: 'Password123!',
      username: `allinone_${Date.now()}`,
      displayName: 'All-In-One Pro Creator',
    });

    // Create 2 initial circles on Free tier
    const circleA = await createCircle(creator.id, {
      name: `Circle A ${Date.now()}`,
      slug: `ca-${Date.now()}`,
      category: 'creator',
    });
    const circleB = await createCircle(creator.id, {
      name: `Circle B ${Date.now()}`,
      slug: `cb-${Date.now()}`,
      category: 'creator',
    });

    // Verify initial circles have Free tier attributes
    const tierInfoBefore = await withRlsTransaction(creator.id, async (tx) => {
      return getCircleTierInfo(tx, circleA.id);
    });
    expect(tierInfoBefore.planTier).toBe('free');

    // Initiate All-in-One upgrade checkout session (e.g. from Circle A studio or account)
    const checkoutSession = await createPlatformTierCheckoutSession(
      creator.id,
      circleA.id,
      'pro',
      'USD',
      'http://localhost:3000',
      'account'
    );

    expect(checkoutSession.targetTier).toBe('pro');
    expect(checkoutSession.invoiceId).toBeDefined();

    // Confirm payment (simulates webhook or payment confirmation)
    const activation = await confirmPlatformTierPayment(
      creator.id,
      circleA.id,
      checkoutSession.invoiceId,
      `BACHS_SIM_${Date.now()}`
    );

    expect(activation.success).toBe(true);
    expect(activation.tier).toBe('pro');

    // Verify ALL communities owned by this creator now inherit the Pro tier
    const tierA = await withRlsTransaction(creator.id, async (tx) => {
      return getCircleTierInfo(tx, circleA.id);
    });
    const tierB = await withRlsTransaction(creator.id, async (tx) => {
      return getCircleTierInfo(tx, circleB.id);
    });

    expect(tierA.planTier).toBe('pro');
    expect(tierB.planTier).toBe('pro');

    // Verify account quota now allows up to 10 communities
    const proQuota = await withRlsTransaction(creator.id, async (tx) => {
      return getUserCommunityQuota(tx, creator.id);
    });
    expect(proQuota.subscriptionTier).toBe('pro');
    expect(proQuota.maxCommunitiesAllowed).toBe(10);
    expect(proQuota.ownedCount).toBe(2);
    expect(proQuota.canCreateMore).toBe(true);

    // Creator can now create additional communities without paying extra
    const circleC = await createCircle(creator.id, {
      name: `Circle C Under Pro ${Date.now()}`,
      slug: `cc-${Date.now()}`,
      category: 'creator',
    });
    expect(circleC.id).toBeDefined();

    const tierC = await withRlsTransaction(creator.id, async (tx) => {
      return getCircleTierInfo(tx, circleC.id);
    });
    expect(tierC.planTier).toBe('pro');

    // Verify via HTTP API endpoint (/api/account/subscription)
    const req = makeRequest('http://localhost:3000/api/account/subscription', 'GET', undefined, sessionToken);
    const res = await accountSubscriptionGet(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quota.subscriptionTier).toBe('pro');
    expect(body.quota.ownedCount).toBe(3);
    expect(body.quota.maxCommunitiesAllowed).toBe(10);
    expect(body.tiers.pro.monthlyPriceUsd).toBe(50);
  });
});
