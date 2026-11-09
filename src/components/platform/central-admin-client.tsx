'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Heart,
  Layers,
  MessageSquare,
  Shield,
  ShieldAlert,
  ShoppingBag,
  Sliders,
  Trash2,
  Users,
} from 'lucide-react';
import {
  CentralAdminCircleRow,
  CentralAdminStats,
  CentralAdminUserRow,
  PlatformFeatureFlags,
} from '@/features/admin/service';

const FEATURE_FLAG_DEFINITIONS: Array<{
  key: keyof PlatformFeatureFlags;
  name: string;
  description: string;
  badge?: string;
}> = [
  {
    key: 'custom_features_builder',
    name: 'Custom Features & Mini-Apps Builder',
    description:
      'Allow Circle Admins and members to build, propose, and install custom modules in the Circle sidebar.',
    badge: 'Disabled by default',
  },
  {
    key: 'global_public_feed',
    name: 'Global Public Discovery Feed',
    description:
      'Show the cross-community public social feed on the home page for signed-in and guest visitors.',
  },
  {
    key: 'marketplace_checkout',
    name: 'Marketplace On-Platform Checkout & Wallets',
    description:
      'Allow communities to accept direct Buy Now payments, Pay-to-Post fees, and Member Wallet settlements.',
  },
  {
    key: 'causes_crowdfunding',
    name: 'Causes & Crowdfunding Module',
    description:
      'Enable official community causes (Circle Treasury) and member-submitted causes (Member Wallet).',
  },
  {
    key: 'allow_circle_creation',
    name: 'Allow New Community Creation',
    description:
      'Allow authenticated users to launch new Circles on the platform.',
  },
];

export function CentralAdminClient({
  initialStats,
  initialFlags,
  initialCircles,
  initialUsers,
  currentUserId,
}: {
  initialStats: CentralAdminStats;
  initialFlags: PlatformFeatureFlags;
  initialCircles: CentralAdminCircleRow[];
  initialUsers: CentralAdminUserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'flags' | 'circles' | 'users'>('flags');
  const [flags, setFlags] = useState<PlatformFeatureFlags>(initialFlags);
  const [circles, setCircles] = useState<CentralAdminCircleRow[]>(initialCircles);
  const [users, setUsers] = useState<CentralAdminUserRow[]>(initialUsers);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showSuccess(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleToggleFlag(key: keyof PlatformFeatureFlags) {
    const nextValue = !flags[key];
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_feature_flags',
          flags: { [key]: nextValue },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update feature flag.');
      setFlags(data.featureFlags);
      showSuccess(
        `${key.replace(/_/g, ' ')} is now ${nextValue ? 'ENABLED' : 'DISABLED'} globally.`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update flag.');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleUserAdmin(userId: string, makeAdmin: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_platform_admin',
          targetUserId: userId,
          isPlatformAdmin: makeAdmin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update user role.');
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_platform_admin: makeAdmin } : u))
      );
      showSuccess(makeAdmin ? 'Promoted to Central Admin' : 'Removed Central Admin role');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update user role.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCircle(circleId: string, circleName: string) {
    if (!window.confirm(`Are you sure you want to permanently delete "${circleName}"?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin?circleId=${circleId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete Circle.');
      setCircles((prev) => prev.filter((c) => c.id !== circleId));
      showSuccess(`Deleted "${circleName}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete Circle.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-900">
            <Shield className="h-3.5 w-3.5" />
            <span>Platform Control Center</span>
          </span>
          <h1 className="mt-0.5 text-xl font-bold text-stone-900">
            Circles Central Admin
          </h1>
          <p className="text-xs text-stone-500">
            Manage global feature flags, communities, users, and platform governance.
          </p>
        </div>

        <Link
          href="/moderation"
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
        >
          <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
          <span>Moderation Queue ({initialStats.openReports})</span>
        </Link>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Total Users', value: initialStats.totalUsers, icon: Users },
          { label: 'Communities', value: initialStats.totalCircles, icon: Layers },
          { label: 'Posts & Threads', value: initialStats.totalPosts, icon: MessageSquare },
          { label: 'Listings', value: initialStats.totalListings, icon: ShoppingBag },
          { label: 'Causes', value: initialStats.totalCauses, icon: Heart },
          { label: 'Open Reports', value: initialStats.openReports, icon: ShieldAlert },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-stone-200/80 bg-white p-4 space-y-1"
            >
              <div className="flex items-center justify-between text-stone-400">
                <span className="text-[11px] font-medium text-stone-500">{stat.label}</span>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="text-lg font-bold text-stone-900">
                {stat.value.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Underlined Tabs */}
      <div className="flex items-center gap-1 border-b border-stone-200">
        {[
          { id: 'flags', label: 'Global Feature Flags', icon: Sliders },
          { id: 'circles', label: `Communities (${circles.length})`, icon: Layers },
          { id: 'users', label: `Users & Admins (${users.length})`, icon: Users },
          { id: 'overview', label: 'System Status', icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`relative inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium transition-colors ${
                active ? 'text-stone-900 font-semibold' : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {active && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-black" />
              )}
            </button>
          );
        })}
      </div>

      {toast && (
        <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-[#F4F3EE] px-4 py-2.5 text-xs font-medium text-stone-900">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      {/* TAB 1: GLOBAL FEATURE FLAGS */}
      {activeTab === 'flags' && (
        <div className="rounded-2xl border border-stone-200/80 bg-white divide-y divide-stone-100">
          {FEATURE_FLAG_DEFINITIONS.map((def) => {
            const enabled = Boolean(flags[def.key]);
            return (
              <div
                key={def.key}
                className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-stone-900">{def.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        enabled
                          ? 'bg-[#F4F3EE] text-stone-900'
                          : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    {def.badge && !enabled && (
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200/60">
                        {def.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500">{def.description}</p>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleToggleFlag(def.key)}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors shrink-0 ${
                    enabled
                      ? 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                      : 'bg-black text-white hover:bg-zinc-800'
                  }`}
                >
                  {enabled ? 'Disable Globally' : 'Enable Globally'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: COMMUNITIES (CIRCLES) */}
      {activeTab === 'circles' && (
        <div className="rounded-2xl border border-stone-200/80 bg-white divide-y divide-stone-100">
          {circles.map((c) => (
            <div
              key={c.id}
              className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/circles/${c.slug}`}
                    className="text-sm font-bold text-stone-900 hover:text-black"
                  >
                    {c.name}
                  </Link>
                  <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">
                    /{c.slug}
                  </span>
                  <span className="rounded-full bg-[#F4F3EE] px-2 py-0.5 text-[10px] font-semibold text-stone-900">
                    {c.category}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-stone-500">
                  {c.member_count} members · {c.post_count} posts · Visibility: {c.visibility}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/circles/${c.slug}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                >
                  <span>Visit</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href={`/circles/${c.slug}/studio`}
                  className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                >
                  Studio
                </Link>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDeleteCircle(c.id, c.name)}
                  className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  title="Delete Circle"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          {circles.length === 0 && (
            <div className="p-10 text-center text-xs text-stone-500">
              No communities created yet.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: USERS & CENTRAL ADMINS */}
      {activeTab === 'users' && (
        <div className="rounded-2xl border border-stone-200/80 bg-white divide-y divide-stone-100">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-stone-900">{u.display_name}</span>
                  <span className="text-xs text-stone-400">@{u.username}</span>
                  {u.is_platform_admin && (
                    <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-semibold text-white">
                      Central Admin
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-stone-500">
                  {u.email} · {u.circle_count} Circles joined
                </p>
              </div>

              <div className="flex items-center gap-2">
                {u.id !== currentUserId && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleToggleUserAdmin(u.id, !u.is_platform_admin)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      u.is_platform_admin
                        ? 'border border-stone-200 text-stone-700 hover:bg-stone-50'
                        : 'bg-black text-white hover:bg-zinc-800'
                    }`}
                  >
                    {u.is_platform_admin ? 'Revoke Central Admin' : 'Make Central Admin'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: SYSTEM STATUS */}
      {activeTab === 'overview' && (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-6 space-y-3">
          <h3 className="text-sm font-bold text-stone-900">Platform Architecture & Security</h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            Circles Central Admin governs platform-wide feature rollouts, multi-tenant Row-Level Security (RLS), and cross-community trust & safety. Features disabled in Global Feature Flags (such as the Custom Features & Mini-Apps Builder) remain safely dormant across all Circles until enabled here.
          </p>
        </div>
      )}
    </div>
  );
}
