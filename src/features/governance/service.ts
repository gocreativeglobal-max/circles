import crypto from 'crypto';
import { z } from 'zod';
import { withRlsTransaction } from '@/lib/db/postgres';
import {
  ChallengeSubmissionItem,
  CircleRole,
  CommunityChallengeItem,
  FundraisingCampaignItem,
  FundraisingPledgeItem,
  GovernanceProposalItem,
  MembershipStatus,
  SupportTicketItem,
} from '@/types/domain';
import {
  CapabilityDisabledError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/errors';
import { createNotification } from '@/features/notifications/service';

export const createGovernanceProposalSchema = z.object({
  circleId: z.string().uuid(),
  committeeName: z.string().trim().max(120).nullable().optional(),
  title: z.string().trim().min(3).max(180),
  body: z.string().trim().min(5).max(10000),
});

export const decideGovernanceProposalSchema = z.object({
  status: z.enum(['under_review', 'approved', 'rejected', 'implemented', 'archived']),
  decisionRationale: z.string().trim().min(2).max(2000).optional(),
});

export const createFundraisingCampaignSchema = z.object({
  circleId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(5).max(6000),
  category: z
    .enum(['community_project', 'mutual_aid', 'scholarship', 'charity', 'event_sponsorship'])
    .default('community_project'),
  imageUrl: z.string().trim().max(2000).nullable().optional(),
  causeType: z.enum(['official', 'member']).optional(),
  beneficiaryName: z.string().trim().max(120).nullable().optional(),
  milestones: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        amount: z.number().nonnegative(),
      })
    )
    .max(10)
    .default([]),
  goalAmount: z.number().positive().max(100000000),
  currency: z.string().trim().min(3).max(4).default('USD'),
  deadline: z.string().nullable().optional(),
});

export const createFundraisingPledgeSchema = z.object({
  pledgeAmount: z.number().positive().max(10000000),
  message: z.string().trim().max(500).default(''),
  donorName: z.string().trim().max(120).optional(),
  donorEmail: z.string().trim().max(200).optional(),
  isAnonymous: z.boolean().default(false),
  paymentMethod: z.enum(['card', 'wallet', 'bank_transfer']).default('card'),
});

export const updateFundraisingCampaignSchema = z.object({
  status: z.enum(['active', 'completed', 'closed', 'rejected']).optional(),
  updateBody: z.string().trim().min(2).max(2000).optional(),
});

export const createChallengeSchema = z.object({
  circleId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(5).max(4000),
  rules: z.string().trim().max(2000).default(''),
  rewardBadgeName: z.string().trim().min(2).max(80).default('Challenger'),
  rewardPoints: z.number().int().min(0).max(10000).default(50),
  endsAt: z.string().datetime().nullable().optional(),
});

export const submitChallengeEntrySchema = z.object({
  submissionText: z.string().trim().min(2).max(4000),
  proofUrl: z.string().url().nullable().optional(),
});

export const reviewChallengeSubmissionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  awardedPoints: z.number().int().min(0).max(10000).optional(),
  awardedBadge: z.string().trim().max(80).nullable().optional(),
});

export const createSupportTicketSchema = z.object({
  circleId: z.string().uuid(),
  category: z
    .enum(['general', 'technical', 'membership', 'mutual_aid', 'facilities'])
    .default('general'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  isPrivate: z.boolean().default(true),
  subject: z.string().trim().min(3).max(180),
  description: z.string().trim().min(5).max(6000),
});

export const updateSupportTicketSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  resolutionNotes: z.string().trim().max(4000).nullable().optional(),
});

// ============================================================================
// 1. GOVERNANCE PROPOSALS & COMMITTEES
// ============================================================================

export async function createGovernanceProposal(
  actorUserId: string,
  input: z.input<typeof createGovernanceProposalSchema>
): Promise<GovernanceProposalItem> {
  const parsed = createGovernanceProposalSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'governance_committees' AND enabled = true LIMIT 1;`,
      [parsed.circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('governance_committees');
    }

    const inserted = await tx.query<GovernanceProposalItem>(
      `INSERT INTO public.governance_proposals (
         id, circle_id, proposer_id, committee_name, title, body, status
       ) VALUES ($1, $2, $3, $4, $5, $6, 'under_review')
       RETURNING *;`,
      [
        crypto.randomUUID(),
        parsed.circleId,
        actorUserId,
        parsed.committeeName ?? null,
        parsed.title,
        parsed.body,
      ]
    );

    return inserted.rows[0];
  });
}

export async function decideGovernanceProposal(
  actorUserId: string,
  circleId: string,
  proposalId: string,
  input: z.input<typeof decideGovernanceProposalSchema>
): Promise<GovernanceProposalItem> {
  const parsed = decideGovernanceProposalSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const membership = memRes.rows[0];
    if (!membership || membership.status !== 'active' || !['owner', 'admin'].includes(membership.role)) {
      throw new ForbiddenError(
        'Only Circle administrators or owners can record official governance decisions.'
      );
    }

    const updated = await tx.query<GovernanceProposalItem>(
      `UPDATE public.governance_proposals
       SET status = $1,
           decision_rationale = COALESCE($2, decision_rationale),
           decided_by = $3,
           decided_at = NOW(),
           updated_at = NOW()
       WHERE id = $4 AND circle_id = $5
       RETURNING *;`,
      [parsed.status, parsed.decisionRationale ?? null, actorUserId, proposalId, circleId]
    );

    if (!updated.rows[0]) {
      throw new NotFoundError('Governance proposal not found.');
    }

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'governance.decision_recorded', 'governance_proposal', $4, $5::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        proposalId,
        JSON.stringify({ status: parsed.status, rationale: parsed.decisionRationale }),
      ]
    );

    return updated.rows[0];
  });
}

export async function listGovernanceProposals(
  actorUserId: string | null,
  circleId: string
): Promise<GovernanceProposalItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'governance_committees' AND enabled = true LIMIT 1;`,
      [circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('governance_committees');
    }

    const res = await tx.query<
      GovernanceProposalItem & {
        proposer_username: string;
        proposer_display_name: string;
      }
    >(
      `SELECT g.*,
         COALESCE(u.username, 'member') AS proposer_username,
         COALESCE(u.display_name, 'Member') AS proposer_display_name
       FROM public.governance_proposals g
       LEFT JOIN public.profiles u ON u.id = g.proposer_id
       WHERE g.circle_id = $1
       ORDER BY g.created_at DESC;`,
      [circleId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      circle_id: r.circle_id,
      proposer_id: r.proposer_id,
      committee_name: r.committee_name,
      title: r.title,
      body: r.body,
      status: r.status,
      decision_rationale: r.decision_rationale,
      decided_by: r.decided_by,
      decided_at: r.decided_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      proposer: {
        id: r.proposer_id,
        username: r.proposer_username,
        display_name: r.proposer_display_name,
      },
    }));
  });
}

// ============================================================================
// 2. FUNDRAISING CAMPAIGNS, MEMBER CAUSES & ON-PLATFORM DONATIONS
// ============================================================================

export async function createFundraisingCampaign(
  actorUserId: string,
  input: z.input<typeof createFundraisingCampaignSchema>
): Promise<FundraisingCampaignItem> {
  const parsed = createFundraisingCampaignSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean; settings: Record<string, unknown> }>(
      `SELECT enabled, settings FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'fundraising_causes' AND enabled = true LIMIT 1;`,
      [parsed.circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('fundraising_causes');
    }

    const capSettings = capRes.rows[0].settings ?? {};
    const creationPolicy = String(capSettings.creationPolicy || 'members_with_approval');
    const defaultCurrency = String(capSettings.defaultCurrency || 'USD').toUpperCase();

    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [parsed.circleId, actorUserId]
    );
    const membership = memRes.rows[0];
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can create a cause.');
    }

    const isStaff = ['owner', 'admin', 'moderator'].includes(membership.role);
    if (!isStaff && creationPolicy === 'admins_only') {
      throw new ForbiddenError(
        'Only Circle administrators or moderators can launch fundraising causes in this community.'
      );
    }

    const causeType: 'official' | 'member' = isStaff
      ? parsed.causeType ?? 'official'
      : 'member';

    const initialStatus =
      isStaff || creationPolicy === 'all_members' ? 'active' : 'pending_approval';

    const currencyCode = (parsed.currency || defaultCurrency).toUpperCase();

    const res = await tx.query<FundraisingCampaignItem>(
      `INSERT INTO public.fundraising_campaigns (
         id, circle_id, creator_id, title, description, category, image_url,
         cause_type, beneficiary_name, milestones, updates,
         goal_amount, currency, deadline, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, '[]'::jsonb, $11, $12, $13, $14)
       RETURNING *;`,
      [
        crypto.randomUUID(),
        parsed.circleId,
        actorUserId,
        parsed.title,
        parsed.description,
        parsed.category,
        parsed.imageUrl ?? null,
        causeType,
        parsed.beneficiaryName ?? null,
        JSON.stringify(parsed.milestones ?? []),
        parsed.goalAmount,
        currencyCode,
        parsed.deadline ? new Date(parsed.deadline).toISOString() : null,
        initialStatus,
      ]
    );

    const row = res.rows[0];
    return {
      ...row,
      goal_amount: Number(row.goal_amount),
      pledged_total: 0,
      pledge_count: 0,
      recent_donations: [],
    };
  });
}

export async function createFundraisingPledge(
  actorUserId: string | null,
  circleId: string,
  campaignId: string,
  input: z.input<typeof createFundraisingPledgeSchema>
): Promise<FundraisingPledgeItem> {
  const parsed = createFundraisingPledgeSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean; settings: Record<string, unknown> }>(
      `SELECT enabled, settings FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'fundraising_causes' AND enabled = true LIMIT 1;`,
      [circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('fundraising_causes');
    }

    const capSettings = capRes.rows[0].settings ?? {};
    const feePct = Math.min(
      30,
      Math.max(0, Number(capSettings.memberCauseFeePercentage ?? 0))
    );

    const campRes = await tx.query<{
      id: string;
      creator_id: string;
      title: string;
      currency: string;
      cause_type: 'official' | 'member';
      status: string;
    }>(
      `SELECT id, creator_id, title, currency, COALESCE(cause_type, 'official') AS cause_type, status
       FROM public.fundraising_campaigns
       WHERE id = $1 AND circle_id = $2
       LIMIT 1;`,
      [campaignId, circleId]
    );

    const campaign = campRes.rows[0];
    if (!campaign) {
      throw new NotFoundError('Cause not found.');
    }
    if (campaign.status !== 'active') {
      throw new ConflictError('This cause is not currently accepting donations.');
    }

    if (parsed.paymentMethod === 'wallet' && !actorUserId) {
      throw new ForbiddenError('Sign in to donate using your Member Wallet.');
    }

    // Calculate fee & net settlement:
    // Official causes route 100% to Circle Treasury; Member causes credit the creator's Member Wallet (minus optional admin commission)
    const isMemberCause = campaign.cause_type === 'member';
    const platformFeeAmount = isMemberCause
      ? Math.round(parsed.pledgeAmount * (feePct / 100) * 100) / 100
      : 0;
    const netAmount = Math.round((parsed.pledgeAmount - platformFeeAmount) * 100) / 100;

    // If paying with Member Wallet, check balance and debit donor's wallet
    if (parsed.paymentMethod === 'wallet' && actorUserId) {
      const balRes = await tx.query<{ balance: string | number }>(
        `SELECT COALESCE(SUM(
           CASE WHEN tx_type IN ('deposit', 'sale_credit', 'refund') THEN amount
                ELSE -amount END
         ), 0) AS balance
         FROM public.member_wallet_transactions
         WHERE circle_id = $1 AND user_id = $2 AND currency = $3 AND status = 'completed';`,
        [circleId, actorUserId, campaign.currency]
      );
      const currentBalance = Number(balRes.rows[0]?.balance ?? 0);
      if (currentBalance < parsed.pledgeAmount) {
        throw new ConflictError(
          `Insufficient ${campaign.currency} wallet balance (${campaign.currency} ${currentBalance.toFixed(2)} available). Please top up your wallet or donate with Card / Bank Transfer.`
        );
      }

      await tx.query(
        `INSERT INTO public.member_wallet_transactions (
           id, circle_id, user_id, tx_type, amount, currency, description, status
         ) VALUES ($1, $2, $3, 'purchase_debit', $4, $5, $6, 'completed');`,
        [
          crypto.randomUUID(),
          circleId,
          actorUserId,
          parsed.pledgeAmount,
          campaign.currency,
          `Donation to cause: ${campaign.title}`,
        ]
      );
    }

    // Credit Member Wallet if this is a Member-Submitted Cause
    if (isMemberCause && netAmount > 0) {
      await tx.query(
        `INSERT INTO public.member_wallet_transactions (
           id, circle_id, user_id, tx_type, amount, currency, description, status
         ) VALUES ($1, $2, $3, 'sale_credit', $4, $5, $6, 'completed');`,
        [
          crypto.randomUUID(),
          circleId,
          campaign.creator_id,
          netAmount,
          campaign.currency,
          `Cause donation received: ${campaign.title}`,
        ]
      );
    }

    const res = await tx.query<FundraisingPledgeItem>(
      `INSERT INTO public.fundraising_pledges (
         id, campaign_id, circle_id, pledger_id, donor_name, donor_email,
         is_anonymous, payment_method, platform_fee_amount, net_amount,
         pledge_amount, message, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'fulfilled_verified')
       RETURNING *;`,
      [
        crypto.randomUUID(),
        campaignId,
        circleId,
        actorUserId ?? null,
        parsed.donorName ?? null,
        parsed.donorEmail ?? null,
        parsed.isAnonymous,
        parsed.paymentMethod,
        platformFeeAmount,
        netAmount,
        parsed.pledgeAmount,
        parsed.message,
      ]
    );

    if (actorUserId !== campaign.creator_id) {
      await createNotification({
        recipientId: campaign.creator_id,
        actorId: actorUserId,
        circleId,
        eventType: 'challenge_reward',
        title: `New donation to "${campaign.title}"`,
        body: `${parsed.isAnonymous ? 'An anonymous supporter' : parsed.donorName || 'A supporter'} donated ${campaign.currency} ${parsed.pledgeAmount.toLocaleString()}.`,
        linkUrl: `/circles/${circleId}/community`,
      }).catch(() => {});
    }

    return {
      ...res.rows[0],
      pledge_amount: Number(res.rows[0].pledge_amount),
      platform_fee_amount: Number(res.rows[0].platform_fee_amount ?? 0),
      net_amount: Number(res.rows[0].net_amount ?? res.rows[0].pledge_amount),
    };
  });
}

export async function updateFundraisingCampaign(
  actorUserId: string,
  circleId: string,
  campaignId: string,
  input: z.input<typeof updateFundraisingCampaignSchema>
): Promise<FundraisingCampaignItem> {
  const parsed = updateFundraisingCampaignSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const campRes = await tx.query<FundraisingCampaignItem>(
      `SELECT * FROM public.fundraising_campaigns WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [campaignId, circleId]
    );
    const campaign = campRes.rows[0];
    if (!campaign) {
      throw new NotFoundError('Cause not found.');
    }

    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const membership = memRes.rows[0];
    const isStaff =
      membership?.status === 'active' &&
      ['owner', 'admin', 'moderator'].includes(membership.role);
    const isCreator = campaign.creator_id === actorUserId;

    if (!isStaff && !isCreator) {
      throw new ForbiddenError('You do not have permission to update this cause.');
    }

    // Only staff can approve a pending_approval cause or reject it
    if (
      parsed.status &&
      (campaign.status === 'pending_approval' || parsed.status === 'rejected') &&
      !isStaff
    ) {
      throw new ForbiddenError('Only Circle administrators can approve or reject submitted causes.');
    }

    const currentUpdates = Array.isArray(campaign.updates) ? campaign.updates : [];
    const nextUpdates = parsed.updateBody
      ? [
          {
            id: crypto.randomUUID(),
            body: parsed.updateBody,
            created_at: new Date().toISOString(),
          },
          ...currentUpdates,
        ]
      : currentUpdates;

    const updated = await tx.query<FundraisingCampaignItem>(
      `UPDATE public.fundraising_campaigns
       SET status = COALESCE($1, status),
           updates = $2::jsonb,
           updated_at = NOW()
       WHERE id = $3 AND circle_id = $4
       RETURNING *;`,
      [parsed.status ?? null, JSON.stringify(nextUpdates), campaignId, circleId]
    );

    return {
      ...updated.rows[0],
      goal_amount: Number(updated.rows[0].goal_amount),
    };
  });
}

export async function listFundraisingCampaigns(
  actorUserId: string | null,
  circleId: string
): Promise<FundraisingCampaignItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'fundraising_causes' AND enabled = true LIMIT 1;`,
      [circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('fundraising_causes');
    }

    let isStaff = false;
    if (actorUserId) {
      const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
        `SELECT role, status FROM public.circle_memberships
         WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
        [circleId, actorUserId]
      );
      const mem = memRes.rows[0];
      isStaff =
        mem?.status === 'active' && ['owner', 'admin', 'moderator'].includes(mem.role);
    }

    const res = await tx.query<
      FundraisingCampaignItem & {
        pledged_total: string | number;
        pledge_count: number;
        creator_username: string;
        creator_display_name: string;
        creator_avatar_url: string | null;
      }
    >(
      `SELECT c.*,
         COALESCE(u.username, 'member') AS creator_username,
         COALESCE(u.display_name, 'Community Member') AS creator_display_name,
         u.avatar_url AS creator_avatar_url,
         COALESCE(
           (SELECT SUM(p.pledge_amount) FROM public.fundraising_pledges p
            WHERE p.campaign_id = c.id AND p.status IN ('pledged', 'fulfilled_verified')),
           0
         ) AS pledged_total,
         (SELECT COUNT(*)::int FROM public.fundraising_pledges p
          WHERE p.campaign_id = c.id AND p.status IN ('pledged', 'fulfilled_verified')) AS pledge_count
       FROM public.fundraising_campaigns c
       LEFT JOIN public.profiles u ON u.id = c.creator_id
       WHERE c.circle_id = $1
       ORDER BY c.created_at DESC;`,
      [circleId]
    );

    const pledgesRes = await tx.query<
      FundraisingPledgeItem & {
        pledger_username: string | null;
        pledger_display_name: string | null;
      }
    >(
      `SELECT p.*,
         u.username AS pledger_username,
         u.display_name AS pledger_display_name
       FROM public.fundraising_pledges p
       LEFT JOIN public.profiles u ON u.id = p.pledger_id
       WHERE p.circle_id = $1 AND p.status IN ('pledged', 'fulfilled_verified')
       ORDER BY p.created_at DESC
       LIMIT 200;`,
      [circleId]
    );

    const donationsByCampaign = new Map<string, FundraisingPledgeItem[]>();
    for (const p of pledgesRes.rows) {
      const list = donationsByCampaign.get(p.campaign_id) ?? [];
      const isAnon = Boolean(p.is_anonymous);
      list.push({
        id: p.id,
        campaign_id: p.campaign_id,
        circle_id: p.circle_id,
        pledger_id: isAnon ? null : p.pledger_id,
        donor_name: isAnon
          ? 'Anonymous Supporter'
          : p.donor_name || p.pledger_display_name || 'Supporter',
        is_anonymous: isAnon,
        payment_method: p.payment_method,
        pledge_amount: Number(p.pledge_amount),
        message: p.message,
        status: p.status,
        created_at: p.created_at,
        updated_at: p.updated_at,
      });
      donationsByCampaign.set(p.campaign_id, list);
    }

    return res.rows
      .filter(
        (r) =>
          r.status === 'active' ||
          r.status === 'completed' ||
          isStaff ||
          (actorUserId && r.creator_id === actorUserId)
      )
      .map((r) => ({
        id: r.id,
        circle_id: r.circle_id,
        creator_id: r.creator_id,
        title: r.title,
        description: r.description,
        category: r.category ?? 'community_project',
        image_url: r.image_url ?? null,
        cause_type: r.cause_type ?? 'official',
        beneficiary_name: r.beneficiary_name ?? null,
        milestones: Array.isArray(r.milestones) ? r.milestones : [],
        updates: Array.isArray(r.updates) ? r.updates : [],
        goal_amount: Number(r.goal_amount),
        currency: r.currency,
        deadline: r.deadline,
        status: r.status,
        created_at: r.created_at,
        updated_at: r.updated_at,
        pledged_total: Number(r.pledged_total ?? 0),
        pledge_count: Number(r.pledge_count ?? 0),
        creator: {
          id: r.creator_id,
          username: r.creator_username,
          display_name: r.creator_display_name,
          avatar_url: r.creator_avatar_url,
        },
        recent_donations: (donationsByCampaign.get(r.id) ?? []).slice(0, 15),
      }));
  });
}

// ============================================================================
// 3. CHALLENGES, SUBMISSIONS & REWARDS
// ============================================================================

export async function createCommunityChallenge(
  actorUserId: string,
  input: z.input<typeof createChallengeSchema>
): Promise<CommunityChallengeItem> {
  const parsed = createChallengeSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'challenges_rewards' AND enabled = true LIMIT 1;`,
      [parsed.circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('challenges_rewards');
    }

    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [parsed.circleId, actorUserId]
    );
    const membership = memRes.rows[0];
    if (
      !membership ||
      membership.status !== 'active' ||
      !['owner', 'admin', 'moderator'].includes(membership.role)
    ) {
      throw new ForbiddenError(
        'Only Circle moderators, administrators, or owners can create community challenges.'
      );
    }

    const res = await tx.query<CommunityChallengeItem>(
      `INSERT INTO public.community_challenges (
         id, circle_id, creator_id, title, description, rules,
         reward_badge_name, reward_points, ends_at, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
       RETURNING *;`,
      [
        crypto.randomUUID(),
        parsed.circleId,
        actorUserId,
        parsed.title,
        parsed.description,
        parsed.rules,
        parsed.rewardBadgeName,
        parsed.rewardPoints,
        parsed.endsAt ?? null,
      ]
    );

    return res.rows[0];
  });
}

export async function submitChallengeEntry(
  actorUserId: string,
  circleId: string,
  challengeId: string,
  input: z.input<typeof submitChallengeEntrySchema>
): Promise<ChallengeSubmissionItem> {
  const parsed = submitChallengeEntrySchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'challenges_rewards' AND enabled = true LIMIT 1;`,
      [circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('challenges_rewards');
    }

    try {
      const inserted = await tx.query<ChallengeSubmissionItem>(
        `INSERT INTO public.challenge_submissions (
           id, challenge_id, circle_id, participant_id, submission_text,
           proof_url, status, awarded_points, awarded_badge
         ) VALUES ($1, $2, $3, $4, $5, $6, 'submitted', 0, NULL)
         RETURNING *;`,
        [
          crypto.randomUUID(),
          challengeId,
          circleId,
          actorUserId,
          parsed.submissionText,
          parsed.proofUrl ?? null,
        ]
      );
      return inserted.rows[0];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('duplicate key')) {
        throw new ConflictError('You have already submitted an entry for this challenge.');
      }
      throw err;
    }
  });
}

export async function reviewChallengeSubmission(
  actorUserId: string,
  circleId: string,
  submissionId: string,
  input: z.input<typeof reviewChallengeSubmissionSchema>
): Promise<ChallengeSubmissionItem> {
  const parsed = reviewChallengeSubmissionSchema.parse(input);

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const membership = memRes.rows[0];
    if (
      !membership ||
      membership.status !== 'active' ||
      !['owner', 'admin', 'moderator'].includes(membership.role)
    ) {
      throw new ForbiddenError(
        'Only Circle moderators, administrators, or owners can review challenge submissions or award badges.'
      );
    }

    const subRes = await tx.query<
      ChallengeSubmissionItem & {
        reward_points: number;
        reward_badge_name: string;
        circle_slug: string;
      }
    >(
      `SELECT s.*, c.reward_points, c.reward_badge_name, ci.slug AS circle_slug
       FROM public.challenge_submissions s
       INNER JOIN public.community_challenges c ON c.id = s.challenge_id AND c.circle_id = s.circle_id
       INNER JOIN public.circles ci ON ci.id = s.circle_id
       WHERE s.id = $1 AND s.circle_id = $2
       LIMIT 1;`,
      [submissionId, circleId]
    );
    const sub = subRes.rows[0];
    if (!sub) {
      throw new NotFoundError('Challenge submission not found.');
    }

    const pointsToAward =
      parsed.status === 'approved' ? (parsed.awardedPoints ?? sub.reward_points) : 0;
    const badgeToAward =
      parsed.status === 'approved'
        ? parsed.awardedBadge !== undefined
          ? parsed.awardedBadge
          : sub.reward_badge_name
        : null;

    const updated = await tx.query<ChallengeSubmissionItem>(
      `UPDATE public.challenge_submissions
       SET status = $1,
           awarded_points = $2,
           awarded_badge = $3,
           reviewed_by = $4,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = $5 AND circle_id = $6
       RETURNING *;`,
      [parsed.status, pointsToAward, badgeToAward, actorUserId, submissionId, circleId]
    );

    return {
      submission: updated.rows[0],
      circleSlug: sub.circle_slug,
    };
  });

  if (outcome.submission.status === 'approved') {
    await createNotification({
      recipientId: outcome.submission.participant_id,
      actorId: actorUserId,
      circleId,
      eventType: 'challenge_reward',
      title: `Challenge Completed! Badge Awarded: ${outcome.submission.awarded_badge ?? 'Challenger'}`,
      body: `You earned ${outcome.submission.awarded_points} points in this Circle challenge.`,
      linkUrl: `/circles/${outcome.circleSlug}/community?tab=challenges`,
    });
  }

  return outcome.submission;
}

export async function listCommunityChallenges(
  actorUserId: string | null,
  circleId: string
): Promise<{
  challenges: CommunityChallengeItem[];
  submissions: ChallengeSubmissionItem[];
}> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'challenges_rewards' AND enabled = true LIMIT 1;`,
      [circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('challenges_rewards');
    }

    const challengesRes = await tx.query<
      CommunityChallengeItem & { submission_count: number }
    >(
      `SELECT c.*,
         (SELECT COUNT(*)::int FROM public.challenge_submissions s WHERE s.challenge_id = c.id) AS submission_count
       FROM public.community_challenges c
       WHERE c.circle_id = $1
       ORDER BY c.created_at DESC;`,
      [circleId]
    );

    const subsRes = await tx.query<
      ChallengeSubmissionItem & {
        participant_username: string;
        participant_display_name: string;
      }
    >(
      `SELECT s.*,
         COALESCE(u.username, 'member') AS participant_username,
         COALESCE(u.display_name, 'Member') AS participant_display_name
       FROM public.challenge_submissions s
       LEFT JOIN public.profiles u ON u.id = s.participant_id
       WHERE s.circle_id = $1
       ORDER BY s.created_at DESC;`,
      [circleId]
    );

    const submissions: ChallengeSubmissionItem[] = subsRes.rows.map((s) => ({
      id: s.id,
      challenge_id: s.challenge_id,
      circle_id: s.circle_id,
      participant_id: s.participant_id,
      submission_text: s.submission_text,
      proof_url: s.proof_url,
      status: s.status,
      awarded_points: Number(s.awarded_points ?? 0),
      awarded_badge: s.awarded_badge,
      reviewed_by: s.reviewed_by,
      reviewed_at: s.reviewed_at,
      created_at: s.created_at,
      updated_at: s.updated_at,
      participant: {
        id: s.participant_id,
        username: s.participant_username,
        display_name: s.participant_display_name,
      },
    }));

    return {
      challenges: challengesRes.rows.map((c) => ({
        ...c,
        reward_points: Number(c.reward_points),
        submission_count: Number(c.submission_count ?? 0),
        viewer_submission:
          submissions.find(
            (s) => s.challenge_id === c.id && s.participant_id === actorUserId
          ) ?? null,
      })),
      submissions,
    };
  });
}

// ============================================================================
// 4. HELP DESK & SUPPORT TICKETS
// ============================================================================

export async function createSupportTicket(
  actorUserId: string,
  input: z.input<typeof createSupportTicketSchema>
): Promise<SupportTicketItem> {
  const parsed = createSupportTicketSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'help_desk' AND enabled = true LIMIT 1;`,
      [parsed.circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('help_desk');
    }

    const res = await tx.query<SupportTicketItem>(
      `INSERT INTO public.support_tickets (
         id, circle_id, requester_id, category, priority, is_private,
         subject, description, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
       RETURNING *;`,
      [
        crypto.randomUUID(),
        parsed.circleId,
        actorUserId,
        parsed.category,
        parsed.priority,
        parsed.isPrivate,
        parsed.subject,
        parsed.description,
      ]
    );

    return res.rows[0];
  });
}

export async function updateSupportTicket(
  actorUserId: string,
  circleId: string,
  ticketId: string,
  input: z.input<typeof updateSupportTicketSchema>
): Promise<SupportTicketItem> {
  const parsed = updateSupportTicketSchema.parse(input);

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const membership = memRes.rows[0];
    if (!membership || membership.status !== 'active') {
      throw new ForbiddenError('Active Circle membership required.');
    }

    const existingRes = await tx.query<SupportTicketItem & { circle_slug: string }>(
      `SELECT t.*, c.slug AS circle_slug
       FROM public.support_tickets t
       INNER JOIN public.circles c ON c.id = t.circle_id
       WHERE t.id = $1 AND t.circle_id = $2
       LIMIT 1;`,
      [ticketId, circleId]
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new NotFoundError('Support ticket not found.');
    }

    const isStaff = ['owner', 'admin', 'moderator'].includes(membership.role);
    if (
      existing.requester_id !== actorUserId &&
      existing.assigned_to !== actorUserId &&
      !isStaff
    ) {
      throw new ForbiddenError('Not authorized to update this support ticket.');
    }

    if (parsed.assignedTo !== undefined && !isStaff) {
      throw new ForbiddenError('Only Circle moderators or administrators can assign support tickets.');
    }

    const updated = await tx.query<SupportTicketItem>(
      `UPDATE public.support_tickets
       SET status = $1,
           assigned_to = $2,
           resolution_notes = $3,
           updated_at = NOW()
       WHERE id = $4 AND circle_id = $5
       RETURNING *;`,
      [
        parsed.status ?? existing.status,
        parsed.assignedTo !== undefined ? parsed.assignedTo : existing.assigned_to,
        parsed.resolutionNotes !== undefined
          ? parsed.resolutionNotes
          : existing.resolution_notes,
        ticketId,
        circleId,
      ]
    );

    return {
      ticket: updated.rows[0],
      circleSlug: existing.circle_slug,
    };
  });

  if (outcome.ticket.requester_id !== actorUserId) {
    await createNotification({
      recipientId: outcome.ticket.requester_id,
      actorId: actorUserId,
      circleId,
      eventType: 'support_ticket',
      title: `Support Ticket Update: ${outcome.ticket.subject}`,
      body:
        outcome.ticket.resolution_notes ??
        `Your ticket status is now ${outcome.ticket.status}.`,
      linkUrl: `/circles/${outcome.circleSlug}/community?tab=support`,
    });
  }

  return outcome.ticket;
}

export async function listSupportTickets(
  actorUserId: string,
  circleId: string
): Promise<SupportTicketItem[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean }>(
      `SELECT enabled FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'help_desk' AND enabled = true LIMIT 1;`,
      [circleId]
    );
    if (!capRes.rows[0]?.enabled) {
      throw new CapabilityDisabledError('help_desk');
    }

    const res = await tx.query<
      SupportTicketItem & {
        requester_username: string;
        requester_display_name: string;
        assignee_username: string | null;
        assignee_display_name: string | null;
      }
    >(
      `SELECT t.*,
         COALESCE(ru.username, 'member') AS requester_username,
         COALESCE(ru.display_name, 'Member') AS requester_display_name,
         au.username AS assignee_username,
         au.display_name AS assignee_display_name
       FROM public.support_tickets t
       LEFT JOIN public.profiles ru ON ru.id = t.requester_id
       LEFT JOIN public.profiles au ON au.id = t.assigned_to
       WHERE t.circle_id = $1
       ORDER BY t.created_at DESC;`,
      [circleId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      circle_id: r.circle_id,
      requester_id: r.requester_id,
      assigned_to: r.assigned_to,
      category: r.category,
      priority: r.priority,
      is_private: r.is_private,
      subject: r.subject,
      description: r.description,
      resolution_notes: r.resolution_notes,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      requester: {
        id: r.requester_id,
        username: r.requester_username,
        display_name: r.requester_display_name,
      },
      assignee: r.assigned_to
        ? {
            id: r.assigned_to,
            username: r.assignee_username ?? 'staff',
            display_name: r.assignee_display_name ?? 'Staff',
          }
        : null,
    }));
  });
}
