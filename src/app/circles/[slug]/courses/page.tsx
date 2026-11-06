import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GraduationCap, Lock, Sliders } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { listCourses } from '@/features/courses/service';
import { canReadCircleContent } from '@/lib/authorization/permissions';
import { CoursesCatalog } from '@/components/courses/courses-catalog';
import { CourseItem } from '@/types/domain';
import { isCapabilityDisabledError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export default async function CircleCoursesPage({
  params,
}: {
  params: { slug: string };
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
      <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center shadow-xs">
        <Lock className="mx-auto h-8 w-8 text-stone-600" />
        <h2 className="mt-3 text-lg font-bold text-stone-900">Members-Only Courses</h2>
        <p className="mt-1 text-sm text-stone-600">
          Join this Circle to access structured video courses and curriculum modules.
        </p>
      </div>
    );
  }

  const isMember = circle.current_user_membership_status === 'active';
  const isStaff =
    circle.current_user_role === 'owner' ||
    circle.current_user_role === 'admin' ||
    circle.current_user_role === 'moderator';

  let courses: CourseItem[] = [];
  try {
    courses = await listCourses(user?.id ?? null, circle.id);
  } catch (err) {
    if (isCapabilityDisabledError(err)) {
      return (
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="rounded-2xl border border-stone-200/90 bg-white p-10 text-center shadow-xs">
            <GraduationCap className="mx-auto h-8 w-8 text-stone-400" />
            <h2 className="mt-3 text-lg font-bold text-stone-900">Courses Capability Disabled</h2>
            <p className="mt-1 text-sm text-stone-600 max-w-md mx-auto">
              Enable Courses & Learning in Circle Studio to author curriculum modules, video lessons, and interactive quizzes for your community.
            </p>
            {isStaff ? (
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href={`/circles/${circle.slug}/studio?tab=capabilities`}
                  className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-stone-800 transition-colors"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  Enable Courses in Circle Studio
                </Link>
                <Link
                  href={`/circles/${circle.slug}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Back to Circle Feed
                </Link>
              </div>
            ) : (
              <div className="mt-6 flex justify-center">
                <Link
                  href={`/circles/${circle.slug}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Back to Circle Feed
                </Link>
              </div>
            )}
          </div>
        </div>
      );
    }

    console.error('Failed to list courses:', err);
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-10 text-center shadow-xs">
          <GraduationCap className="mx-auto h-8 w-8 text-rose-500" />
          <h2 className="mt-3 text-lg font-bold text-stone-900">Unable to Load Courses</h2>
          <p className="mt-1 text-sm text-stone-600 max-w-md mx-auto">
            An issue occurred while retrieving the course catalog. Please refresh the page or return to the Circle.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href={`/circles/${circle.slug}/courses`}
              className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-stone-800 transition-colors"
            >
              Try Again
            </Link>
            <Link
              href={`/circles/${circle.slug}`}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
            >
              Return to Circle Feed
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CoursesCatalog
      circleId={circle.id}
      circleSlug={circle.slug}
      initialCourses={JSON.parse(JSON.stringify(courses))}
      isMember={isMember}
      isStaff={isStaff}
    />
  );
}
