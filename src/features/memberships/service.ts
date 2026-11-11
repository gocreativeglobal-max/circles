import crypto from 'crypto';
import { withRlsTransaction, withServiceRoleTransaction } from '@/lib/db/postgres';
import {
  Circle,
  CircleCategory,
  CircleInvitation,
  CircleInviteLink,
  CircleJoinRequest,
  CircleMembership,
  CircleRole,
  CircleVisibility,
  MembershipPolicy,
  MembershipStatus,
} from '@/types/domain';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { assertCirclePermission } from '@/lib/authorization/permissions';
import { createNotification } from '@/features/notifications/service';

export async function joinPublicCircle(
  actorUserId: string,
  circleId: string
): Promise<CircleMembership> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{
      id: string;
      name: string;
      slug: string;
      visibility: CircleVisibility;
      membership_policy: MembershipPolicy;
      status: string;
    }>(
      `SELECT id, name, slug, visibility, membership_policy, status
       FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );

    const circle = circleRes.rows[0];
    if (!circle || circle.status !== 'active') {
      throw new NotFoundError('Circle not found or inactive.');
    }

    if (circle.visibility !== 'public' || circle.membership_policy !== 'open') {
      throw new ForbiddenError(
        'This Circle does not allow direct joining. Please submit a membership request or use an invitation.'
      );
    }

    const existingRes = await tx.query<CircleMembership>(
      `SELECT * FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const existing = existingRes.rows[0];

    if (existing) {
      if (existing.status === 'active') {
        throw new ConflictError('You are already an active member of this Circle.');
      }
      if (existing.status === 'suspended') {
        throw new ForbiddenError('Your membership in this Circle is suspended.');
      }
      const rejoined = await tx.query<CircleMembership>(
        `UPDATE public.circle_memberships
         SET status = 'active', role = 'member', updated_at = NOW()
         WHERE id = $1
         RETURNING *;`,
        [existing.id]
      );
      return rejoined.rows[0];
    }

    const inserted = await tx.query<CircleMembership>(
      `INSERT INTO public.circle_memberships (id, circle_id, user_id, role, status)
       VALUES ($1, $2, $3, 'member', 'active')
       RETURNING *;`,
      [crypto.randomUUID(), circleId, actorUserId]
    );

    return inserted.rows[0];
  });
}

export async function requestToJoinCircle(
  actorUserId: string,
  circleId: string,
  message = ''
): Promise<CircleJoinRequest> {
  const cleanMessage = message.trim().slice(0, 500);

  const result = await withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{
      id: string;
      name: string;
      slug: string;
      owner_id: string;
      visibility: CircleVisibility;
      membership_policy: MembershipPolicy;
      status: string;
    }>(
      `SELECT id, name, slug, owner_id, visibility, membership_policy, status
       FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );

    const circle = circleRes.rows[0];
    if (!circle || circle.status !== 'active') {
      throw new NotFoundError('Circle not found.');
    }

    if (circle.membership_policy !== 'approval') {
      throw new ValidationError(
        circle.membership_policy === 'open'
          ? 'This Circle is open—you can join directly without requesting approval.'
          : 'This Circle is invite-only.'
      );
    }

    const existingMember = await tx.query<{ status: MembershipStatus }>(
      `SELECT status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    if (existingMember.rows[0]?.status === 'active') {
      throw new ConflictError('You are already an active member of this Circle.');
    }
    if (existingMember.rows[0]?.status === 'suspended') {
      throw new ForbiddenError('Your membership in this Circle is suspended.');
    }

    const pendingCheck = await tx.query<{ id: string }>(
      `SELECT id FROM public.circle_join_requests
       WHERE circle_id = $1 AND user_id = $2 AND status = 'pending' LIMIT 1;`,
      [circleId, actorUserId]
    );
    if (pendingCheck.rows.length > 0) {
      throw new ConflictError('You already have a pending join request for this Circle.');
    }

    const reqId = crypto.randomUUID();
    const inserted = await tx.query<CircleJoinRequest>(
      `INSERT INTO public.circle_join_requests (id, circle_id, user_id, message, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *;`,
      [reqId, circleId, actorUserId, cleanMessage]
    );

    return { request: inserted.rows[0], circle };
  });

  await createNotification({
    recipientId: result.circle.owner_id,
    actorId: actorUserId,
    circleId,
    eventType: 'join_request_received',
    title: `New membership request for ${result.circle.name}`,
    body: cleanMessage
      ? `A user requested to join with note: "${cleanMessage}"`
      : 'A user requested to join your Circle.',
    linkUrl: `/circles/${result.circle.slug}/studio`,
    idempotencyKey: `join-req-${result.request.id}`,
    sendEmail: true,
  });

  return result.request;
}

export async function approveJoinRequest(
  actorUserId: string,
  circleId: string,
  requestId: string
): Promise<CircleMembership> {
  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{
      id: string;
      name: string;
      slug: string;
      visibility: CircleVisibility;
    }>(`SELECT id, name, slug, visibility FROM public.circles WHERE id = $1 LIMIT 1;`, [circleId]);
    const circle = circleRes.rows[0];
    if (!circle) {
      throw new NotFoundError('Circle not found.');
    }

    const actorMember = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    assertCirclePermission('circle.approve_requests', circle.visibility, {
      userId: actorUserId,
      circleRole: actorMember.rows[0]?.role ?? null,
      membershipStatus: actorMember.rows[0]?.status ?? null,
    });

    const reqRes = await tx.query<CircleJoinRequest>(
      `SELECT * FROM public.circle_join_requests
       WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [requestId, circleId]
    );
    const req = reqRes.rows[0];
    if (!req) {
      throw new NotFoundError('Join request not found in this Circle.');
    }
    if (req.status !== 'pending') {
      throw new ConflictError(`Join request has already been ${req.status}.`);
    }

    await tx.query(
      `UPDATE public.circle_join_requests
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $2;`,
      [actorUserId, requestId]
    );

    const memberRes = await tx.query<CircleMembership>(
      `INSERT INTO public.circle_memberships (id, circle_id, user_id, role, status)
       VALUES ($1, $2, $3, 'member', 'active')
       ON CONFLICT (circle_id, user_id)
       DO UPDATE SET status = 'active', role = 'member', updated_at = NOW()
       RETURNING *;`,
      [crypto.randomUUID(), circleId, req.user_id]
    );

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'join_request.approved', 'circle_join_request', $4, $5::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        requestId,
        JSON.stringify({ userId: req.user_id }),
      ]
    );

    return { membership: memberRes.rows[0], circle, applicantId: req.user_id };
  });

  await createNotification({
    recipientId: outcome.applicantId,
    actorId: actorUserId,
    circleId,
    eventType: 'join_request_approved',
    title: `Your request to join ${outcome.circle.name} was approved`,
    body: `Welcome to ${outcome.circle.name}! You now have member access to spaces and discussions.`,
    linkUrl: `/circles/${outcome.circle.slug}`,
    idempotencyKey: `join-approved-${requestId}`,
    sendEmail: true,
  });

  return outcome.membership;
}

export async function rejectJoinRequest(
  actorUserId: string,
  circleId: string,
  requestId: string,
  reviewNote = ''
): Promise<CircleJoinRequest> {
  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{
      id: string;
      name: string;
      slug: string;
      visibility: CircleVisibility;
    }>(`SELECT id, name, slug, visibility FROM public.circles WHERE id = $1 LIMIT 1;`, [circleId]);
    const circle = circleRes.rows[0];
    if (!circle) {
      throw new NotFoundError('Circle not found.');
    }

    const actorMember = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    assertCirclePermission('circle.approve_requests', circle.visibility, {
      userId: actorUserId,
      circleRole: actorMember.rows[0]?.role ?? null,
      membershipStatus: actorMember.rows[0]?.status ?? null,
    });

    const updated = await tx.query<CircleJoinRequest>(
      `UPDATE public.circle_join_requests
       SET status = 'rejected',
           reviewed_by = $1,
           reviewed_at = NOW(),
           review_note = $2,
           updated_at = NOW()
       WHERE id = $3 AND circle_id = $4 AND status = 'pending'
       RETURNING *;`,
      [actorUserId, reviewNote.trim().slice(0, 300) || null, requestId, circleId]
    );

    const req = updated.rows[0];
    if (!req) {
      throw new NotFoundError('Pending join request not found.');
    }

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'join_request.rejected', 'circle_join_request', $4, $5::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        requestId,
        JSON.stringify({ userId: req.user_id }),
      ]
    );

    return { req, circle };
  });

  await createNotification({
    recipientId: outcome.req.user_id,
    actorId: actorUserId,
    circleId,
    eventType: 'join_request_rejected',
    title: `Update on your membership request for ${outcome.circle.name}`,
    body: `Your membership request for ${outcome.circle.name} was not approved at this time.`,
    linkUrl: `/explore`,
    idempotencyKey: `join-rejected-${requestId}`,
  });

  return outcome.req;
}

export async function leaveCircle(actorUserId: string, circleId: string): Promise<void> {
  await withRlsTransaction(actorUserId, async (tx) => {
    const memberRes = await tx.query<CircleMembership>(
      `SELECT * FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1;`,
      [circleId, actorUserId]
    );
    const membership = memberRes.rows[0];
    if (!membership) {
      throw new NotFoundError('Active membership not found.');
    }

    // Note: if the user is the last owner, both our service check and the PostgreSQL trigger
    // `trg_prevent_last_owner_loss` will prevent leaving without transferring ownership.
    if (membership.role === 'owner') {
      const otherOwners = await tx.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM public.circle_memberships
         WHERE circle_id = $1 AND role = 'owner' AND status = 'active' AND user_id <> $2;`,
        [circleId, actorUserId]
      );
      if (parseInt(otherOwners.rows[0]?.count ?? '0', 10) === 0) {
        throw new ForbiddenError(
          'You are the sole owner of this Circle. Transfer ownership to another member before leaving.'
        );
      }
    }

    await tx.query(
      `UPDATE public.circle_memberships
       SET status = 'left', updated_at = NOW()
       WHERE id = $1;`,
      [membership.id]
    );
  });
}

export async function inviteToCircle(
  actorUserId: string,
  circleId: string,
  invitedEmail: string,
  role: Exclude<CircleRole, 'owner'> = 'member'
): Promise<{ invitation: CircleInvitation; rawToken: string }> {
  const cleanEmail = invitedEmail.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new ValidationError('Please enter a valid email address to invite.');
  }
  if (!['admin', 'moderator', 'member'].includes(role)) {
    throw new ValidationError('Invalid invitation role.');
  }

  const rawToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{
      id: string;
      name: string;
      slug: string;
      visibility: CircleVisibility;
    }>(`SELECT id, name, slug, visibility FROM public.circles WHERE id = $1 LIMIT 1;`, [circleId]);
    const circle = circleRes.rows[0];
    if (!circle) {
      throw new NotFoundError('Circle not found.');
    }

    const actorMember = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    assertCirclePermission('circle.invite', circle.visibility, {
      userId: actorUserId,
      circleRole: actorMember.rows[0]?.role ?? null,
      membershipStatus: actorMember.rows[0]?.status ?? null,
    });

    if (role === 'admin' && actorMember.rows[0]?.role !== 'owner') {
      throw new ForbiddenError('Only a Circle owner can invite a member as an administrator.');
    }

    const userRes = await tx.query<{ id: string }>(
      `SELECT id FROM public.profiles WHERE lower(email) = $1 LIMIT 1;`,
      [cleanEmail]
    );
    const invitedUserId = userRes.rows[0]?.id ?? null;

    const invId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

    const invRes = await tx.query<CircleInvitation>(
      `INSERT INTO public.circle_invitations (
         id, circle_id, inviter_id, invited_email, invited_user_id, role, token_hash, status, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
       RETURNING id, circle_id, inviter_id, invited_email, invited_user_id, role, status, expires_at, accepted_at, created_at;`,
      [invId, circleId, actorUserId, cleanEmail, invitedUserId, role, tokenHash, expiresAt]
    );

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'member.invited', 'circle_invitation', $4, $5::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        invId,
        JSON.stringify({ invitedEmail: cleanEmail, role }),
      ]
    );

    return { invitation: invRes.rows[0], circle, invitedUserId };
  });

  if (outcome.invitedUserId) {
    await createNotification({
      recipientId: outcome.invitedUserId,
      actorId: actorUserId,
      circleId,
      eventType: 'invitation_received',
      title: `You've been invited to join ${outcome.circle.name}`,
      body: `You received an invitation to join ${outcome.circle.name} as a ${role}.`,
      linkUrl: `/circles/${outcome.circle.slug}?inviteToken=${rawToken}`,
      idempotencyKey: `invite-${outcome.invitation.id}`,
      sendEmail: true,
    });
  }

  return { invitation: outcome.invitation, rawToken };
}

export async function acceptInvitation(
  actorUserId: string,
  rawToken: string
): Promise<CircleMembership> {
  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

  return withServiceRoleTransaction(async (tx) => {
    const profileRes = await tx.query<{ id: string; email: string }>(
      `SELECT id, email FROM public.profiles WHERE id = $1 LIMIT 1;`,
      [actorUserId]
    );
    const profile = profileRes.rows[0];
    if (!profile) {
      throw new NotFoundError('Authenticated user profile not found.');
    }

    const invRes = await tx.query<CircleInvitation & { token_hash: string }>(
      `SELECT * FROM public.circle_invitations WHERE token_hash = $1 LIMIT 1;`,
      [tokenHash]
    );
    const inv = invRes.rows[0];
    if (!inv) {
      throw new NotFoundError('Invitation token is invalid.');
    }
    if (inv.status !== 'pending') {
      throw new ConflictError(`Invitation has already been ${inv.status}.`);
    }
    if (new Date(inv.expires_at).getTime() < Date.now()) {
      await tx.query(`UPDATE public.circle_invitations SET status = 'expired' WHERE id = $1;`, [
        inv.id,
      ]);
      throw new ValidationError('This invitation has expired.');
    }
    if (
      inv.invited_email.toLowerCase() !== profile.email.toLowerCase() &&
      inv.invited_user_id !== actorUserId
    ) {
      throw new ForbiddenError('This invitation was issued for a different email address.');
    }

    await tx.query(
      `UPDATE public.circle_invitations
       SET status = 'accepted', accepted_at = NOW(), invited_user_id = $1
       WHERE id = $2;`,
      [actorUserId, inv.id]
    );

    const memberRes = await tx.query<CircleMembership>(
      `INSERT INTO public.circle_memberships (id, circle_id, user_id, role, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (circle_id, user_id)
       DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = NOW()
       RETURNING *;`,
      [crypto.randomUUID(), inv.circle_id, actorUserId, inv.role]
    );

    return memberRes.rows[0];
  });
}

export async function updateMemberRole(
  actorUserId: string,
  circleId: string,
  targetUserId: string,
  newRole: Exclude<CircleRole, 'owner'>
): Promise<CircleMembership> {
  if (!['admin', 'moderator', 'member'].includes(newRole)) {
    throw new ValidationError('Invalid target role.');
  }

  const outcome = await withRlsTransaction(actorUserId, async (tx) => {
    const circleRes = await tx.query<{ name: string; slug: string; visibility: CircleVisibility }>(
      `SELECT name, slug, visibility FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );
    const circle = circleRes.rows[0];
    if (!circle) {
      throw new NotFoundError('Circle not found.');
    }

    const actorMember = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );

    assertCirclePermission('circle.manage_members', circle.visibility, {
      userId: actorUserId,
      circleRole: actorMember.rows[0]?.role ?? null,
      membershipStatus: actorMember.rows[0]?.status ?? null,
    });

    if (newRole === 'admin' && actorMember.rows[0]?.role !== 'owner') {
      throw new ForbiddenError('Only a Circle owner can promote members to administrator.');
    }

    const updated = await tx.query<CircleMembership>(
      `UPDATE public.circle_memberships
       SET role = $1, updated_at = NOW()
       WHERE circle_id = $2 AND user_id = $3
       RETURNING *;`,
      [newRole, circleId, targetUserId]
    );

    if (!updated.rows[0]) {
      throw new NotFoundError('Target membership not found.');
    }

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'member.role_updated', 'circle_membership', $4, $5::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        updated.rows[0].id,
        JSON.stringify({ targetUserId, newRole }),
      ]
    );

    return { membership: updated.rows[0], circle };
  });

  await createNotification({
    recipientId: targetUserId,
    actorId: actorUserId,
    circleId,
    eventType: 'role_changed',
    title: `Your role in ${outcome.circle.name} was updated`,
    body: `Your Circle role is now ${newRole}.`,
    linkUrl: `/circles/${outcome.circle.slug}`,
  });

  return outcome.membership;
}

export async function transferCircleOwnership(
  actorOwnerId: string,
  circleId: string,
  newOwnerUserId: string
): Promise<void> {
  if (actorOwnerId === newOwnerUserId) {
    throw new ValidationError('You are already the owner of this Circle.');
  }

  await withRlsTransaction(actorOwnerId, async (tx) => {
    const circleRes = await tx.query<{ visibility: CircleVisibility }>(
      `SELECT visibility FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );
    if (!circleRes.rows[0]) {
      throw new NotFoundError('Circle not found.');
    }

    const actorMember = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorOwnerId]
    );

    assertCirclePermission('circle.transfer_ownership', circleRes.rows[0].visibility, {
      userId: actorOwnerId,
      circleRole: actorMember.rows[0]?.role ?? null,
      membershipStatus: actorMember.rows[0]?.status ?? null,
    });

    // Promote new owner first so last-owner trigger is always satisfied
    const promoted = await tx.query<CircleMembership>(
      `UPDATE public.circle_memberships
       SET role = 'owner', updated_at = NOW()
       WHERE circle_id = $1 AND user_id = $2 AND status = 'active'
       RETURNING *;`,
      [circleId, newOwnerUserId]
    );
    if (!promoted.rows[0]) {
      throw new ValidationError('New owner must be an active member of the Circle.');
    }

    // Demote previous owner to admin
    await tx.query(
      `UPDATE public.circle_memberships
       SET role = 'admin', updated_at = NOW()
       WHERE circle_id = $1 AND user_id = $2;`,
      [circleId, actorOwnerId]
    );

    await tx.query(
      `UPDATE public.circles SET owner_id = $1, updated_at = NOW() WHERE id = $2;`,
      [newOwnerUserId, circleId]
    );

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2::uuid, $3::uuid, 'circle.ownership_transferred', 'circle', $4::text, $5::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorOwnerId,
        circleId,
        JSON.stringify({ previousOwnerId: actorOwnerId, newOwnerId: newOwnerUserId }),
      ]
    );
  });
}

export async function listCircleMembers(
  actorUserId: string | null,
  circleId: string,
  options?: {
    search?: string;
    role?: CircleRole | 'all';
  }
): Promise<CircleMembership[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const capRes = await tx.query<{ enabled: boolean; settings: Record<string, unknown> }>(
      `SELECT enabled, settings FROM public.circle_capabilities
       WHERE circle_id = $1 AND capability_key = 'member_directory' LIMIT 1;`,
      [circleId]
    );
    const capRow = capRes.rows[0];
    const showBio = capRow?.settings?.showBio !== false;

    const res = await tx.query<
      CircleMembership & {
        username: string;
        display_name: string;
        avatar_url: string | null;
        bio: string;
      }
    >(
      `SELECT m.*,
         COALESCE(p.username, 'member') AS username,
         COALESCE(p.display_name, 'Circle Member') AS display_name,
         p.avatar_url,
         COALESCE(p.bio, '') AS bio
       FROM public.circle_memberships m
       LEFT JOIN public.profiles p ON p.id = m.user_id
       WHERE m.circle_id = $1 AND m.status IN ('active', 'suspended')
       ORDER BY
         CASE m.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'moderator' THEN 3 ELSE 4 END,
         m.joined_at ASC;`,
      [circleId]
    );

    const searchQuery = options?.search?.trim().toLowerCase() ?? '';
    const roleFilter = options?.role && options.role !== 'all' ? options.role : null;

    return res.rows
      .filter((r) => {
        if (roleFilter && r.role !== roleFilter) return false;
        if (searchQuery) {
          const haystack = `${r.display_name} ${r.username} ${showBio ? r.bio : ''}`.toLowerCase();
          if (!haystack.includes(searchQuery)) return false;
        }
        return true;
      })
      .map((r) => ({
        id: r.id,
        circle_id: r.circle_id,
        user_id: r.user_id,
        role: r.role,
        status: r.status,
        joined_at: r.joined_at,
        updated_at: r.updated_at,
        profile: {
          id: r.user_id,
          username: r.username,
          display_name: r.display_name,
          avatar_url: r.avatar_url,
          bio: showBio ? r.bio : '',
        },
      }));
  });
}

export async function listCircleJoinRequests(
  actorUserId: string,
  circleId: string
): Promise<CircleJoinRequest[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<
      CircleJoinRequest & {
        username: string;
        display_name: string;
        email: string;
        avatar_url: string | null;
      }
    >(
      `SELECT jr.*,
         COALESCE(p.username, 'applicant') AS username,
         COALESCE(p.display_name, 'Applicant') AS display_name,
         COALESCE(p.email, '') AS email,
         p.avatar_url
       FROM public.circle_join_requests jr
       LEFT JOIN public.profiles p ON p.id = jr.user_id
       WHERE jr.circle_id = $1
       ORDER BY
         CASE jr.status WHEN 'pending' THEN 1 ELSE 2 END,
         jr.created_at DESC;`,
      [circleId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      circle_id: r.circle_id,
      user_id: r.user_id,
      message: r.message,
      status: r.status,
      reviewed_by: r.reviewed_by,
      reviewed_at: r.reviewed_at,
      review_note: r.review_note,
      created_at: r.created_at,
      updated_at: r.updated_at,
      profile: {
        id: r.user_id,
        username: r.username,
        display_name: r.display_name,
        email: r.email,
        avatar_url: r.avatar_url,
      },
    }));
  });
}

export async function listCircleInvitations(
  actorUserId: string,
  circleId: string
): Promise<CircleInvitation[]> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const res = await tx.query<CircleInvitation>(
      `SELECT id, circle_id, inviter_id, invited_email, invited_user_id, role, status, expires_at, accepted_at, created_at
       FROM public.circle_invitations
       WHERE circle_id = $1
       ORDER BY created_at DESC;`,
      [circleId]
    );
    return res.rows;
  });
}

function generateCleanInviteCode(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let result = 'c-';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export async function createInviteLink(
  actorUserId: string,
  circleId: string,
  options?: {
    role?: Exclude<CircleRole, 'owner'>;
    maxUses?: number | null;
    expiresInDays?: number | null;
  }
): Promise<{ inviteLink: CircleInviteLink; inviteUrl: string }> {
  return withServiceRoleTransaction(async (tx) => {
    const circleRes = await tx.query<{
      id: string;
      name: string;
      slug: string;
      visibility: CircleVisibility;
      status: string;
    }>(`SELECT id, name, slug, visibility, status FROM public.circles WHERE id = $1 LIMIT 1;`, [circleId]);
    const circle = circleRes.rows[0];
    if (!circle || circle.status !== 'active') {
      throw new NotFoundError('Circle not found or inactive.');
    }

    const actorMember = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    assertCirclePermission('circle.invite', circle.visibility, {
      userId: actorUserId,
      circleRole: actorMember.rows[0]?.role ?? null,
      membershipStatus: actorMember.rows[0]?.status ?? null,
    });

    const targetRole = options?.role || 'member';
    if (targetRole === 'admin' && actorMember.rows[0]?.role !== 'owner') {
      throw new ForbiddenError('Only a Circle owner can create an invitation link for administrators.');
    }

    const code = generateCleanInviteCode();
    const invId = crypto.randomUUID();
    const maxUses = options?.maxUses && options.maxUses > 0 ? options.maxUses : null;
    const expiresAt =
      options?.expiresInDays && options.expiresInDays > 0
        ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const res = await tx.query<CircleInviteLink>(
      `INSERT INTO public.circle_invite_links (
         id, circle_id, created_by, code, role, max_uses, uses_count, expires_at, is_revoked, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, false, NOW())
       RETURNING id, circle_id, created_by, code, role, max_uses, uses_count, expires_at, is_revoked, created_at;`,
      [invId, circleId, actorUserId, code, targetRole, maxUses, expiresAt]
    );

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'invite_link.created', 'circle_invite_link', $4, $5::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        invId,
        JSON.stringify({ code, role: targetRole, maxUses, expiresAt }),
      ]
    );

    return {
      inviteLink: {
        ...res.rows[0],
        circle_name: circle.name,
        circle_slug: circle.slug,
      },
      inviteUrl: `/invite/${code}`,
    };
  });
}

export async function getOrCreateDefaultInviteLink(
  actorUserId: string,
  circleId: string
): Promise<{ inviteLink: CircleInviteLink; inviteUrl: string }> {
  const existing = await withServiceRoleTransaction(async (tx) => {
    const res = await tx.query<CircleInviteLink>(
      `SELECT l.*, c.name AS circle_name, c.slug AS circle_slug
       FROM public.circle_invite_links l
       JOIN public.circles c ON c.id = l.circle_id
       WHERE l.circle_id = $1
         AND l.role = 'member'
         AND l.is_revoked = false
         AND (l.expires_at IS NULL OR l.expires_at > NOW())
         AND (l.max_uses IS NULL OR l.uses_count < l.max_uses)
       ORDER BY l.created_at DESC
       LIMIT 1;`,
      [circleId]
    );
    return res.rows[0];
  });

  if (existing) {
    return {
      inviteLink: existing,
      inviteUrl: `/invite/${existing.code}`,
    };
  }

  // Otherwise create a default 30-day link
  return createInviteLink(actorUserId, circleId, {
    role: 'member',
    expiresInDays: 30,
  });
}

export async function getInviteLinkByCode(
  code: string,
  currentUserId?: string | null
): Promise<{
  inviteLink: CircleInviteLink;
  circle: Circle;
  inviterName: string;
  isValid: boolean;
  invalidReason?: string;
  isAlreadyMember: boolean;
}> {
  return withServiceRoleTransaction(async (tx) => {
    const cleanCode = code.trim().toLowerCase();
    const res = await tx.query<
      CircleInviteLink & {
        circle_name: string;
        circle_slug: string;
        circle_description: string;
        circle_category: string;
        circle_location: string | null;
        circle_avatar_url: string | null;
        circle_cover_url: string | null;
        circle_visibility: CircleVisibility;
        circle_membership_policy: MembershipPolicy;
        circle_status: 'active' | 'archived' | 'suspended';
        circle_owner_id: string;
        circle_template_key: string | null;
        circle_template_version: number | null;
        circle_settings: Record<string, unknown>;
        circle_created_at: string;
        circle_updated_at: string;
        inviter_name: string;
      }
    >(
      `SELECT l.*,
              c.name AS circle_name,
              c.slug AS circle_slug,
              c.description AS circle_description,
              c.category AS circle_category,
              c.location AS circle_location,
              c.avatar_url AS circle_avatar_url,
              c.cover_url AS circle_cover_url,
              c.visibility AS circle_visibility,
              c.membership_policy AS circle_membership_policy,
              c.status AS circle_status,
              c.owner_id AS circle_owner_id,
              c.template_key AS circle_template_key,
              c.template_version AS circle_template_version,
              c.settings AS circle_settings,
              c.created_at AS circle_created_at,
              c.updated_at AS circle_updated_at,
              COALESCE(p.display_name, p.username, 'A community member') AS inviter_name
       FROM public.circle_invite_links l
       JOIN public.circles c ON c.id = l.circle_id
       JOIN public.profiles p ON p.id = l.created_by
       WHERE lower(l.code) = $1
       LIMIT 1;`,
      [cleanCode]
    );

    const row = res.rows[0];
    if (!row) {
      throw new NotFoundError('Invitation link not found or invalid.');
    }

    // Get current member count
    const countRes = await tx.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM public.circle_memberships WHERE circle_id = $1 AND status = 'active';`,
      [row.circle_id]
    );

    const circle: Circle = {
      id: row.circle_id,
      name: row.circle_name,
      slug: row.circle_slug,
      description: row.circle_description,
      category: row.circle_category as CircleCategory,
      location: row.circle_location,
      avatar_url: row.circle_avatar_url,
      cover_url: row.circle_cover_url,
      visibility: row.circle_visibility,
      membership_policy: row.circle_membership_policy,
      status: row.circle_status,
      owner_id: row.circle_owner_id,
      template_key: row.circle_template_key,
      template_version: row.circle_template_version,
      settings: row.circle_settings || {},
      created_at: row.circle_created_at,
      updated_at: row.circle_updated_at,
      member_count: parseInt(countRes.rows[0]?.cnt || '1', 10),
    };

    let isValid = true;
    let invalidReason: string | undefined;

    if (row.is_revoked) {
      isValid = false;
      invalidReason = 'This invitation link has been revoked by an administrator.';
    } else if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      isValid = false;
      invalidReason = 'This invitation link has expired.';
    } else if (row.max_uses !== null && row.uses_count >= row.max_uses) {
      isValid = false;
      invalidReason = 'This invitation link has reached its maximum uses.';
    }

    let isAlreadyMember = false;
    if (currentUserId) {
      const memberRes = await tx.query<{ status: string }>(
        `SELECT status FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
        [row.circle_id, currentUserId]
      );
      if (memberRes.rows[0]?.status === 'active') {
        isAlreadyMember = true;
      }
    }

    const inviteLink: CircleInviteLink = {
      id: row.id,
      circle_id: row.circle_id,
      created_by: row.created_by,
      code: row.code,
      role: row.role,
      max_uses: row.max_uses,
      uses_count: row.uses_count,
      expires_at: row.expires_at,
      is_revoked: row.is_revoked,
      created_at: row.created_at,
      creator_name: row.inviter_name,
      circle_name: row.circle_name,
      circle_slug: row.circle_slug,
    };

    return {
      inviteLink,
      circle,
      inviterName: row.inviter_name,
      isValid,
      invalidReason,
      isAlreadyMember,
    };
  });
}

export async function acceptInviteLink(
  actorUserId: string,
  code: string
): Promise<{ membership: CircleMembership; circleSlug: string }> {
  return withServiceRoleTransaction(async (tx) => {
    const cleanCode = code.trim().toLowerCase();
    const res = await tx.query<
      CircleInviteLink & {
        circle_slug: string;
        circle_name: string;
      }
    >(
      `SELECT l.*, c.slug AS circle_slug, c.name AS circle_name
       FROM public.circle_invite_links l
       JOIN public.circles c ON c.id = l.circle_id
       WHERE lower(l.code) = $1
       LIMIT 1;`,
      [cleanCode]
    );

    const link = res.rows[0];
    if (!link) {
      throw new NotFoundError('Invitation link not found or invalid.');
    }
    if (link.is_revoked) {
      throw new ConflictError('This invitation link has been revoked.');
    }
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      throw new ValidationError('This invitation link has expired.');
    }
    if (link.max_uses !== null && link.uses_count >= link.max_uses) {
      throw new ConflictError('This invitation link has reached its maximum uses.');
    }

    // Check if user is suspended
    const existing = await tx.query<{ id: string; role: CircleRole; status: MembershipStatus }>(
      `SELECT id, role, status FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [link.circle_id, actorUserId]
    );

    if (existing.rows[0]?.status === 'suspended') {
      throw new ForbiddenError('You have been suspended from this community.');
    }

    if (existing.rows[0]?.status === 'active') {
      const activeMember = await tx.query<CircleMembership>(
        `SELECT * FROM public.circle_memberships WHERE id = $1 LIMIT 1;`,
        [existing.rows[0].id]
      );
      return {
        membership: activeMember.rows[0],
        circleSlug: link.circle_slug,
      };
    }

    // Increment uses_count
    await tx.query(
      `UPDATE public.circle_invite_links SET uses_count = uses_count + 1 WHERE id = $1;`,
      [link.id]
    );

    // Record usage
    await tx.query(
      `INSERT INTO public.circle_invite_link_uses (id, invite_link_id, user_id, circle_id, used_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (invite_link_id, user_id) DO NOTHING;`,
      [crypto.randomUUID(), link.id, actorUserId, link.circle_id]
    );

    // Insert or update membership
    const memberRes = await tx.query<CircleMembership>(
      `INSERT INTO public.circle_memberships (id, circle_id, user_id, role, status, joined_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
       ON CONFLICT (circle_id, user_id)
       DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = NOW()
       RETURNING *;`,
      [crypto.randomUUID(), link.circle_id, actorUserId, link.role]
    );

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'invite_link.accepted', 'circle_membership', $4, $5::jsonb);`,
      [
        crypto.randomUUID(),
        link.circle_id,
        actorUserId,
        memberRes.rows[0].id,
        JSON.stringify({ code: link.code, role: link.role }),
      ]
    );

    return {
      membership: memberRes.rows[0],
      circleSlug: link.circle_slug,
    };
  });
}

export async function listCircleInviteLinks(
  actorUserId: string,
  circleId: string
): Promise<CircleInviteLink[]> {
  return withServiceRoleTransaction(async (tx) => {
    const actorMember = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const circle = await tx.query<{ visibility: CircleVisibility }>(
      `SELECT visibility FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );
    assertCirclePermission('circle.invite', circle.rows[0]?.visibility || 'public', {
      userId: actorUserId,
      circleRole: actorMember.rows[0]?.role ?? null,
      membershipStatus: actorMember.rows[0]?.status ?? null,
    });

    const res = await tx.query<
      CircleInviteLink & {
        creator_name: string;
      }
    >(
      `SELECT l.*,
              COALESCE(p.display_name, p.username, 'Staff') AS creator_name
       FROM public.circle_invite_links l
       LEFT JOIN public.profiles p ON p.id = l.created_by
       WHERE l.circle_id = $1
       ORDER BY l.created_at DESC;`,
      [circleId]
    );

    return res.rows;
  });
}

export async function revokeInviteLink(
  actorUserId: string,
  circleId: string,
  inviteLinkId: string
): Promise<void> {
  return withServiceRoleTransaction(async (tx) => {
    const actorMember = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const circle = await tx.query<{ visibility: CircleVisibility }>(
      `SELECT visibility FROM public.circles WHERE id = $1 LIMIT 1;`,
      [circleId]
    );
    assertCirclePermission('circle.invite', circle.rows[0]?.visibility || 'public', {
      userId: actorUserId,
      circleRole: actorMember.rows[0]?.role ?? null,
      membershipStatus: actorMember.rows[0]?.status ?? null,
    });

    await tx.query(
      `UPDATE public.circle_invite_links SET is_revoked = true WHERE id = $1 AND circle_id = $2;`,
      [inviteLinkId, circleId]
    );

    await tx.query(
      `INSERT INTO public.audit_logs (id, circle_id, actor_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, 'invite_link.revoked', 'circle_invite_link', $4, $5::jsonb);`,
      [
        crypto.randomUUID(),
        circleId,
        actorUserId,
        inviteLinkId,
        JSON.stringify({ inviteLinkId }),
      ]
    );
  });
}
