import { describe, expect, it } from 'vitest';
import {
  acceptInviteLink,
  createInviteLink,
  getInviteLinkByCode,
  getOrCreateDefaultInviteLink,
  listCircleInviteLinks,
  revokeInviteLink,
  updateMemberRole,
} from '@/features/memberships/service';
import { createCircle } from '@/features/circles/service';
import { registerUser } from '@/features/auth/service';
import { ConflictError, ForbiddenError, ValidationError } from '@/lib/errors';
import { withRlsTransaction } from '@/lib/db/postgres';

describe('Community Invitation by Link Integration Suite', () => {
  it('1. Generates shareable invite links, resolves preview metadata, and allows members to join via link', async () => {
    const suffix = Date.now() + 10;
    const owner = (
      await registerUser({
        email: `invite-owner-${suffix}@example.com`,
        username: `inv_owner_${suffix}`,
        displayName: 'Invite Community Owner',
        password: 'Password123!',
      })
    ).user;

    const newcomer = (
      await registerUser({
        email: `newcomer-${suffix}@example.com`,
        username: `newcomer_${suffix}`,
        displayName: 'Excited Newcomer',
        password: 'Password123!',
      })
    ).user;

    const circle = await createCircle(owner.id, {
      name: `Link Invite Circle ${suffix}`,
      slug: `link-invite-${suffix}`,
      description: 'A thriving community testing shareable link invitations.',
      category: 'general',
      visibility: 'public',
      membershipPolicy: 'open',
      templateKey: 'custom',
    });

    // 1. Get or create default invite link
    const defaultRes = await getOrCreateDefaultInviteLink(owner.id, circle.id);
    expect(defaultRes.inviteLink).toBeDefined();
    expect(defaultRes.inviteLink.code).toMatch(/^c-/);
    expect(defaultRes.inviteUrl).toBe(`/invite/${defaultRes.inviteLink.code}`);
    expect(defaultRes.inviteLink.role).toBe('member');

    // Re-fetching default link returns the existing one (idempotent)
    const secondFetch = await getOrCreateDefaultInviteLink(owner.id, circle.id);
    expect(secondFetch.inviteLink.id).toBe(defaultRes.inviteLink.id);

    // 2. Resolve preview metadata for visitor/newcomer
    const preview = await getInviteLinkByCode(defaultRes.inviteLink.code, newcomer.id);
    expect(preview.isValid).toBe(true);
    expect(preview.circle.id).toBe(circle.id);
    expect(preview.circle.name).toBe(circle.name);
    expect(preview.inviterName).toBe(owner.display_name);
    expect(preview.isAlreadyMember).toBe(false);

    // 3. Newcomer accepts invitation link
    const acceptRes = await acceptInviteLink(newcomer.id, defaultRes.inviteLink.code);
    expect(acceptRes.circleSlug).toBe(circle.slug);
    expect(acceptRes.membership.role).toBe('member');
    expect(acceptRes.membership.status).toBe('active');

    // Verify preview now recognizes they are already a member
    const previewAfter = await getInviteLinkByCode(defaultRes.inviteLink.code, newcomer.id);
    expect(previewAfter.isAlreadyMember).toBe(true);
    expect(previewAfter.circle.member_count).toBe(2);

    // Accepting again is a safe no-op returning existing membership
    const acceptAgain = await acceptInviteLink(newcomer.id, defaultRes.inviteLink.code);
    expect(acceptAgain.membership.status).toBe('active');
  });

  it('2. Enforces link capacity (max_uses) and expiration limits', async () => {
    const suffix = Date.now() + 20;
    const owner = (
      await registerUser({
        email: `cap-owner-${suffix}@example.com`,
        username: `cap_owner_${suffix}`,
        displayName: 'Capacity Owner',
        password: 'Password123!',
      })
    ).user;

    const user1 = (
      await registerUser({
        email: `user1-${suffix}@example.com`,
        username: `user1_${suffix}`,
        displayName: 'User One',
        password: 'Password123!',
      })
    ).user;

    const user2 = (
      await registerUser({
        email: `user2-${suffix}@example.com`,
        username: `user2_${suffix}`,
        displayName: 'User Two',
        password: 'Password123!',
      })
    ).user;

    const circle = await createCircle(owner.id, {
      name: `Capped Invite Circle ${suffix}`,
      slug: `capped-invite-${suffix}`,
      description: 'Testing max uses cap.',
      category: 'general',
      visibility: 'public',
      membershipPolicy: 'open',
      templateKey: 'custom',
    });

    // Create a 1-use invite link
    const limitedLink = await createInviteLink(owner.id, circle.id, {
      role: 'member',
      maxUses: 1,
      expiresInDays: 7,
    });
    expect(limitedLink.inviteLink.max_uses).toBe(1);
    expect(limitedLink.inviteLink.uses_count).toBe(0);

    // User 1 joins -> succeeds and consumes the only slot
    await acceptInviteLink(user1.id, limitedLink.inviteLink.code);

    // User 2 attempts to join -> rejected due to max uses reached
    await expect(acceptInviteLink(user2.id, limitedLink.inviteLink.code)).rejects.toThrow(
      ConflictError
    );

    const preview = await getInviteLinkByCode(limitedLink.inviteLink.code, user2.id);
    expect(preview.isValid).toBe(false);
    expect(preview.invalidReason).toContain('maximum uses');
  });

  it('3. Supports revoking invite links and prevents suspended users from joining', async () => {
    const suffix = Date.now() + 30;
    const owner = (
      await registerUser({
        email: `rev-owner-${suffix}@example.com`,
        username: `rev_owner_${suffix}`,
        displayName: 'Revocation Owner',
        password: 'Password123!',
      })
    ).user;

    const badActor = (
      await registerUser({
        email: `bad-actor-${suffix}@example.com`,
        username: `bad_actor_${suffix}`,
        displayName: 'Bad Actor',
        password: 'Password123!',
      })
    ).user;

    const normalUser = (
      await registerUser({
        email: `normal-${suffix}@example.com`,
        username: `normal_${suffix}`,
        displayName: 'Normal User',
        password: 'Password123!',
      })
    ).user;

    const circle = await createCircle(owner.id, {
      name: `Revocation Circle ${suffix}`,
      slug: `rev-circle-${suffix}`,
      description: 'Testing revocation and suspensions.',
      category: 'general',
      visibility: 'public',
      membershipPolicy: 'open',
      templateKey: 'custom',
    });

    const linkRes = await createInviteLink(owner.id, circle.id, {
      role: 'member',
    });

    // Staff lists invite links
    const linksList = await listCircleInviteLinks(owner.id, circle.id);
    expect(linksList.length).toBeGreaterThanOrEqual(1);

    // 1. Suspend badActor in this circle
    await withRlsTransaction(owner.id, async (tx) => {
      await tx.query(
        `INSERT INTO public.circle_memberships (id, circle_id, user_id, role, status)
         VALUES (gen_random_uuid(), $1, $2, 'member', 'suspended');`,
        [circle.id, badActor.id]
      );
    });

    // Suspended user cannot bypass suspension using invite link
    await expect(acceptInviteLink(badActor.id, linkRes.inviteLink.code)).rejects.toThrow(
      ForbiddenError
    );

    // 2. Revoke the invite link
    await revokeInviteLink(owner.id, circle.id, linkRes.inviteLink.id);

    // Normal user attempts to join via revoked link -> rejected
    await expect(acceptInviteLink(normalUser.id, linkRes.inviteLink.code)).rejects.toThrow(
      ConflictError
    );

    const preview = await getInviteLinkByCode(linkRes.inviteLink.code, normalUser.id);
    expect(preview.isValid).toBe(false);
    expect(preview.invalidReason).toContain('revoked');
  });
});
