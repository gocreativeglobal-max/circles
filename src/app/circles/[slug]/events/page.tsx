import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calendar, Lock, Sliders } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { listCircleEvents } from '@/features/events/service';
import { listCircleSpaces } from '@/features/spaces/service';
import { listCircleMembers } from '@/features/memberships/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { isCapabilityDisabledError } from '@/lib/errors';
import { logger } from '@/lib/logging';
import { EventsBoard } from '@/components/circles/events-board';
import { CircleEventItem, CircleMembership, CircleSpace } from '@/types/domain';

export const dynamic = 'force-dynamic';

export default async function CircleEventsPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await getAuthenticatedUser();
  const circle = await getCircleBySlugOrId(user?.id ?? null, params.slug);
  if (!circle) {
    notFound();
  }

  const isMember = circle.current_user_membership_status === 'active';
  const isStaff =
    circle.current_user_role === 'owner' ||
    circle.current_user_role === 'admin' ||
    circle.current_user_role === 'moderator';

  const canRead = canReadCircleContent(circle.visibility, {
    userId: user?.id ?? null,
    isPlatformAdmin: user?.is_platform_admin,
    circleRole: circle.current_user_role,
    membershipStatus: circle.current_user_membership_status,
  });

  if (!canRead) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-white p-10 text-center shadow-sm">
        <Lock className="mx-auto h-8 w-8 text-amber-600" />
        <h2 className="mt-3 text-lg font-bold text-stone-900">Members-Only Events</h2>
        <p className="mt-1 text-sm text-stone-600">
          Join this Circle to view and RSVP to upcoming community events.
        </p>
      </div>
    );
  }

  let events: CircleEventItem[] = [];
  try {
    events = await listCircleEvents(user?.id ?? null, circle.id);
  } catch (err) {
    if (isCapabilityDisabledError(err)) {
      return (
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-2xl border border-stone-200/90 bg-white p-10 text-center shadow-xs">
            <Calendar className="mx-auto h-8 w-8 text-stone-400" />
            <h2 className="mt-3 text-lg font-bold text-stone-900">Events Capability Disabled</h2>
            <p className="mt-1 text-sm text-stone-600 max-w-md mx-auto">
              Enable Events in Circle Studio to schedule gatherings, host live sessions, and track RSVPs.
            </p>
            {isStaff && (
              <div className="mt-6 flex justify-center">
                <Link
                  href={`/circles/${circle.slug}/studio?tab=capabilities`}
                  className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-stone-800 transition-colors"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>Open Studio to Enable Events</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      );
    }

    logger.error('Failed to load circle events list', {
      error: err instanceof Error ? err.message : String(err),
      circleId: circle.id,
      slug: params.slug,
    });
    // In case of a database issue or missing migration, don't crash or falsely claim the capability is disabled!
    events = [];
  }

  let spaces: CircleSpace[] = [];
  try {
    spaces = await listCircleSpaces(user?.id ?? null, circle.id);
  } catch {
    spaces = [];
  }

  let members: CircleMembership[] = [];
  try {
    members = await listCircleMembers(user?.id ?? null, circle.id);
  } catch {
    members = [];
  }

  return (
    <EventsBoard
      circleId={circle.id}
      circleSlug={circle.slug}
      circleName={circle.name}
      initialEvents={events}
      canCreateEvent={isMember}
      isMember={isMember}
      currentUserId={user?.id ?? null}
      currentUserRole={circle.current_user_role ?? null}
      spaces={spaces}
      members={members}
    />
  );
}
