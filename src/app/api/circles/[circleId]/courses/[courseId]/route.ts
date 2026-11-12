import { NextRequest, NextResponse } from 'next/server';
import {
  createCoursePaywall,
  deleteCourse,
  getCoursePaywalls,
  getCourseWithCurriculum,
  linkCoursePaywall,
  purchaseCoursePaywall,
  unlinkCoursePaywall,
  updateCourse,
} from '@/features/courses/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string; courseId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const mode = req.nextUrl.searchParams.get('mode');

    if (mode === 'paywalls') {
      const paywalls = await getCoursePaywalls(params.circleId, params.courseId);
      return NextResponse.json({ paywalls });
    }

    const course = await getCourseWithCurriculum(
      user?.id ?? null,
      params.circleId,
      params.courseId
    );
    return NextResponse.json({ course });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { circleId: string; courseId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json();
    const course = await updateCourse(
      user.id,
      params.circleId,
      params.courseId,
      body
    );
    return NextResponse.json({ course });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { circleId: string; courseId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === 'create_paywall') {
      const paywall = await createCoursePaywall(
        user.id,
        params.circleId,
        params.courseId,
        body.paywall
      );
      return NextResponse.json({ paywall }, { status: 201 });
    }

    if (action === 'link_paywall') {
      if (!body.planId) throw new ValidationError('planId is required');
      await linkCoursePaywall(user.id, params.circleId, params.courseId, body.planId);
      return NextResponse.json({ success: true });
    }

    if (action === 'unlink_paywall') {
      if (!body.planId) throw new ValidationError('planId is required');
      await unlinkCoursePaywall(user.id, params.circleId, params.courseId, body.planId);
      return NextResponse.json({ success: true });
    }

    if (action === 'purchase_paywall') {
      if (!body.planId) throw new ValidationError('planId is required');
      const originHeader = req.headers.get('origin') || req.headers.get('referer');
      let clientOrigin: string | undefined;
      if (typeof body.origin === 'string' && body.origin.trim().length > 0) {
        clientOrigin = body.origin.trim();
      } else if (originHeader) {
        try {
          clientOrigin = new URL(originHeader).origin;
        } catch {
          // ignore invalid header
        }
      }
      const result = await purchaseCoursePaywall(
        user.id,
        params.circleId,
        params.courseId,
        body.planId,
        body.paymentMethod || 'bachs',
        clientOrigin
      );
      return NextResponse.json(result, { status: 200 });
    }

    throw new ValidationError(`Unknown action: "${action}"`);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { circleId: string; courseId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const result = await deleteCourse(user.id, params.circleId, params.courseId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
