import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCircleCapabilities, updateCircleCapability } from '@/features/capabilities/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const capabilities = await getCircleCapabilities(user?.id ?? null, params.circleId);
    return NextResponse.json({ capabilities });
  } catch (error) {
    return handleApiError(error);
  }
}

async function handleCapabilityUpdate(
  req: NextRequest,
  params: { circleId: string }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json().catch(() => ({}));
    const rawKey = body.capabilityKey || body.capability_key;
    if (!rawKey) {
      throw new ValidationError('capabilityKey is required');
    }

    const capabilityKey =
      rawKey === 'finances' || rawKey === 'payments' ? 'payments_finances' : rawKey;
    const isEnabled =
      body.enabled !== undefined ? Boolean(body.enabled) : Boolean(body.isEnabled);

    const capability = await updateCircleCapability(
      user.id,
      params.circleId,
      capabilityKey,
      isEnabled,
      body.settings
    );

    try {
      revalidatePath('/', 'layout');
    } catch {
      // Ignore in non-standard request contexts
    }

    return NextResponse.json({ capability });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  return handleCapabilityUpdate(req, params);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  return handleCapabilityUpdate(req, params);
}
