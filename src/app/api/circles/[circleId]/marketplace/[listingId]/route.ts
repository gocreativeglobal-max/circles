import { NextRequest, NextResponse } from 'next/server';
import {
  getMarketplaceListing,
  updateMarketplaceListing,
} from '@/features/marketplace/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { NotFoundError, UnauthorizedError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string; listingId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const listing = await getMarketplaceListing(
      user?.id ?? null,
      params.circleId,
      params.listingId
    );

    if (!listing) {
      throw new NotFoundError('Listing not found');
    }

    return NextResponse.json({ listing });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { circleId: string; listingId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json();
    const listing = await updateMarketplaceListing(
      user.id,
      params.circleId,
      params.listingId,
      body
    );

    return NextResponse.json({ listing });
  } catch (error) {
    return handleApiError(error);
  }
}
