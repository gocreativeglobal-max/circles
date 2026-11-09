import React from 'react';
import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { canUserAccessModeration, listModerationReports } from '@/features/moderation/service';
import { ModerationClient } from '@/components/platform/moderation-client';

export const dynamic = 'force-dynamic';

export default async function ModerationPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login');
  }

  const canModerate = await canUserAccessModeration(user.id);
  if (!canModerate) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-amber-600" />
        <h1 className="text-lg font-bold text-stone-900">
          Moderator Access Required
        </h1>
        <p className="text-xs text-stone-500">
          This area is restricted to Circle Moderators, Administrators, and Platform Staff.
        </p>
      </div>
    );
  }

  const reports = await listModerationReports(user.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <ModerationClient
        initialReports={reports}
        isPlatformAdmin={Boolean(user.is_platform_admin)}
      />
    </div>
  );
}
