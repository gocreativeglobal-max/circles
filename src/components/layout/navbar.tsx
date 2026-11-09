import React from 'react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { listUserNotifications } from '@/features/notifications/service';
import { canUserAccessModeration } from '@/features/moderation/service';
import { NavbarClient } from './navbar-client';

export async function Navbar() {
  const user = await getAuthenticatedUser();
  let unreadCount = 0;
  let canModerate = false;

  if (user) {
    try {
      const [notifications, modAllowed] = await Promise.all([
        listUserNotifications(user.id).catch(() => []),
        canUserAccessModeration(user.id).catch(() => false),
      ]);
      unreadCount = notifications.filter((n) => !n.is_read).length;
      canModerate = modAllowed;
    } catch {
      unreadCount = 0;
      canModerate = false;
    }
  }

  return (
    <NavbarClient
      user={user}
      unreadCount={unreadCount}
      canModerate={canModerate}
    />
  );
}
