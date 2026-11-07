import React from 'react';
import { notFound } from 'next/navigation';
import { Lock } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { getCustomModuleWithEntries } from '@/features/custom-modules/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { CustomModuleViewClient } from '@/components/circles/custom-module-view-client';

export const dynamic = 'force-dynamic';

export default async function CircleCustomModulePage({
  params,
}: {
  params: { slug: string; moduleSlug: string };
}) {
  const user = await getAuthenticatedUser();
  const circle = await getCircleBySlugOrId(user?.id ?? null, params.slug);
  if (!circle) {
    notFound();
  }

  const canRead = canReadCircleContent(circle.visibility, {
    userId: user?.id ?? null,
    isPlatformAdmin: user?.is_platform_admin,
    circleRole: circle.current_user_role,
    membershipStatus: circle.current_user_membership_status,
  });

  if (!canRead) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
        <Lock className="mx-auto h-6 w-6 text-stone-400" />
        <h2 className="mt-3 text-base font-bold text-stone-900">Members Only</h2>
        <p className="mt-1 text-xs text-stone-500">
          Join this Circle to view and participate in this custom feature.
        </p>
      </div>
    );
  }

  let data;
  try {
    data = await getCustomModuleWithEntries(
      user?.id ?? null,
      circle.id,
      params.moduleSlug
    );
  } catch {
    notFound();
  }

  const isMember = circle.current_user_membership_status === 'active';
  const isStaff =
    isMember &&
    (circle.current_user_role === 'owner' ||
      circle.current_user_role === 'admin' ||
      circle.current_user_role === 'moderator');

  return (
    <CustomModuleViewClient
      circleId={circle.id}
      circleSlug={circle.slug}
      initialModule={data.module}
      initialEntries={data.entries}
      currentUserId={user?.id ?? null}
      isMember={isMember}
      isStaff={isStaff}
    />
  );
}
