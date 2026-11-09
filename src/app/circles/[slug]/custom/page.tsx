import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lock, ShieldAlert } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { getPlatformFeatureFlags } from '@/features/admin/service';
import {
  BUILT_IN_CUSTOM_FEATURE_TEMPLATES,
  listCircleCustomModules,
} from '@/features/custom-modules/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { CustomFeaturesHubClient } from '@/components/circles/custom-features-hub-client';

export const dynamic = 'force-dynamic';

export default async function CircleCustomFeaturesHubPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await getAuthenticatedUser();
  const circle = await getCircleBySlugOrId(user?.id ?? null, params.slug);
  if (!circle) {
    notFound();
  }

  const flags = await getPlatformFeatureFlags();
  if (!flags.custom_features_builder) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center space-y-3">
        <ShieldAlert className="mx-auto h-7 w-7 text-stone-400" />
        <h2 className="text-base font-bold text-stone-900">
          Custom Features Builder is Currently Disabled
        </h2>
        <p className="text-xs text-stone-500 max-w-md mx-auto">
          The Custom Features & Mini-Apps Builder is currently turned off globally and can be enabled anytime from Circles Central Admin.
        </p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Link
            href={`/circles/${circle.slug}`}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            Back to {circle.name}
          </Link>
          {user?.is_platform_admin && (
            <Link
              href="/admin"
              className="rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              Open Circles Central Admin
            </Link>
          )}
        </div>
      </div>
    );
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
          Join this Circle to view or build custom community features.
        </p>
      </div>
    );
  }

  let modulesData = {
    modules: [] as Awaited<ReturnType<typeof listCircleCustomModules>>['modules'],
    sharedTemplates: BUILT_IN_CUSTOM_FEATURE_TEMPLATES,
  };
  try {
    modulesData = await listCircleCustomModules(user?.id ?? null, circle.id);
  } catch {
    // Fallback if table not yet initialized
  }

  const isMember = circle.current_user_membership_status === 'active';
  const isStaff =
    isMember &&
    (circle.current_user_role === 'owner' ||
      circle.current_user_role === 'admin' ||
      circle.current_user_role === 'moderator');

  return (
    <CustomFeaturesHubClient
      circleId={circle.id}
      circleSlug={circle.slug}
      circleName={circle.name}
      initialModules={modulesData.modules}
      sharedTemplates={modulesData.sharedTemplates}
      isMember={isMember}
      isStaff={isStaff}
    />
  );
}
