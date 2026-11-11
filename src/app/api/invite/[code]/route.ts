import { NextRequest, NextResponse } from 'next/server';
import {
  acceptInviteLink,
  getInviteLinkByCode,
} from '@/features/memberships/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const result = await getInviteLinkByCode(params.code, user?.id ?? null);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) {
      throw new UnauthorizedError('You must sign in or register to accept an invitation.');
    }

    const result = await acceptInviteLink(user.id, params.code);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
