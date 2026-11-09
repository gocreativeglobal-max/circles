import { NextRequest, NextResponse } from 'next/server';
import {
  deleteCircleAsCentralAdmin,
  getCentralAdminDashboardData,
  toggleUserPlatformAdmin,
  updatePlatformFeatureFlags,
} from '@/features/admin/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { ForbiddenError, UnauthorizedError, ValidationError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const data = await getCentralAdminDashboardData(user.id);
    if (!data.isPlatformAdmin) {
      throw new ForbiddenError('Only Circles Central Administrators can access Central Admin.');
    }
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json();

    if (body.action === 'update_feature_flags') {
      const featureFlags = await updatePlatformFeatureFlags(
        user.id,
        body.flags ?? {}
      );
      return NextResponse.json({ featureFlags });
    }

    if (body.action === 'toggle_platform_admin') {
      if (!body.targetUserId) throw new ValidationError('targetUserId is required.');
      await toggleUserPlatformAdmin(
        user.id,
        String(body.targetUserId),
        Boolean(body.isPlatformAdmin)
      );
      return NextResponse.json({ ok: true });
    }

    throw new ValidationError('Unsupported Central Admin action.');
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const { searchParams } = new URL(req.url);
    const circleId = searchParams.get('circleId');
    if (!circleId) throw new ValidationError('circleId is required.');

    await deleteCircleAsCentralAdmin(user.id, circleId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
