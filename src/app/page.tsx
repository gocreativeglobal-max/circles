import React from 'react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getGlobalFeedData } from '@/features/feed/service';
import { SocialNewsfeedClient } from '@/components/feed/social-newsfeed-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getAuthenticatedUser();
  const feedData = await getGlobalFeedData(user?.id ?? null, { limit: 45 });

  return (
    <SocialNewsfeedClient
      currentUser={user}
      initialItems={feedData.items}
      composerCircles={feedData.composerCircles}
      myCircles={feedData.myCircles}
      trendingCircles={feedData.trendingCircles}
      upcomingEvents={feedData.upcomingEvents}
      stats={feedData.stats}
    />
  );
}
