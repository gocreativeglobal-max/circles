import { NextRequest, NextResponse } from 'next/server';
import {
  getCourseWorkflowSettings,
  updateCourseWorkflowSettings,
  getCourseWorkflowLogs,
  dispatchCourseWorkflowReminders,
  sendTestWorkflowReminder,
} from '@/features/courses/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string; courseId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const [settings, logs] = await Promise.all([
      getCourseWorkflowSettings(user.id, params.circleId, params.courseId),
      getCourseWorkflowLogs(user.id, params.circleId, params.courseId, 40),
    ]);

    return NextResponse.json({ settings, logs });
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
    if (!body || typeof body !== 'object') {
      throw new ValidationError('Workflow settings payload is required.');
    }

    const settings = await updateCourseWorkflowSettings(
      user.id,
      params.circleId,
      params.courseId,
      body.settings || body
    );

    return NextResponse.json({ settings });
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
    const action = body.action || 'dispatch';

    if (action === 'test') {
      const workflowType = body.workflowType || 'live_session_24h';
      const result = await sendTestWorkflowReminder(
        user.id,
        params.circleId,
        params.courseId,
        workflowType
      );
      return NextResponse.json({ test: result });
    }

    // Default: Dispatch upcoming due reminders
    const stats = await dispatchCourseWorkflowReminders(
      params.circleId,
      params.courseId
    );

    return NextResponse.json({ stats });
  } catch (error) {
    return handleApiError(error);
  }
}
