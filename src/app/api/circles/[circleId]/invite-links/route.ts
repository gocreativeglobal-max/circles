import { NextRequest, NextResponse } from 'next/server';
import {
  createInviteLink,
  getOrCreateDefaultInviteLink,
  listCircleInviteLinks,
  revokeInviteLink,
} from '@/features/memberships/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const [defaultRes, inviteLinks] = await Promise.all([
      getOrCreateDefaultInviteLink(user.id, params.circleId),
      listCircleInviteLinks(user.id, params.circleId).catch(() => []),
    ]);

    return NextResponse.json({
      defaultLink: defaultRes.inviteLink,
      defaultUrl: defaultRes.inviteUrl,
      inviteLinks,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json().catch(() => ({}));
    const role = body.role === 'admin' ? 'admin' : body.role === 'moderator' ? 'moderator' : 'member';
    const maxUses = typeof body.maxUses === 'number' && body.maxUses > 0 ? body.maxUses : null;
    const expiresInDays =
      typeof body.expiresInDays === 'number' && body.expiresInDays > 0 ? body.expiresInDays : null;

    const result = await createInviteLink(user.id, params.circleId, {
      role,
      maxUses,
      expiresInDays,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json().catch(() => ({}));
    const inviteLinkId = body.inviteLinkId;
    if (!inviteLinkId) {
      throw new ValidationError('inviteLinkId is required');
    }

    await revokeInviteLink(user.id, params.circleId, inviteLinkId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
