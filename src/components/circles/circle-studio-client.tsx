'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  CreditCard,
  History,
  LayoutGrid,
  Link as LinkIcon,
  Mail,
  Plus,
  Settings,
  Settings2,
  Sliders,
  UserCheck,
  UserPlus,
  Users,
  Palette,
  X,
} from 'lucide-react';
import { StudioFinancesTab } from './studio-finances-tab';
import { InviteModal } from './invite-modal';
import { BACHS_ACCEPTED_CURRENCIES } from '@/lib/payments/currencies';
import { THEME_PRESETS, getContrastColor, getRadiusValue } from '@/lib/theme/utils';
import {
  AuditLogItem,
  Circle,
  CircleCapabilityState,
  CircleCategory,
  CircleInvitation,
  CircleJoinRequest,
  CircleMembership,
  CircleRole,
  CircleSpace,
  CircleThemeSettings,
  CircleVisibility,
  MembershipPolicy,
} from '@/types/domain';

interface CircleStudioClientProps {
  circle: Circle;
  capabilities: CircleCapabilityState[];
  spaces: CircleSpace[];
  members: CircleMembership[];
  joinRequests: CircleJoinRequest[];
  invitations: CircleInvitation[];
  auditLogs: AuditLogItem[];
}

export function CircleStudioClient({
  circle: initialCircle,
  capabilities: initialCapabilities,
  spaces: initialSpaces,
  members: initialMembers,
  joinRequests: initialRequests,
  invitations: initialInvitations,
  auditLogs: initialLogs,
}: CircleStudioClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    'general' | 'branding' | 'capabilities' | 'spaces' | 'members' | 'audit' | 'finances'
  >('general');

  const [themeSettings, setThemeSettings] = useState<CircleThemeSettings>({
    primaryColor: initialCircle.theme_settings?.primaryColor || '#18181b',
    accentColor: initialCircle.theme_settings?.accentColor || '#2563eb',
    brandMode: initialCircle.theme_settings?.brandMode || 'system',
    borderRadius: initialCircle.theme_settings?.borderRadius || 'md',
  });
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeSuccess, setThemeSuccess] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);

  async function handleSaveTheme() {
    setThemeSaving(true);
    setThemeError(null);
    setThemeSuccess(false);
    try {
      const res = await fetch(`/api/circles/${initialCircle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          themeSettings,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update theme settings');
      }
      setThemeSuccess(true);
      setTimeout(() => setThemeSuccess(false), 3500);
      router.refresh();
    } catch (err: unknown) {
      setThemeError(err instanceof Error ? err.message : 'Error updating theme');
    } finally {
      setThemeSaving(false);
    }
  }

  const [name, setName] = useState(initialCircle.name);
  const [description, setDescription] = useState(initialCircle.description);
  const [category, setCategory] = useState<CircleCategory>(initialCircle.category);
  const [location, setLocation] = useState(initialCircle.location || '');
  const [visibility, setVisibility] = useState<CircleVisibility>(initialCircle.visibility);
  const [membershipPolicy, setMembershipPolicy] = useState<MembershipPolicy>(
    initialCircle.membership_policy
  );
  const [savedSnapshot, setSavedSnapshot] = useState({
    name: initialCircle.name,
    description: initialCircle.description,
    category: initialCircle.category,
    location: initialCircle.location || '',
    visibility: initialCircle.visibility,
    membershipPolicy: initialCircle.membership_policy,
  });

  const hasUnsavedChanges =
    name !== savedSnapshot.name ||
    description !== savedSnapshot.description ||
    category !== savedSnapshot.category ||
    location !== savedSnapshot.location ||
    visibility !== savedSnapshot.visibility ||
    membershipPolicy !== savedSnapshot.membershipPolicy;

  const [capabilities, setCapabilities] = useState<CircleCapabilityState[]>(initialCapabilities);
  const [spaces, setSpaces] = useState<CircleSpace[]>(initialSpaces);
  const [members, setMembers] = useState<CircleMembership[]>(initialMembers);
  const [joinRequests, setJoinRequests] = useState<CircleJoinRequest[]>(initialRequests);
  const [invitations, setInvitations] = useState<CircleInvitation[]>(initialInvitations);

  // New Space Form
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceDescription, setNewSpaceDescription] = useState('');
  const [newSpaceCapability, setNewSpaceCapability] = useState('discussions');
  const [newSpacePolicy, setNewSpacePolicy] = useState<'members' | 'moderators' | 'admins'>(
    'members'
  );

  // Invitation Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<CircleRole, 'owner'>>('member');
  const [lastIssuedToken, setLastIssuedToken] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  // Capability Configuration Modal State
  const [configCap, setConfigCap] = useState<CircleCapabilityState | null>(null);
  const [capSettingsDraft, setCapSettingsDraft] = useState<Record<string, unknown>>({});

  function handleOpenCapSettings(cap: CircleCapabilityState) {
    setConfigCap(cap);
    setCapSettingsDraft({ ...(cap.definition?.default_settings ?? {}), ...(cap.settings ?? {}) });
  }

  async function handleSaveCapSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!configCap) return;
    await handleToggleCapability(configCap.capability_key, true, capSettingsDraft);
    setConfigCap(null);
  }

  function showConfirmedSave(msg: string) {
    setError(null);
    setSavedBanner(msg);
    setTimeout(() => setSavedBanner(null), 3500);
  }

  async function handleSaveGeneralSettings(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSavedBanner(null);

    try {
      const res = await fetch(`/api/circles/${initialCircle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          category,
          location: location.trim() || null,
          visibility,
          membershipPolicy,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save settings.');
        return;
      }

      const updated: Circle = data.circle;
      setVisibility(updated.visibility);
      setMembershipPolicy(updated.membership_policy);
      setSavedSnapshot({
        name: updated.name,
        description: updated.description,
        category: updated.category,
        location: updated.location || '',
        visibility: updated.visibility,
        membershipPolicy: updated.membership_policy,
      });
      showConfirmedSave('Saved');
      router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleCapability(
    capabilityKey: string,
    nextEnabled: boolean,
    nextSettings?: Record<string, unknown>
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${initialCircle.id}/capabilities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilityKey, enabled: nextEnabled, settings: nextSettings }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not update feature.');
        return;
      }
      setCapabilities((prev) =>
        prev.map((c) =>
          c.capability_key === capabilityKey
            ? {
                ...c,
                enabled: data.capability.enabled,
                settings: data.capability.settings ?? c.settings,
              }
            : c
        )
      );
      showConfirmedSave('Updated');
      router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReorderSpace(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= spaces.length) return;
    const nextSpaces = [...spaces];
    const [moved] = nextSpaces.splice(index, 1);
    nextSpaces.splice(targetIndex, 0, moved);
    setSpaces(nextSpaces);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${initialCircle.id}/spaces`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          orderedSpaceIds: nextSpaces.map((s) => s.id),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Could not reorder spaces.');
        return;
      }
      showConfirmedSave('Order updated');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleTransferOwnership(newOwnerUserId: string, displayName: string) {
    if (!confirm(`Transfer ownership to ${displayName}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${initialCircle.id}/membership`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'transfer_ownership', newOwnerUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to transfer ownership.');
        return;
      }
      showConfirmedSave(`Ownership transferred to ${displayName}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleMemberSuspension(targetUserId: string, currentStatus: string) {
    const action = currentStatus === 'suspended' ? 'restore_member' : 'suspend_member';
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/moderation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          circleId: initialCircle.id,
          actionType: action,
          targetId: targetUserId,
          reason: action === 'suspend_member' ? 'Suspended' : 'Restored',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not update member.');
        return;
      }
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === targetUserId
            ? { ...m, status: action === 'suspend_member' ? 'suspended' : 'active' }
            : m
        )
      );
      showConfirmedSave(action === 'suspend_member' ? 'Suspended' : 'Restored');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateSpace(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${initialCircle.id}/spaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSpaceName,
          description: newSpaceDescription,
          capabilityKey: newSpaceCapability || null,
          postingPolicy: newSpacePolicy,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create space.');
        return;
      }
      setSpaces((prev) => [...prev, data.space]);
      setNewSpaceName('');
      setNewSpaceDescription('');
      showConfirmedSave(`Created #${data.space.name}`);
      router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveSpace(spaceId: string, archived: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${initialCircle.id}/spaces`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', spaceId, archived }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not update space.');
        return;
      }
      setSpaces((prev) => prev.map((s) => (s.id === spaceId ? data.space : s)));
      showConfirmedSave(archived ? 'Archived' : 'Restored');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleReviewJoinRequest(
    requestId: string,
    decision: 'approve_request' | 'reject_request'
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${initialCircle.id}/membership`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: decision, requestId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not process request.');
        return;
      }
      setJoinRequests((prev) =>
        prev.map((jr) =>
          jr.id === requestId
            ? { ...jr, status: decision === 'approve_request' ? 'approved' : 'rejected' }
            : jr
        )
      );
      showConfirmedSave(decision === 'approve_request' ? 'Approved' : 'Rejected');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateMemberRole(targetUserId: string, role: Exclude<CircleRole, 'owner'>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${initialCircle.id}/membership`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_role', targetUserId, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to change role.');
        return;
      }
      setMembers((prev) => prev.map((m) => (m.user_id === targetUserId ? { ...m, role } : m)));
      showConfirmedSave('Role updated');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLastIssuedToken(null);
    try {
      const res = await fetch(`/api/circles/${initialCircle.id}/membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invite',
          email: inviteEmail,
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not issue invitation.');
        return;
      }
      setInvitations((prev) => [data.invitation, ...prev]);
      setLastIssuedToken(data.rawToken);
      setInviteEmail('');
      showConfirmedSave('Invitation sent');
    } finally {
      setBusy(false);
    }
  }

  const pendingJoinCount = joinRequests.filter((jr) => jr.status === 'pending').length;

  return (
    <div className="space-y-5">
      {/* Minimal Underlined Tabs */}
      <div className="flex items-center justify-between border-b border-stone-200">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'general', label: 'General', icon: Settings },
            { id: 'branding', label: 'Brand & Theme', icon: Palette },
            { id: 'capabilities', label: 'Features', icon: Sliders },
            { id: 'spaces', label: 'Spaces', icon: LayoutGrid },
            {
              id: 'members',
              label: `Members${pendingJoinCount > 0 ? ` (${pendingJoinCount})` : ''}`,
              icon: Users,
            },
            { id: 'finances', label: 'Finances', icon: CreditCard },
            { id: 'audit', label: 'Audit', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`relative inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
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

        {hasUnsavedChanges && (
          <span className="hidden sm:inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-900">
            Unsaved
          </span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {savedBanner && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-stone-200 bg-[#F4F3EE] px-4 py-2.5 text-xs font-medium text-stone-900"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-stone-900" />
          <span>{savedBanner}</span>
        </div>
      )}

      {/* TAB 1: GENERAL SETTINGS */}
      {activeTab === 'general' && (
        <form
          onSubmit={handleSaveGeneralSettings}
          className="rounded-2xl border border-stone-200/80 bg-white p-6 space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="studio-name" className="block text-xs font-medium text-stone-700">
                Name
              </label>
              <input
                id="studio-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="studio-location" className="block text-xs font-medium text-stone-700">
                Location
              </label>
              <input
                id="studio-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, Campus, or Remote"
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="studio-description" className="block text-xs font-medium text-stone-700">
              Description
            </label>
            <textarea
              id="studio-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="studio-category" className="block text-xs font-medium text-stone-700">
                Category
              </label>
              <select
                id="studio-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as CircleCategory)}
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none"
              >
                <option value="university">University</option>
                <option value="neighbourhood">Neighbourhood</option>
                <option value="professional">Professional</option>
                <option value="creator">Creator</option>
                <option value="learning">Learning</option>
                <option value="sports">Sports</option>
                <option value="project">Project</option>
                <option value="local_business">Local Business</option>
                <option value="general">General</option>
              </select>
            </div>

            <div>
              <label htmlFor="studio-visibility" className="block text-xs font-medium text-stone-700">
                Visibility
              </label>
              <select
                id="studio-visibility"
                value={visibility}
                onChange={(e) => {
                  const nextVis = e.target.value as CircleVisibility;
                  setVisibility(nextVis);
                  if (nextVis === 'private') setMembershipPolicy('invite_only');
                  if (nextVis === 'discoverable_approval') setMembershipPolicy('approval');
                  if (nextVis === 'public' && membershipPolicy === 'invite_only') {
                    setMembershipPolicy('open');
                  }
                }}
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-sm text-stone-900 focus:border-black focus:bg-white focus:outline-none"
              >
                <option value="public">Public</option>
                <option value="discoverable_approval">Approval required</option>
                <option value="private">Private</option>
              </select>
            </div>

            <div>
              <label htmlFor="studio-policy" className="block text-xs font-medium text-stone-700">
                Joining
              </label>
              <select
                id="studio-policy"
                value={membershipPolicy}
                onChange={(e) => setMembershipPolicy(e.target.value as MembershipPolicy)}
                disabled={visibility === 'private'}
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-sm text-stone-900 disabled:opacity-60 focus:border-black focus:bg-white focus:outline-none"
              >
                {visibility === 'public' && <option value="open">Open</option>}
                {visibility !== 'private' && <option value="approval">Approval</option>}
                {visibility !== 'public' && <option value="invite_only">Invite only</option>}
              </select>
            </div>
          </div>

          <div className="flex justify-end border-t border-stone-100 pt-4">
            <button
              type="submit"
              disabled={busy || !hasUnsavedChanges}
              className="rounded-xl bg-black px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-40"
            >
              {busy ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {/* TAB: BRANDING & THEME */}
      {activeTab === 'branding' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-stone-900">
                    Community Theme & Brand Colors
                  </h3>
                  <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                    All Communities • 100% Free
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500 leading-relaxed max-w-2xl">
                  Choose a signature brand palette or enter custom hex codes. Theme colors instantly customize your community avatar, navigation indicators, primary buttons, and accents.
                </p>
              </div>
            </div>

            {themeError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{themeError}</span>
              </div>
            )}

            {themeSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Community theme saved and applied successfully!</span>
              </div>
            )}

            {/* Quick Theme Presets */}
            <div className="border-t border-stone-100 pt-5 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                1. Quick Theme Presets
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {THEME_PRESETS.map((preset) => {
                  const isSelected =
                    themeSettings.primaryColor?.toLowerCase() === preset.primaryColor.toLowerCase() &&
                    themeSettings.accentColor?.toLowerCase() === preset.accentColor.toLowerCase();
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setThemeSettings((prev) => ({
                          ...prev,
                          primaryColor: preset.primaryColor,
                          accentColor: preset.accentColor,
                        }));
                      }}
                      className={`flex flex-col rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? 'border-black bg-stone-50 shadow-xs ring-1 ring-black'
                          : 'border-stone-200 bg-stone-50/50 hover:border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-2">
                        <span
                          className="h-4 w-4 rounded-full border border-black/10 shadow-2xs"
                          style={{ backgroundColor: preset.primaryColor }}
                        />
                        <span
                          className="h-4 w-4 rounded-full border border-black/10 shadow-2xs"
                          style={{ backgroundColor: preset.accentColor }}
                        />
                      </div>
                      <span className="text-xs font-bold text-stone-900 truncate">
                        {preset.name}
                      </span>
                      <span className="mt-0.5 text-[10px] text-stone-400 line-clamp-1">
                        {preset.primaryColor}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Hex Pickers */}
            <div className="border-t border-stone-100 pt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Primary Color */}
              <div className="space-y-2 rounded-xl border border-stone-200/80 bg-stone-50/50 p-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-800">
                    Primary Brand Color
                  </label>
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-bold border"
                    style={{
                      backgroundColor: themeSettings.primaryColor || '#18181b',
                      color: getContrastColor(themeSettings.primaryColor || '#18181b'),
                    }}
                  >
                    Contrast Text
                  </span>
                </div>
                <p className="text-[11px] text-stone-500">
                  Used for community avatars, active navigation indicators, and primary call-to-actions.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="color"
                    value={themeSettings.primaryColor || '#18181b'}
                    onChange={(e) =>
                      setThemeSettings((prev) => ({ ...prev, primaryColor: e.target.value }))
                    }
                    className="h-9 w-12 cursor-pointer rounded-lg border border-stone-300 p-0.5 bg-white shadow-2xs"
                  />
                  <input
                    type="text"
                    value={themeSettings.primaryColor || ''}
                    onChange={(e) =>
                      setThemeSettings((prev) => ({ ...prev, primaryColor: e.target.value }))
                    }
                    placeholder="#18181b"
                    className="w-36 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-mono font-bold text-stone-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>

              {/* Accent Color */}
              <div className="space-y-2 rounded-xl border border-stone-200/80 bg-stone-50/50 p-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-800">
                    Accent / Secondary Color
                  </label>
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-bold border"
                    style={{
                      backgroundColor: themeSettings.accentColor || '#2563eb',
                      color: getContrastColor(themeSettings.accentColor || '#2563eb'),
                    }}
                  >
                    Accent Text
                  </span>
                </div>
                <p className="text-[11px] text-stone-500">
                  Used for event tags, badges, secondary highlights, and interactive links.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="color"
                    value={themeSettings.accentColor || '#2563eb'}
                    onChange={(e) =>
                      setThemeSettings((prev) => ({ ...prev, accentColor: e.target.value }))
                    }
                    className="h-9 w-12 cursor-pointer rounded-lg border border-stone-300 p-0.5 bg-white shadow-2xs"
                  />
                  <input
                    type="text"
                    value={themeSettings.accentColor || ''}
                    onChange={(e) =>
                      setThemeSettings((prev) => ({ ...prev, accentColor: e.target.value }))
                    }
                    placeholder="#2563eb"
                    className="w-36 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-mono font-bold text-stone-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>
            </div>

            {/* Corner Radius Selection */}
            <div className="border-t border-stone-100 pt-5 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-800">
                Corner Shape & Radius
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'none', label: 'Sharp (0px)' },
                  { id: 'sm', label: 'Subtle (4px)' },
                  { id: 'md', label: 'Standard (8px)' },
                  { id: 'lg', label: 'Rounded (12px)' },
                  { id: 'full', label: 'Pill / Full' },
                ].map((rad) => {
                  const isSel = (themeSettings.borderRadius || 'md') === rad.id;
                  return (
                    <button
                      key={rad.id}
                      type="button"
                      onClick={() =>
                        setThemeSettings((prev) => ({
                          ...prev,
                          borderRadius: rad.id as CircleThemeSettings['borderRadius'],
                        }))
                      }
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        isSel
                          ? 'bg-black text-white shadow-2xs font-semibold'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {rad.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Interactive Sandbox Preview */}
            <div className="border-t border-stone-100 pt-5 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-800">
                Live Community Component Preview
              </label>
              <div className="rounded-xl border border-stone-200 bg-[#FAF9F6] p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-200/80 bg-white p-3 rounded-xl shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-9 w-9 items-center justify-center text-sm font-bold shadow-2xs"
                      style={{
                        backgroundColor: themeSettings.primaryColor || '#18181b',
                        color: getContrastColor(themeSettings.primaryColor || '#18181b'),
                        borderRadius: getRadiusValue(themeSettings.borderRadius),
                      }}
                    >
                      {initialCircle.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">{initialCircle.name}</h4>
                      <p className="text-[10px] text-stone-500">Live Appearance Preview</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1 text-xs font-semibold shadow-2xs cursor-default"
                    style={{
                      backgroundColor: themeSettings.primaryColor || '#18181b',
                      color: getContrastColor(themeSettings.primaryColor || '#18181b'),
                      borderRadius: getRadiusValue(themeSettings.borderRadius),
                    }}
                  >
                    Join Circle
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className="px-3 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: `${themeSettings.primaryColor}15`,
                      color: themeSettings.primaryColor || '#18181b',
                      borderRadius: getRadiusValue(themeSettings.borderRadius),
                    }}
                  >
                    # general-discussion (Active Space)
                  </div>
                  <div
                    className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${themeSettings.accentColor}18`,
                      color: themeSettings.accentColor || '#2563eb',
                      borderRadius: getRadiusValue(themeSettings.borderRadius),
                    }}
                  >
                    Featured Event
                  </div>
                </div>
              </div>
            </div>

            {/* Save Action Bar */}
            <div className="flex justify-end border-t border-stone-100 pt-4">
              <button
                type="button"
                onClick={handleSaveTheme}
                disabled={themeSaving}
                className="rounded-xl bg-black px-6 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-40 transition-all active:scale-[0.98]"
              >
                {themeSaving ? 'Saving Theme...' : 'Save Theme & Colors'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FEATURES / CAPABILITIES */}
      {activeTab === 'capabilities' && (
        <div className="rounded-2xl border border-stone-200/80 bg-white divide-y divide-stone-100">
          {capabilities
            .filter(
              (cap) =>
                ![
                  'governance_committees',
                  'challenges_rewards',
                  'help_desk',
                  'polls_decisions',
                  'shared_resources',
                  'media_publishing',
                ].includes(cap.capability_key)
            )
            .map((cap) => {
              const def = cap.definition;
              if (!def) return null;
              const isPlanned = def.release_stage === 'planned';

              return (
              <div
                key={cap.capability_key}
                className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-stone-900">{def.name}</span>
                    {isPlanned && (
                      <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-stone-500 line-clamp-1">{def.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {cap.enabled && !isPlanned && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleOpenCapSettings(cap)}
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      <span>Options</span>
                    </button>
                  )}

                  {!isPlanned && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleCapability(cap.capability_key, !cap.enabled)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        cap.enabled
                          ? 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                          : 'bg-black text-white hover:bg-zinc-800'
                      }`}
                    >
                      {cap.enabled ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: SPACES */}
      {activeTab === 'spaces' && (
        <div className="space-y-4">
          <form
            onSubmit={handleCreateSpace}
            className="rounded-2xl border border-stone-200/80 bg-white p-5 space-y-3"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              New Space
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                id="space-name"
                type="text"
                required
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                placeholder="Space name"
                className="rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-900 focus:border-black focus:bg-white focus:outline-none"
              />

              <select
                id="space-capability"
                value={newSpaceCapability}
                onChange={(e) => setNewSpaceCapability(e.target.value)}
                className="rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-900 focus:border-black focus:bg-white focus:outline-none"
              >
                <option value="discussions">Discussions</option>
                <option value="events">Events</option>
                <option value="learning_resources">Courses</option>
                <option value="marketplace">Marketplace</option>
                <option value="projects_collaboration">Projects</option>
              </select>

              <select
                id="space-policy"
                value={newSpacePolicy}
                onChange={(e) => setNewSpacePolicy(e.target.value as typeof newSpacePolicy)}
                className="rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-900 focus:border-black focus:bg-white focus:outline-none"
              >
                <option value="members">All members can post</option>
                <option value="moderators">Moderators & admins only</option>
                <option value="admins">Admins only</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="space-desc"
                type="text"
                value={newSpaceDescription}
                onChange={(e) => setNewSpaceDescription(e.target.value)}
                placeholder="Short description (optional)"
                className="flex-1 rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-900 focus:border-black focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add</span>
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-stone-200/80 bg-white divide-y divide-stone-100">
            {spaces.map((sp, idx) => (
              <div key={sp.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-stone-900">#{sp.name}</span>
                    {sp.is_archived && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                        Archived
                      </span>
                    )}
                  </div>
                  {sp.description && (
                    <p className="mt-0.5 text-xs text-stone-500">{sp.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busy || idx === 0}
                    onClick={() => handleReorderSpace(idx, 'up')}
                    className="rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={busy || idx === spaces.length - 1}
                    onClick={() => handleReorderSpace(idx, 'down')}
                    className="rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-600 hover:bg-stone-50 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchiveSpace(sp.id, !sp.is_archived)}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
                  >
                    <Archive className="h-3 w-3" />
                    <span>{sp.is_archived ? 'Restore' : 'Archive'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: MEMBERS */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {joinRequests.length > 0 && (
            <div className="rounded-2xl border border-stone-200/80 bg-white p-5 space-y-3">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-stone-900" />
                <h3 className="text-sm font-semibold text-stone-900">
                  Requests ({pendingJoinCount})
                </h3>
              </div>

              <div className="divide-y divide-stone-100">
                {joinRequests.map((jr) => (
                  <div
                    key={jr.id}
                    className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
                  >
                    <div>
                      <p className="text-sm font-semibold text-stone-900">
                        {jr.profile?.display_name ?? jr.user_id}{' '}
                        <span className="text-xs font-normal text-stone-500">
                          {jr.profile?.email}
                        </span>
                      </p>
                      {jr.message && (
                        <p className="mt-0.5 text-xs text-stone-600">&ldquo;{jr.message}&rdquo;</p>
                      )}
                    </div>

                    {jr.status === 'pending' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleReviewJoinRequest(jr.id, 'approve_request')}
                          className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewJoinRequest(jr.id, 'reject_request')}
                          className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-red-50 hover:text-red-800"
                        >
                          Decline
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs capitalize text-stone-500">{jr.status}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite by Link Banner & Manager */}
          <div className="rounded-2xl border border-stone-200/80 bg-stone-50/50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-stone-700" />
                <h3 className="text-sm font-semibold text-stone-900">Shareable Invite Link</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors shadow-2xs"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Invite Manager & Link Settings</span>
              </button>
            </div>
            <p className="text-xs text-stone-500 font-normal">
              Generate customizable invitation links that allow new members to join directly with assigned roles and usage limits.
            </p>
          </div>

          {/* Email Invite */}
          <form
            onSubmit={handleInviteMember}
            className="rounded-2xl border border-stone-200/80 bg-white p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-stone-500" />
              <h3 className="text-sm font-semibold text-stone-900">Invite</h3>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email address"
                className="flex-1 rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900 focus:border-black focus:bg-white focus:outline-none"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Exclude<CircleRole, 'owner'>)}
                className="rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-900"
              >
                <option value="member">Member</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                Send invite
              </button>
            </div>

            {lastIssuedToken && (
              <div className="rounded-xl bg-[#F4F3EE] p-3 text-xs text-stone-900">
                <p className="font-mono break-all">
                  /circles/{initialCircle.slug}?inviteToken={lastIssuedToken}
                </p>
              </div>
            )}

            {invitations.length > 0 && (
              <div className="text-[11px] text-stone-400">
                Recent:{' '}
                {invitations
                  .slice(0, 3)
                  .map((inv) => `${inv.invited_email} (${inv.status})`)
                  .join(' · ')}
              </div>
            )}
          </form>

          {/* Members List */}
          <div className="rounded-2xl border border-stone-200/80 bg-white divide-y divide-stone-100">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex flex-col justify-between gap-2 p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    {m.profile?.display_name}{' '}
                    <span className="text-xs font-normal text-stone-400">
                      @{m.profile?.username}
                    </span>
                  </p>
                  {m.status !== 'active' && (
                    <span className="text-[11px] text-amber-700 capitalize">{m.status}</span>
                  )}
                </div>

                {m.role === 'owner' ? (
                  <span className="rounded-full bg-[#F4F3EE] px-2.5 py-0.5 text-xs font-semibold text-stone-900">
                    Owner
                  </span>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={m.role}
                      onChange={(e) =>
                        handleUpdateMemberRole(
                          m.user_id,
                          e.target.value as Exclude<CircleRole, 'owner'>
                        )
                      }
                      className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-800"
                    >
                      <option value="member">Member</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleMemberSuspension(m.user_id, m.status)}
                      className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-50"
                    >
                      {m.status === 'suspended' ? 'Restore' : 'Suspend'}
                    </button>

                    {initialCircle.current_user_role === 'owner' && m.status === 'active' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          handleTransferOwnership(
                            m.user_id,
                            m.profile?.display_name || m.user_id
                          )
                        }
                        className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-50"
                      >
                        Make owner
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: FINANCES */}
      {activeTab === 'finances' && (
        <StudioFinancesTab circle={initialCircle} spaces={spaces} members={members} />
      )}

      {/* TAB 6: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="rounded-2xl border border-stone-200/80 bg-white divide-y divide-stone-100 text-xs">
          {initialLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between p-4">
              <div>
                <span className="font-mono font-semibold text-stone-900">{log.action}</span>
                <p className="mt-0.5 text-stone-500">
                  {log.actor_name || log.actor_id || 'System'} · {log.entity_type}
                </p>
              </div>
              <span className="text-stone-400">
                {new Date(log.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* CAPABILITY SETTINGS MODAL */}
      {configCap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-sm font-semibold text-stone-900">
                {configCap.definition?.name || configCap.capability_key}
              </h3>
              <button
                type="button"
                onClick={() => setConfigCap(null)}
                className="rounded-lg p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCapSettings} className="space-y-3">
              {configCap.capability_key === 'discussions' && (
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2 text-xs text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={capSettingsDraft.allowMemberPosts !== false}
                      onChange={(e) =>
                        setCapSettingsDraft((prev) => ({
                          ...prev,
                          allowMemberPosts: e.target.checked,
                        }))
                      }
                    />
                    <span>Allow members to create posts</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={capSettingsDraft.allowMemberResources !== false}
                      onChange={(e) =>
                        setCapSettingsDraft((prev) => ({
                          ...prev,
                          allowMemberResources: e.target.checked,
                        }))
                      }
                    />
                    <span>Allow members to share resources in chat</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={capSettingsDraft.allowReactions !== false}
                      onChange={(e) =>
                        setCapSettingsDraft((prev) => ({
                          ...prev,
                          allowReactions: e.target.checked,
                        }))
                      }
                    />
                    <span>Allow emoji reactions</span>
                  </label>
                  <div>
                    <label className="block text-xs font-medium text-stone-700">Moderation</label>
                    <select
                      value={String(capSettingsDraft.moderationMode || 'post_publish')}
                      onChange={(e) =>
                        setCapSettingsDraft((prev) => ({
                          ...prev,
                          moderationMode: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 p-2 text-xs text-stone-900"
                    >
                      <option value="post_publish">Instant publish</option>
                      <option value="pre_approval">Require approval</option>
                    </select>
                  </div>
                </div>
              )}

              {configCap.capability_key === 'spaces' && (
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-xs font-medium text-stone-700">Max spaces</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={Number(capSettingsDraft.maxSpaces || 25)}
                      onChange={(e) =>
                        setCapSettingsDraft((prev) => ({
                          ...prev,
                          maxSpaces: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 p-2 text-xs text-stone-900"
                    />
                  </div>
                </div>
              )}

              {configCap.capability_key === 'member_directory' && (
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2 text-xs text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={capSettingsDraft.showRoleBadges !== false}
                      onChange={(e) =>
                        setCapSettingsDraft((prev) => ({
                          ...prev,
                          showRoleBadges: e.target.checked,
                        }))
                      }
                    />
                    <span>Show role badges</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={capSettingsDraft.showBio !== false}
                      onChange={(e) =>
                        setCapSettingsDraft((prev) => ({ ...prev, showBio: e.target.checked }))
                      }
                    />
                    <span>Show member bios</span>
                  </label>
                </div>
              )}

              {configCap.capability_key === 'events' && (
                <label className="flex items-center gap-2 text-xs text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={capSettingsDraft.allowMemberEvents !== false}
                    onChange={(e) =>
                      setCapSettingsDraft((prev) => ({
                        ...prev,
                        allowMemberEvents: e.target.checked,
                      }))
                    }
                  />
                  <span>Allow members to host events</span>
                </label>
              )}

              {configCap.capability_key === 'rsvps' && (
                <label className="flex items-center gap-2 text-xs text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={capSettingsDraft.enableWaitlist !== false}
                    onChange={(e) =>
                      setCapSettingsDraft((prev) => ({
                        ...prev,
                        enableWaitlist: e.target.checked,
                      }))
                    }
                  />
                  <span>Enable waitlist</span>
                </label>
              )}

              {configCap.capability_key === 'polls_decisions' && (
                <label className="flex items-center gap-2 text-xs text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(capSettingsDraft.allowAnonymousVotes)}
                    onChange={(e) =>
                      setCapSettingsDraft((prev) => ({
                        ...prev,
                        allowAnonymousVotes: e.target.checked,
                      }))
                    }
                  />
                  <span>Allow anonymous votes</span>
                </label>
              )}

              {configCap.capability_key === 'marketplace' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700">
                      Default currency
                    </label>
                    <select
                      value={String(capSettingsDraft.defaultCurrency || 'USD')}
                      onChange={(e) =>
                        setCapSettingsDraft((prev) => ({
                          ...prev,
                          defaultCurrency: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 p-2 text-xs text-stone-900 focus:border-stone-400 focus:outline-none"
                    >
                      {BACHS_ACCEPTED_CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} ({c.symbol}) — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={capSettingsDraft.allowMultiCurrency !== false}
                      onChange={(e) =>
                        setCapSettingsDraft((prev) => ({
                          ...prev,
                          allowMultiCurrency: e.target.checked,
                        }))
                      }
                    />
                    <span>Allow sellers to pick other currencies</span>
                  </label>

                  <div>
                    <label className="block text-xs font-medium text-stone-700">
                      Community commission on sales (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      step={0.5}
                      value={Number(capSettingsDraft.commissionPercentage ?? 0)}
                      onChange={(e) =>
                        setCapSettingsDraft((prev) => ({
                          ...prev,
                          commissionPercentage: Math.min(30, Math.max(0, Number(e.target.value))),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 p-2 text-xs text-stone-900"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(capSettingsDraft.payToPostEnabled)}
                      onChange={(e) =>
                        setCapSettingsDraft((prev) => ({
                          ...prev,
                          payToPostEnabled: e.target.checked,
                        }))
                      }
                    />
                    <span>Enable Pay-to-Post listing fee</span>
                  </label>

                  {Boolean(capSettingsDraft.payToPostEnabled) && (
                    <div>
                      <label className="block text-xs font-medium text-stone-700">
                        Posting fee ({String(capSettingsDraft.defaultCurrency || 'USD')})
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={Number(capSettingsDraft.payToPostFeeAmount ?? 0)}
                        onChange={(e) =>
                          setCapSettingsDraft((prev) => ({
                            ...prev,
                            payToPostFeeAmount: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 p-2 text-xs text-stone-900"
                      />
                    </div>
                  )}
                </div>
              )}

              {configCap.capability_key === 'fundraising_causes' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700">
                      Default Cause Currency
                    </label>
                    <select
                      value={String(capSettingsDraft.defaultCurrency || 'USD')}
                      onChange={(e) =>
                        setCapSettingsDraft((prev) => ({
                          ...prev,
                          defaultCurrency: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 p-2 text-xs text-stone-900 focus:border-stone-400 focus:outline-none"
                    >
                      {BACHS_ACCEPTED_CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} ({c.symbol}) — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700">
                      Who can create Causes?
                    </label>
                    <select
                      value={String(capSettingsDraft.creationPolicy || 'members_with_approval')}
                      onChange={(e) =>
                        setCapSettingsDraft((prev) => ({
                          ...prev,
                          creationPolicy: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 p-2 text-xs text-stone-900"
                    >
                      <option value="members_with_approval">
                        Members (Requires Admin Approval) + Official Admin Causes
                      </option>
                      <option value="all_members">
                        All Active Members (Auto-Published) + Official Admin Causes
                      </option>
                      <option value="admins_only">
                        Admins & Moderators Only (Official Causes)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-700">
                      Community fee on member-created causes (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      step={0.5}
                      value={Number(capSettingsDraft.memberCauseFeePercentage ?? 0)}
                      onChange={(e) =>
                        setCapSettingsDraft((prev) => ({
                          ...prev,
                          memberCauseFeePercentage: Math.min(
                            30,
                            Math.max(0, Number(e.target.value))
                          ),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 p-2 text-xs text-stone-900"
                    />
                  </div>
                </div>
              )}

              {configCap.capability_key === 'payments_finances' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700">
                      Currency
                    </label>
                    <select
                      value={String(capSettingsDraft.currency || 'USD')}
                      onChange={(e) =>
                        setCapSettingsDraft((prev) => ({ ...prev, currency: e.target.value }))
                      }
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 p-2 text-xs text-stone-900 focus:border-stone-400 focus:outline-none"
                    >
                      {BACHS_ACCEPTED_CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} ({c.symbol}) — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={capSettingsDraft.public_treasury_ledger !== false}
                      onChange={(e) =>
                        setCapSettingsDraft((prev) => ({
                          ...prev,
                          public_treasury_ledger: e.target.checked,
                        }))
                      }
                    />
                    <span>Public Treasury Ledger (visible to active members)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={capSettingsDraft.allow_offline_payments !== false}
                      onChange={(e) =>
                        setCapSettingsDraft((prev) => ({
                          ...prev,
                          allow_offline_payments: e.target.checked,
                        }))
                      }
                    />
                    <span>Allow manual & offline payment recording</span>
                  </label>

                  <div>
                    <label className="block text-xs font-medium text-stone-700">
                      Payment Grace Period (days)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={Number(capSettingsDraft.grace_period_days ?? 14)}
                      onChange={(e) =>
                        setCapSettingsDraft((prev) => ({
                          ...prev,
                          grace_period_days: Math.max(0, parseInt(e.target.value, 10) || 0),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 p-2 text-xs text-stone-900"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setConfigCap(null)}
                  className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-100 hover:border-stone-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {busy ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <InviteModal
        circle={initialCircle}
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        isStaff={true}
      />
    </div>
  );
}
