import React from 'react';
import { redirect } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCentralAdminDashboardData } from '@/features/admin/service';
import { CentralAdminClient } from '@/components/platform/central-admin-client';

export const dynamic = 'force-dynamic';

export default async function CentralAdminPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login');
  }

  const data = await getCentralAdminDashboardData(user.id);

  if (!data.isPlatformAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-3">
        <ShieldAlert className="mx-auto h-8 w-8 text-amber-600" />
        <h1 className="text-lg font-bold text-stone-900">
          Circles Central Admin Access Required
        </h1>
        <p className="text-xs text-stone-500">
          This area is restricted to Circles Platform Administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <CentralAdminClient
        initialStats={data.stats}
        initialFlags={data.featureFlags}
        initialCircles={data.circles}
        initialUsers={data.users}
        currentUserId={user.id}
      />
    </div>
  );
}
