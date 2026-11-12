import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import {
  getCourseWithCurriculum,
  recordLiveAttendance,
  getCourseLiveAttendanceSummary,
} from '@/features/courses/service';
import { generateIcsFileContent } from '@/lib/courses/cohort-helpers';
import { handleApiError } from '@/lib/auth/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string; courseId: string } }
) {
  try {
    const user = await getAuthenticatedUser();
    const format = req.nextUrl.searchParams.get('format');

    // 1. Download .ics iCalendar file directly
    if (format === 'ics') {
      const course = await getCourseWithCurriculum(
        user?.id ?? null,
        params.circleId,
        params.courseId
      );

      const icsContent = generateIcsFileContent({
        title: course.title,
        description: course.description,
        startDate: course.cohort_start_date,
        endDate: course.cohort_end_date,
        meetingUrl: course.cohort_meeting_url,
      });

      const filename = `${course.slug || 'live-class'}.ics`;

      return new NextResponse(icsContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-cache',
        },
      });
    }

    // 2. Fetch live attendance summary for instructor dashboard
    if (format === 'summary') {
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const summary = await getCourseLiveAttendanceSummary(
        user.id,
        params.circleId,
        params.courseId
      );
      return NextResponse.json(summary);
    }

    // 3. Live Join Relay: Authenticate user, verify entitlement, record attendance & redirect
    if (!user) {
      const returnUrl = req.nextUrl.pathname;
      const loginUrl = new URL(`/login?next=${encodeURIComponent(returnUrl)}`, req.url);
      return NextResponse.redirect(loginUrl);
    }

    const result = await recordLiveAttendance(user.id, params.circleId, params.courseId);

    // If API client explicitly requests JSON (e.g. from frontend button fetch)
    if (format === 'json' || req.headers.get('accept')?.includes('application/json')) {
      return NextResponse.json(result);
    }

    // Standard Luma-style relay: 302 Redirect to real Google Meet / Zoom meeting
    return NextResponse.redirect(new URL(result.meetingUrl), 302);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { circleId: string; courseId: string } }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await recordLiveAttendance(user.id, params.circleId, params.courseId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
