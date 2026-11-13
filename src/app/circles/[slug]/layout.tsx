import React from 'react';
import { notFound } from 'next/navigation';
import { Globe, Lock, Shield } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { getCircleBySlugOrId } from '@/features/circles/service';
import { getCircleNavigation } from '@/features/capabilities/service';
import { CircleMembershipActions } from '@/components/circles/circle-membership-actions';
import { CircleCollapsibleLayout } from '@/components/circles/circle-collapsible-layout';
import { generateCircleThemeStyles, getPageAmbientBackgroundStyle } from '@/lib/theme/utils';

export const dynamic = 'force-dynamic';

export default async function CircleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const user = await getAuthenticatedUser();
  const circle = await getCircleBySlugOrId(user?.id ?? null, params.slug);

  if (!circle) {
    notFound();
  }

  const navigation = await getCircleNavigation(user?.id ?? null, circle.id, circle.slug);
  const isStaff =
    circle.current_user_role === 'owner' || circle.current_user_role === 'admin';

  const VisibilityIcon =
    circle.visibility === 'private' ? Lock : circle.visibility === 'discoverable_approval' ? Shield : Globe;
  const memberCount = circle.member_count ?? 1;
  const themeStyles = generateCircleThemeStyles(circle.theme_settings);
  const ambientBackgroundStyle = getPageAmbientBackgroundStyle(circle.theme_settings);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-[#FAF9F6] overflow-x-hidden" style={themeStyles}>
      {/* Full-Page Ambient Wallpaper / Pattern Layer */}
      {ambientBackgroundStyle && (
        <div
          className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-700"
          style={ambientBackgroundStyle}
          aria-hidden="true"
        />
      )}

      {/* Slim circle header */}
      <header className="relative z-10 border-b border-stone-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center text-base font-semibold shadow-xs transition-colors"
              style={{
                backgroundColor: 'var(--circle-primary)',
                color: 'var(--circle-primary-fg)',
                borderRadius: 'var(--circle-radius, 0.75rem)',
              }}
            >
              {circle.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-stone-900 sm:text-lg">
                {circle.name}
              </h1>
              <p className="flex items-center gap-1.5 text-xs text-stone-500">
                <VisibilityIcon className="h-3 w-3" />
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </p>
            </div>
          </div>

          <CircleMembershipActions circle={circle} isAuthenticated={Boolean(user)} />
        </div>
      </header>

      <div className="relative z-10">
        <CircleCollapsibleLayout circle={circle} navigation={navigation} isStaff={isStaff}>
          {children}
        </CircleCollapsibleLayout>
      </div>
    </div>
  );
}
