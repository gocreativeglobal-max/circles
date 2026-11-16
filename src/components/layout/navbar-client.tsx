'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Compass,
  Layers,
  LogOut,
  Menu,
  PlusCircle,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Sun,
  Moon,
  X,
} from 'lucide-react';
import { UserProfile } from '@/types/domain';

interface NavbarClientProps {
  user: UserProfile | null;
  unreadCount: number;
  canModerate?: boolean;
}

export function NavbarClient({ user, unreadCount, canModerate = false }: NavbarClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      const dark = document.documentElement.classList.contains('dark') ||
        localStorage.getItem('circles_theme') === 'dark';
      setIsDark(dark);
    } catch {
      // ignore
    }
  }, []);

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('circles_theme', next ? 'dark' : 'light');
        if (next) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch {
        // ignore
      }
      return next;
    });
  }

  // Lock scroll when mobile menu is active
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // The homepage features an integrated app dashboard with its own docked sidebar and search header
  if (pathname === '/') {
    return null;
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  const navLinks = [
    { href: '/explore', label: 'Explore', icon: Compass },
    ...(user
      ? [
          { href: '/circles', label: 'My Circles', icon: Layers },
          { href: '/circles/new', label: 'Create', icon: PlusCircle },
          ...(canModerate
            ? [{ href: '/moderation', label: 'Moderation', icon: ShieldAlert }]
            : []),
          ...(user.is_platform_admin
            ? [{ href: '/admin', label: 'Central Admin', icon: Settings }]
            : []),
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-black/[0.06] dark:border-zinc-800 bg-white/80 dark:bg-[#121316]/90 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-7">
          <Link
            href="/"
            className="group flex items-center gap-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20"
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_4px_rgba(0,0,0,0.2)]">
              <span className="h-3 w-3 rounded-full border-2 border-white/80" />
              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-zinc-950 dark:text-zinc-100 group-hover:text-black dark:group-hover:text-white transition-colors">
                Circles
              </span>
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                PRO
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                (item.href !== '/circles' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    active
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-100 font-semibold shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60 hover:text-zinc-950 dark:hover:text-zinc-100'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? 'text-zinc-950 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Global Quick Search Cue & User Actions */}
        <div className="hidden md:flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
            className="flex items-center gap-2 rounded-lg border border-stone-200/80 dark:border-zinc-800 bg-stone-50/80 dark:bg-zinc-900/80 px-2.5 py-1.5 text-xs text-stone-500 dark:text-zinc-400 hover:border-stone-300 dark:hover:border-zinc-700 hover:bg-stone-100/70 dark:hover:bg-zinc-800/70 transition-all shadow-xs cursor-pointer"
            title="Press Cmd+K or / to open universal search"
          >
            <Search className="h-3.5 w-3.5 text-stone-400 dark:text-zinc-500" />
            <span>Search or jump to...</span>
            <kbd className="inline-flex items-center gap-0.5 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-stone-400 dark:text-zinc-400 shadow-xs">
              ⌘K
            </kbd>
          </button>

          <div className="h-4 w-px bg-stone-200 dark:bg-zinc-800 mx-1" />

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-600 dark:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-700 transition-colors shadow-2xs"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-400 fill-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-stone-700 dark:text-zinc-200" />
            )}
          </button>

          {user ? (
            <>
              <Link
                href="/notifications"
                className="relative inline-flex items-center justify-center rounded-lg p-2 text-stone-600 dark:text-zinc-400 hover:bg-stone-100/80 dark:hover:bg-zinc-800 hover:text-stone-900 dark:hover:text-zinc-100 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-black dark:bg-white text-white dark:text-black px-1 text-[10px] font-bold shadow-xs">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>

              <Link
                href="/settings"
                className="group flex items-center gap-2 rounded-xl border border-stone-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-stone-800 dark:text-zinc-200 shadow-xs hover:border-stone-300 dark:hover:border-zinc-600 hover:bg-stone-50 dark:hover:bg-zinc-700 transition-all"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-bold text-white overflow-hidden">
                  {user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatar_url}
                      alt={user.display_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    user.display_name.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="max-w-[120px] truncate">{user.display_name}</span>
                <Settings className="h-3 w-3 text-stone-400 dark:text-zinc-500 group-hover:text-stone-600 dark:group-hover:text-zinc-300 transition-colors" />
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50/80 dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-stone-700 dark:text-zinc-300 shadow-2xs hover:bg-stone-100 dark:hover:bg-zinc-700 hover:border-stone-300 dark:hover:border-zinc-600 hover:text-stone-900 dark:hover:text-zinc-100 transition-colors disabled:opacity-50"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5 text-stone-600 dark:text-zinc-400" />
                <span>Exit</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-stone-800 dark:text-zinc-200 shadow-2xs hover:bg-stone-50 dark:hover:bg-zinc-700 hover:border-stone-300 transition-all"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-xl bg-black dark:bg-white px-3.5 py-1.5 text-xs font-semibold text-white dark:text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_3px_rgba(0,0,0,0.15)] hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-[0.98]"
              >
                <span>Get Started</span>
                <Sparkles className="h-3 w-3 text-stone-300 dark:text-stone-700" />
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger & Mobile Theme Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-stone-600 dark:text-zinc-200"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-400 fill-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-stone-700 dark:text-zinc-200" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800"
            aria-label="Toggle Mobile Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 top-16 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 top-16 bg-stone-950/40 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="relative z-10 max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-stone-200 dark:border-zinc-800 bg-white/95 dark:bg-[#121316]/95 backdrop-blur-xl px-5 py-5 shadow-2xl animate-in slide-in-from-top-4 duration-200">
            {/* Quick search button */}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                window.dispatchEvent(new CustomEvent('open-command-palette'));
              }}
              className="flex w-full items-center gap-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 px-3.5 py-2.5 text-xs text-stone-600 dark:text-zinc-300 mb-4 shadow-2xs hover:bg-stone-100 dark:hover:bg-zinc-800"
            >
              <Search className="h-4 w-4 text-stone-400 dark:text-zinc-500" />
              <span>Search or jump to...</span>
              <kbd className="ml-auto inline-flex items-center rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-stone-400 dark:text-zinc-400">
                ⌘K
              </kbd>
            </button>

            {/* Navigation links */}
            <div className="flex flex-col space-y-1">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== '/circles' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-stone-900 text-white dark:bg-white dark:text-black font-semibold'
                        : 'text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800 hover:text-stone-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-white dark:text-black' : 'text-stone-500 dark:text-zinc-400'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {user ? (
                <>
                  <div className="my-2 border-t border-stone-100 dark:border-zinc-800 pt-2 space-y-1">
                    <Link
                      href="/notifications"
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                        pathname === '/notifications'
                          ? 'bg-stone-900 text-white dark:bg-white dark:text-black font-semibold'
                          : 'text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Bell className={`h-4 w-4 ${pathname === '/notifications' ? 'text-white dark:text-black' : 'text-stone-500 dark:text-zinc-400'}`} />
                        <span>Notifications</span>
                      </span>
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-black dark:bg-white px-2 py-0.5 text-xs font-bold text-white dark:text-black">
                          {unreadCount}
                        </span>
                      )}
                    </Link>

                    <Link
                      href="/settings"
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                        pathname === '/settings'
                          ? 'bg-stone-900 text-white dark:bg-white dark:text-black font-semibold'
                          : 'text-stone-700 dark:text-zinc-300 hover:bg-stone-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Settings className={`h-4 w-4 ${pathname === '/settings' ? 'text-white dark:text-black' : 'text-stone-500 dark:text-zinc-400'}`} />
                      <span className="truncate">Settings ({user.display_name})</span>
                    </Link>
                  </div>

                  <div className="pt-2 border-t border-stone-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileOpen(false);
                        handleSignOut();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex w-full items-center justify-center rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-stone-800 dark:text-zinc-200 shadow-2xs hover:bg-stone-50 dark:hover:bg-zinc-700"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-black dark:bg-white px-4 py-2.5 text-sm font-semibold text-white dark:text-black shadow-md hover:bg-zinc-800 dark:hover:bg-zinc-200"
                  >
                    <span>Get Started</span>
                    <Sparkles className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
