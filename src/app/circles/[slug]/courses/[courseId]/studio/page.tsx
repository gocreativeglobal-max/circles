import React from 'react';
import { notFound, redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { getCourseWithCurriculum } from '@/features/courses/service';
import { getCircleCapabilities } from '@/features/capabilities/service';
import { CourseStudioClient } from '@/components/courses/course-studio-client';
import { CourseItem } from '@/types/domain';

export const dynamic = 'force-dynamic';

export default async function CircleCourseStudioPage({
  params,
}: {
  params: { slug: string; courseId: string };
}) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect(`/login?next=/circles/${params.slug}/courses/${params.courseId}/studio`);
  }

  const circle = await getCircleBySlugOrId(user.id, params.slug);
  if (!circle) {
    notFound();
  }

  let course: CourseItem;
  try {
    course = await getCourseWithCurriculum(
      user.id,
      circle.id,
      params.courseId
    );
  } catch {
    notFound();
  }

  const isStaff =
    circle.current_user_role === 'owner' ||
    circle.current_user_role === 'admin' ||
    circle.current_user_role === 'moderator' ||
    course.instructor_id === user.id;

  if (!isStaff) {
    redirect(`/circles/${circle.slug}/courses/${course.id}`);
  }

  const capabilities = await getCircleCapabilities(user.id, circle.id);
  const isFinancesEnabled = capabilities.some(
    (c) => (c.capability_key === 'payments_finances' || c.capability_key === 'finances') && c.enabled
  );

  return (
    <CourseStudioClient
      circleId={circle.id}
      circleSlug={circle.slug}
      initialCourse={JSON.parse(JSON.stringify(course))}
      isStaff={isStaff}
      isFinancesEnabled={isFinancesEnabled}
    />
  );
}
