import React from 'react';
import { notFound } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getInviteLinkByCode } from '@/features/memberships/service';
import { InviteLandingClient } from '@/components/invite/invite-landing-client';

export const dynamic = 'force-dynamic';

export default async function InviteLinkPage({
  params,
}: {
  params: { code: string };
}) {
  const user = await getAuthenticatedUser();
  let inviteData;
  try {
    inviteData = await getInviteLinkByCode(params.code, user?.id ?? null);
  } catch {
    notFound();
  }

  return (
    <InviteLandingClient
      inviteLink={inviteData.inviteLink}
      circle={inviteData.circle}
      inviterName={inviteData.inviterName}
      isValid={inviteData.isValid}
      invalidReason={inviteData.invalidReason}
      isAlreadyMember={inviteData.isAlreadyMember}
      isAuthenticated={Boolean(user)}
    />
  );
}
