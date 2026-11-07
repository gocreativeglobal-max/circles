import { NextRequest, NextResponse } from 'next/server';
import { getGlobalFeedData } from '@/features/feed/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveApiUser(req);
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get('limit') || 40);
    const feed = await getGlobalFeedData(user?.id ?? null, { limit });
    return NextResponse.json(feed);
  } catch (error) {
    return handleApiError(error);
  }
}
