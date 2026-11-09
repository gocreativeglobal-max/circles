'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Hash, Home, Menu, PanelLeft, PanelLeftClose, Settings, X } from 'lucide-react';
import { Circle, CircleNavigationItem, CircleSpace } from '@/types/domain';
import { DynamicIcon } from '@/components/ui/icon-map';

export interface CircleCollapsibleLayoutProps {
  circle: Circle;
  navigation: {
    enabledCapabilityKeys: string[];
    visibleSpaces: CircleSpace[];
    navigationItems: CircleNavigationItem[];
  };
  isStaff: boolean;
  children: React.ReactNode;
}

/**
 * Circle.so-style shell: a quiet, flat sidebar (links + spaces) and a calm content column.
 * Mobile uses a bottom dock plus a simple slide-in list.
 */
export function CircleCollapsibleLayout({
  circle,
  navigation,
  isStaff,
  children,
}: CircleCollapsibleLayoutProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('circles_sidebar_collapsed_v1') === 'true') setIsCollapsed(true);
    } catch {
      // Ignore localStorage read errors in private browsing
    }
  }, []);

  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  function toggleCollapse() {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('circles_sidebar_collapsed_v1', String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }

  const homeHref = `/circles/${circle.slug}`;
  const studioHref = `${homeHref}/studio`;
  const isActive = (href: string) => (href === homeHref ? pathname === href : pathname.startsWith(href));
  const showSpaces =
    navigation.enabledCapabilityKeys.includes('spaces') && navigation.visibleSpaces.length > 0;

  const dockItems = navigation.navigationItems
    .filter((item) => item.href !== homeHref)
    .slice(0, 2);

  // Shared link list used by desktop sidebar and mobile drawer
  function renderNav(collapsed: boolean) {
    return (
      <div className="space-y-5">
        <nav className="space-y-0.5">
          {navigation.navigationItems.map((item) => (
            <SidebarLink
              key={item.id}
              href={item.href}
              label={item.label}
              active={isActive(item.href)}
              collapsed={collapsed}
              icon={<DynamicIcon name={item.icon} className="h-4 w-4 shrink-0" />}
            />
          ))}
        </nav>

        {showSpaces && (
          <div className="space-y-0.5">
            {!collapsed && (
              <Link
                href={`${homeHref}/spaces`}
                className="block px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-400 hover:text-stone-600"
              >
                Spaces
              </Link>
            )}
            {navigation.visibleSpaces.map((sp) => (
              <SidebarLink
                key={sp.id}
                href={`${homeHref}/discussions?spaceId=${sp.id}`}
                label={sp.name}
                active={pathname.includes(`spaceId=${sp.id}`)}
                collapsed={collapsed}
                icon={<Hash className="h-4 w-4 shrink-0" />}
              />
            ))}
          </div>
        )}

        {isStaff && (
          <div className="border-t border-stone-100 pt-3">
            <SidebarLink
              href={studioHref}
              label="Settings"
              active={pathname.startsWith(studioHref)}
              collapsed={collapsed}
              icon={<Settings className="h-4 w-4 shrink-0" />}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-stone-950/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <span className="truncate text-sm font-semibold text-stone-900">{circle.name}</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg border border-stone-200 bg-stone-50 p-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {renderNav(false)}
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom dock */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t border-stone-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <DockLink href={homeHref} label="Home" active={pathname === homeHref} icon={<Home className="h-5 w-5" />} />
        {dockItems.map((item) => (
          <DockLink
            key={item.id}
            href={item.href}
            label={item.label}
            active={isActive(item.href)}
            icon={<DynamicIcon name={item.icon} className="h-5 w-5" />}
          />
        ))}
        <DockLink
          href="/notifications"
          label="Alerts"
          active={pathname === '/notifications'}
          icon={<Bell className="h-5 w-5" />}
        />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium text-stone-500"
        >
          <Menu className="h-5 w-5" />
          <span>Menu</span>
        </button>
      </nav>

      <div className="flex items-start gap-8 pb-16 lg:pb-0">
        {/* Desktop sidebar */}
        <aside
          aria-label="Circle navigation"
          className={`hidden shrink-0 transition-[width] duration-200 lg:block ${
            isCollapsed ? 'w-14' : 'w-56'
          }`}
        >
          <div className="sticky top-20">
            <div className={`mb-2 flex ${isCollapsed ? 'justify-center' : 'justify-end'}`}>
              <button
                type="button"
                onClick={toggleCollapse}
                className="rounded-lg border border-stone-200 bg-stone-50/80 p-1.5 text-stone-600 hover:bg-stone-100 hover:border-stone-300 hover:text-stone-900 transition-colors shadow-2xs"
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={isCollapsed ? 'Expand' : 'Collapse'}
              >
                {isCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </div>
            {renderNav(isCollapsed)}
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function SidebarLink({
  href,
  label,
  icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center rounded-lg text-sm transition-colors ${
        collapsed ? 'mx-auto h-9 w-9 justify-center' : 'gap-2.5 px-3 py-1.5'
      } ${
        active
          ? 'bg-stone-200/60 font-medium text-stone-900'
          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
      }`}
    >
      <span className={active ? 'text-stone-900' : 'text-stone-400'}>{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

function DockLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium ${
        active ? 'text-stone-900 font-semibold' : 'text-stone-500'
      }`}
    >
      {icon}
      <span className="max-w-[64px] truncate">{label}</span>
    </Link>
  );
}
