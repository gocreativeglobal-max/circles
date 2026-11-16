import React from 'react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getGlobalFeedData } from '@/features/feed/service';
import { listUserNotifications } from '@/features/notifications/service';
import { SocialNewsfeedClient } from '@/components/feed/social-newsfeed-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await getAuthenticatedUser();
  const [feedData, notifs] = await Promise.all([
    getGlobalFeedData(user?.id ?? null, { limit: 45 }),
    user ? listUserNotifications(user.id).catch(() => []) : Promise.resolve([]),
  ]);

  const unreadNotificationsCount = notifs.filter((n) => !n.is_read).length;

  return (
    <SocialNewsfeedClient
      currentUser={user}
      unreadNotificationsCount={unreadNotificationsCount}
      initialItems={feedData.items}
      composerCircles={feedData.composerCircles}
      myCircles={feedData.myCircles}
      trendingCircles={feedData.trendingCircles}
      upcomingEvents={feedData.upcomingEvents}
      stats={feedData.stats}
    />
  );
}
