import React from 'react';
import { notFound } from 'next/navigation';
import { Lock } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { getCircleNavigation } from '@/features/capabilities/service';
import { getCircleActivityStream } from '@/features/circles/activity-stream';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { CircleOnboardingChecklist } from '@/components/circles/onboarding-checklist';
import { CommunityActivityStream } from '@/components/circles/community-activity-stream';

export const dynamic = 'force-dynamic';

export default async function CircleOverviewPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await getAuthenticatedUser();
  const circle = await getCircleBySlugOrId(user?.id ?? null, params.slug);
  if (!circle) {
    notFound();
  }

  const canReadContent = canReadCircleContent(circle.visibility, {
    userId: user?.id ?? null,
    isPlatformAdmin: user?.is_platform_admin,
    circleRole: circle.current_user_role,
    membershipStatus: circle.current_user_membership_status,
  });

  const navigation = await getCircleNavigation(user?.id ?? null, circle.id, circle.slug);

  // Fetch unified activity stream (posts, marketplace/housing items, events, polls)
  const streamData = canReadContent
    ? await getCircleActivityStream(
        user?.id ?? null,
        circle.id,
        navigation.enabledCapabilityKeys
      )
    : {
        items: [],
        upcomingEvents: [],
        featuredListings: [],
        featuredCourses: [],
        counts: { posts: 0, listings: 0, events: 0, polls: 0, courses: 0, resources: 0, all: 0 },
      };

  const isMember = circle.current_user_membership_status === 'active';

  return (
    <div className="space-y-6">
      {canReadContent && (
        <CircleOnboardingChecklist
          circle={circle}
          currentUser={user}
          hasPosts={streamData.counts.posts > 0}
          enabledCapabilityKeys={navigation.enabledCapabilityKeys}
        />
      )}

      {!canReadContent ? (
        <section className="rounded-xl border border-stone-200 bg-white p-10 text-center">
          <Lock className="mx-auto h-6 w-6 text-stone-400" />
          <h2 className="mt-3 text-base font-semibold text-stone-900">Members only</h2>
          <p className="mt-1 text-sm text-stone-500">Join to see what&apos;s happening.</p>
        </section>
      ) : (
        <section className="space-y-4">
          <CommunityActivityStream
            circle={circle}
            initialItems={streamData.items}
            upcomingEvents={streamData.upcomingEvents}
            featuredListings={streamData.featuredListings}
            featuredCourses={streamData.featuredCourses}
            enabledCapabilityKeys={navigation.enabledCapabilityKeys}
            currentUserId={user?.id ?? null}
            isMember={isMember}
          />
        </section>
      )}
    </div>
  );
}
