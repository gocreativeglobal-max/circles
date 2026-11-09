'use client';

import React, { useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  CreditCard,
  Heart,
  Landmark,
  Megaphone,
  Plus,
  Share2,
  ShieldCheck,
  Sliders,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  CauseCategory,
  CauseMilestone,
  FundraisingCampaignItem,
} from '@/types/domain';

const CAUSE_CURRENCIES = [
  'USD',
  'NGN',
  'GHS',
  'KES',
  'ZAR',
  'EUR',
  'GBP',
  'CAD',
  'UGX',
  'TZS',
  'RWF',
  'ZMW',
  'USDT',
  'USDC',
];

const CATEGORY_LABELS: Record<CauseCategory, string> = {
  community_project: 'Community Project',
  mutual_aid: 'Emergency & Mutual Aid',
  scholarship: 'Scholarship & Education',
  charity: 'Charity & Impact',
  event_sponsorship: 'Event Sponsorship',
};

function getPresetAmounts(currency: string): number[] {
  const highDenom = ['NGN', 'KES', 'UGX', 'TZS', 'RWF'];
  if (highDenom.includes(currency.toUpperCase())) {
    return [5000, 10000, 25000, 50000];
  }
  return [10, 25, 50, 100];
}

export function CommunityHubBoard({
  circleId,
  circleName,
  initialCampaigns,
  initialSettings,
  currentUserId,
  currentUserName,
  isMember,
  isStaff,
}: {
  circleId: string;
  circleName?: string;
  initialCampaigns: FundraisingCampaignItem[];
  initialSettings?: Record<string, unknown>;
  currentUserId?: string | null;
  currentUserName?: string | null;
  isMember: boolean;
  isStaff: boolean;
}) {
  const [campaigns, setCampaigns] =
    useState<FundraisingCampaignItem[]>(initialCampaigns);
  const [settings, setSettings] = useState<Record<string, unknown>>(
    initialSettings ?? {
      defaultCurrency: 'USD',
      allowMultiCurrency: true,
      creationPolicy: 'members_with_approval',
      memberCauseFeePercentage: 0,
      allowGuestDonations: true,
    }
  );

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'official' | 'member' | 'pending'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | CauseCategory>('all');

  // Feedback banners
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Create Cause Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [campTitle, setCampTitle] = useState('');
  const [campDesc, setCampDesc] = useState('');
  const [campCategory, setCampCategory] = useState<CauseCategory>('community_project');
  const [campCauseType, setCampCauseType] = useState<'official' | 'member'>(
    isStaff ? 'official' : 'member'
  );
  const [campGoal, setCampGoal] = useState('1000');
  const [campCurrency, setCampCurrency] = useState(
    String(settings.defaultCurrency || 'USD')
  );
  const [campDeadline, setCampDeadline] = useState('');
  const [campImageUrl, setCampImageUrl] = useState('');
  const [campMilestones, setCampMilestones] = useState<CauseMilestone[]>([]);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneAmount, setNewMilestoneAmount] = useState('');

  // Donate Modal (Members & Non-Members)
  const [donateTarget, setDonateTarget] = useState<FundraisingCampaignItem | null>(null);
  const [donateAmount, setDonateAmount] = useState('25');
  const [donateMessage, setDonateMessage] = useState('');
  const [donateAnon, setDonateAnon] = useState(false);
  const [donateMethod, setDonateMethod] = useState<'card' | 'wallet' | 'bank_transfer'>('card');
  const [guestName, setGuestName] = useState(currentUserName || '');
  const [guestEmail, setGuestEmail] = useState('');

  // Cause Details / Updates / Supporter Wall Modal
  const [detailTarget, setDetailTarget] = useState<FundraisingCampaignItem | null>(null);
  const [updateText, setUpdateText] = useState('');

  // Admin Settings Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<Record<string, unknown>>(settings);

  const creationPolicy = String(settings.creationPolicy || 'members_with_approval');
  const canCreateCause = isStaff || (isMember && creationPolicy !== 'admins_only');

  const pendingCount = useMemo(
    () => campaigns.filter((c) => c.status === 'pending_approval').length,
    [campaigns]
  );

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (typeFilter === 'pending') {
        return c.status === 'pending_approval';
      }
      if (c.status === 'rejected') return false;
      if (!isStaff && c.creator_id !== currentUserId && c.status === 'pending_approval') {
        return false;
      }
      if (typeFilter === 'official' && (c.cause_type ?? 'official') !== 'official') {
        return false;
      }
      if (typeFilter === 'member' && c.cause_type !== 'member') {
        return false;
      }
      if (categoryFilter !== 'all' && (c.category ?? 'community_project') !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [campaigns, typeFilter, categoryFilter, isStaff, currentUserId]);

  function showSuccess(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function handleAddMilestone() {
    if (!newMilestoneTitle.trim() || !Number(newMilestoneAmount)) return;
    setCampMilestones((prev) => [
      ...prev,
      { title: newMilestoneTitle.trim(), amount: Number(newMilestoneAmount) },
    ]);
    setNewMilestoneTitle('');
    setNewMilestoneAmount('');
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/governance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_campaign',
          title: campTitle,
          description: campDesc,
          category: campCategory,
          causeType: isStaff ? campCauseType : 'member',
          goalAmount: Number(campGoal),
          currency: campCurrency,
          deadline: campDeadline || null,
          imageUrl: campImageUrl.trim() || null,
          milestones: campMilestones,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to launch cause.');
      setCampaigns((prev) => [data.campaign, ...prev]);
      setCampTitle('');
      setCampDesc('');
      setCampImageUrl('');
      setCampMilestones([]);
      setShowCreateModal(false);
      showSuccess(
        data.campaign.status === 'pending_approval'
          ? 'Cause submitted for Admin approval!'
          : 'Cause published!'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to launch cause.');
    } finally {
      setBusy(false);
    }
  }

  function openDonateModal(campaign: FundraisingCampaignItem) {
    const presets = getPresetAmounts(campaign.currency);
    setDonateTarget(campaign);
    setDonateAmount(String(presets[1] ?? 25));
    setDonateMessage('');
    setDonateAnon(false);
    setDonateMethod('card');
    setError(null);
  }

  async function handleDonateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!donateTarget) return;
    const amt = Number(donateAmount);
    if (!amt || amt <= 0) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/governance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'donate',
          campaignId: donateTarget.id,
          pledgeAmount: amt,
          message: donateMessage.trim(),
          donorName: guestName.trim() || undefined,
          donorEmail: guestEmail.trim() || undefined,
          isAnonymous: donateAnon,
          paymentMethod: donateMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Donation failed.');

      const newDonation = {
        ...data.pledge,
        donor_name: donateAnon
          ? 'Anonymous Supporter'
          : guestName.trim() || currentUserName || 'Supporter',
      };

      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === donateTarget.id
            ? {
                ...c,
                pledged_total: (c.pledged_total ?? 0) + amt,
                pledge_count: (c.pledge_count ?? 0) + 1,
                recent_donations: [newDonation, ...(c.recent_donations ?? [])],
              }
            : c
        )
      );

      if (detailTarget?.id === donateTarget.id) {
        setDetailTarget((prev) =>
          prev
            ? {
                ...prev,
                pledged_total: (prev.pledged_total ?? 0) + amt,
                pledge_count: (prev.pledge_count ?? 0) + 1,
                recent_donations: [newDonation, ...(prev.recent_donations ?? [])],
              }
            : null
        );
      }

      const destLabel =
        donateTarget.cause_type === 'member'
          ? `${donateTarget.creator?.display_name || 'Member'}'s Wallet`
          : 'Circle Treasury';
      setDonateTarget(null);
      showSuccess(
        `Thank you! ${donateTarget.currency} ${amt.toLocaleString()} credited to ${destLabel}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete donation.');
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateStatus(
    campaignId: string,
    status: 'active' | 'rejected' | 'completed' | 'closed'
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/governance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_campaign',
          campaignId,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update cause.');
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaignId ? { ...c, status: data.campaign.status } : c))
      );
      showSuccess(status === 'active' ? 'Cause approved & live!' : `Cause marked ${status}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update cause.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePostUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!detailTarget || !updateText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/governance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_campaign',
          campaignId: detailTarget.id,
          updateBody: updateText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post update.');
      const nextUpdates = Array.isArray(data.campaign.updates) ? data.campaign.updates : [];
      setCampaigns((prev) =>
        prev.map((c) => (c.id === detailTarget.id ? { ...c, updates: nextUpdates } : c))
      );
      setDetailTarget((prev) => (prev ? { ...prev, updates: nextUpdates } : null));
      setUpdateText('');
      showSuccess('Organizer update posted!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post update.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/capabilities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capabilityKey: 'fundraising_causes',
          enabled: true,
          settings: settingsDraft,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings.');
      setSettings(settingsDraft);
      setCampCurrency(String(settingsDraft.defaultCurrency || 'USD'));
      setShowSettingsModal(false);
      showSuccess('Causes settings updated!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setBusy(false);
    }
  }

  function handleShareCause(c: FundraisingCampaignItem) {
    const shareUrl = `${window.location.origin}${window.location.pathname}?cause=${c.id}`;
    navigator.clipboard?.writeText(shareUrl);
    showSuccess('Shareable donation link copied! Anyone (even non-members) can donate.');
  }

  return (
    <div className="space-y-5">
      {/* Minimal Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-4">
        <div>
          <h1 className="text-lg font-bold text-stone-900">Causes & Crowdfunding</h1>
          <p className="text-xs text-stone-500">
            Support official {circleName || 'community'} drives and member-submitted causes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isStaff && (
            <button
              type="button"
              onClick={() => {
                setSettingsDraft(settings);
                setShowSettingsModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              <Sliders className="h-3.5 w-3.5 text-stone-500" />
              <span>Settings</span>
            </button>
          )}

          {canCreateCause && (
            <button
              type="button"
              onClick={() => {
                setCampCauseType(isStaff ? 'official' : 'member');
                setCampCurrency(String(settings.defaultCurrency || 'USD'));
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Start a Cause</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'All Causes' },
            { id: 'official', label: 'Official Community' },
            { id: 'member', label: 'Member Causes' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTypeFilter(tab.id as typeof typeFilter)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === tab.id
                  ? 'bg-black text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {isStaff && pendingCount > 0 && (
            <button
              type="button"
              onClick={() => setTypeFilter('pending')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                typeFilter === 'pending'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
              }`}
            >
              <span>Pending Approval ({pendingCount})</span>
            </button>
          )}
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
          className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 focus:border-black focus:outline-none"
        >
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
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

      {/* Causes Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filteredCampaigns.map((c) => {
          const raised = c.pledged_total ?? 0;
          const goal = c.goal_amount || 1;
          const ratio = Math.min(100, Math.round((raised / goal) * 100));
          const isOfficial = (c.cause_type ?? 'official') === 'official';
          const isPending = c.status === 'pending_approval';
          const catLabel = CATEGORY_LABELS[c.category ?? 'community_project'] ?? 'Community Cause';

          return (
            <div
              key={c.id}
              className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white overflow-hidden transition-shadow hover:shadow-sm"
            >
              <div>
                {c.image_url && (
                  <div className="h-40 w-full overflow-hidden bg-stone-100">
                    <img
                      src={c.image_url}
                      alt={c.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                <div className="p-5 space-y-3">
                  {/* Top Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          isOfficial
                            ? 'bg-[#F4F3EE] text-stone-900'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {isOfficial ? (
                          <>
                            <Landmark className="h-3 w-3" />
                            <span>Official · Circle Treasury</span>
                          </>
                        ) : (
                          <>
                            <Wallet className="h-3 w-3" />
                            <span>Member Cause · {c.creator?.display_name || 'Member'}</span>
                          </>
                        )}
                      </span>

                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                        {catLabel}
                      </span>
                    </div>

                    {isPending && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-900">
                        Pending Approval
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setDetailTarget(c)}
                      className="text-left text-base font-bold text-stone-900 hover:text-black transition-colors"
                    >
                      {c.title}
                    </button>
                    <p className="mt-1 text-xs text-stone-600 line-clamp-2 leading-relaxed">
                      {c.description}
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-bold text-stone-900">
                        {c.currency} {raised.toLocaleString()}{' '}
                        <span className="font-normal text-stone-500">
                          raised of {c.currency} {goal.toLocaleString()}
                        </span>
                      </span>
                      <span className="font-semibold text-stone-900">{ratio}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-black transition-all"
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-stone-500">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>{c.pledge_count ?? 0} supporters</span>
                      </span>
                      {c.deadline && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Ends {new Date(c.deadline).toLocaleDateString()}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="border-t border-stone-100 bg-stone-50/50 px-5 py-3 flex items-center justify-between gap-2">
                {isPending && isStaff ? (
                  <div className="flex items-center gap-2 w-full">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleUpdateStatus(c.id, 'active')}
                      className="flex-1 rounded-xl bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
                    >
                      Approve & Publish
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleUpdateStatus(c.id, 'rejected')}
                      className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetailTarget(c)}
                        className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                      >
                        Details & Wall
                      </button>
                      <button
                        type="button"
                        onClick={() => handleShareCause(c)}
                        title="Share link for members & non-members"
                        className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        <span>Share</span>
                      </button>
                    </div>

                    {c.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => openDonateModal(c)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
                      >
                        <Heart className="h-3.5 w-3.5" />
                        <span>Donate</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredCampaigns.length === 0 && (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-12 text-center space-y-2">
          <Heart className="mx-auto h-7 w-7 text-stone-300" />
          <p className="text-sm font-semibold text-stone-800">No causes found</p>
          <p className="text-xs text-stone-500">
            {canCreateCause
              ? 'Launch an official community drive or submit a member cause to start raising funds.'
              : 'No active fundraising causes match this filter yet.'}
          </p>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: START A CAUSE (ADMIN OFFICIAL OR MEMBER CAUSE)               */}
      {/* ===================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-stone-900">Start a Cause</h3>
                <p className="text-xs text-stone-500">
                  Accept donations from both community members and non-members via shareable link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-stone-200 bg-stone-50 p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="space-y-4">
              {isStaff ? (
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1.5">
                    Cause Type & Fund Destination
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCampCauseType('official')}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                        campCauseType === 'official'
                          ? 'border-stone-900 bg-[#F4F3EE]/70'
                          : 'border-stone-200 bg-white hover:bg-stone-50'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-900">
                        <Landmark className="h-3.5 w-3.5 text-stone-900" />
                        <span>Official Community Cause</span>
                      </span>
                      <span className="mt-0.5 text-[11px] text-stone-500">
                        100% of donations go to Circle Treasury
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCampCauseType('member')}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                        campCauseType === 'member'
                          ? 'border-stone-900 bg-[#F4F3EE]/70'
                          : 'border-stone-200 bg-white hover:bg-stone-50'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-900">
                        <Wallet className="h-3.5 w-3.5 text-stone-900" />
                        <span>Member / Personal Cause</span>
                      </span>
                      <span className="mt-0.5 text-[11px] text-stone-500">
                        Donations credit your Member Wallet
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-stone-200 bg-[#F4F3EE]/60 px-3.5 py-2.5 text-xs text-stone-700 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-stone-900 shrink-0" />
                  <span>
                    Donations to your cause are credited directly to your{' '}
                    <strong>Member Wallet</strong>.
                    {creationPolicy === 'members_with_approval' &&
                      ' Causes go live as soon as a Circle Admin approves them.'}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-stone-700">Cause Title</label>
                <input
                  required
                  value={campTitle}
                  onChange={(e) => setCampTitle(e.target.value)}
                  placeholder="e.g., Annual Student Scholarship Fund or Emergency Medical Aid"
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900 focus:border-black focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700">Category</label>
                  <select
                    value={campCategory}
                    onChange={(e) => setCampCategory(e.target.value as CauseCategory)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-900 focus:border-black focus:bg-white focus:outline-none"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700">Currency</label>
                  <select
                    value={campCurrency}
                    onChange={(e) => setCampCurrency(e.target.value)}
                    disabled={settings.allowMultiCurrency === false}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-900 focus:border-black focus:bg-white focus:outline-none"
                  >
                    {CAUSE_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700">Target Goal</label>
                  <input
                    type="number"
                    required
                    min={1}
                    step="any"
                    value={campGoal}
                    onChange={(e) => setCampGoal(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-900 focus:border-black focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700">
                  Story & How Funds Will Be Used
                </label>
                <textarea
                  required
                  rows={3}
                  value={campDesc}
                  onChange={(e) => setCampDesc(e.target.value)}
                  placeholder="Share why this cause matters and how contributions will make an impact..."
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900 focus:border-black focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-stone-700">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={campDeadline}
                    onChange={(e) => setCampDeadline(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-900 focus:border-black focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700">
                    Cover Image URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={campImageUrl}
                    onChange={(e) => setCampImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-900 focus:border-black focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Milestones Builder */}
              <div className="rounded-xl border border-stone-200/80 bg-stone-50/50 p-3 space-y-2">
                <span className="block text-xs font-semibold text-stone-700">
                  Budget Milestones (Optional)
                </span>
                {campMilestones.map((m, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 text-xs border border-stone-200"
                  >
                    <span className="font-medium text-stone-800">{m.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-stone-900">
                        {campCurrency} {m.amount.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCampMilestones((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-stone-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <input
                    value={newMilestoneTitle}
                    onChange={(e) => setNewMilestoneTitle(e.target.value)}
                    placeholder="Milestone item (e.g. Solar Inverter)"
                    className="flex-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="number"
                    min={1}
                    value={newMilestoneAmount}
                    onChange={(e) => setNewMilestoneAmount(e.target.value)}
                    placeholder="Amount"
                    className="w-24 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddMilestone}
                    className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-100 hover:border-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-black px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {busy
                    ? 'Submitting...'
                    : !isStaff && creationPolicy === 'members_with_approval'
                      ? 'Submit for Approval'
                      : 'Launch Cause'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: ON-PLATFORM DONATION (MEMBERS & NON-MEMBERS + ANONYMOUS)     */}
      {/* ===================================================================== */}
      {donateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-900">
                  Donate to Cause
                </span>
                <h3 className="text-base font-bold text-stone-900">{donateTarget.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDonateTarget(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleDonateSubmit} className="space-y-4">
              {/* Preset Tiers */}
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Choose Amount ({donateTarget.currency})
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {getPresetAmounts(donateTarget.currency).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDonateAmount(String(preset))}
                      className={`rounded-xl border py-2 text-xs font-semibold transition-colors ${
                        Number(donateAmount) === preset
                          ? 'border-stone-900 bg-black text-white'
                          : 'border-stone-200 bg-stone-50 text-stone-800 hover:bg-stone-100'
                      }`}
                    >
                      {preset.toLocaleString()}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  required
                  min={1}
                  step="any"
                  value={donateAmount}
                  onChange={(e) => setDonateAmount(e.target.value)}
                  placeholder={`Custom amount (${donateTarget.currency})`}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-sm font-semibold text-stone-900 focus:border-black focus:bg-white focus:outline-none"
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDonateMethod('card')}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs font-medium ${
                      donateMethod === 'card'
                        ? 'border-stone-900 bg-[#F4F3EE] text-stone-900 font-semibold'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>Card</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDonateMethod('bank_transfer')}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs font-medium ${
                      donateMethod === 'bank_transfer'
                        ? 'border-stone-900 bg-[#F4F3EE] text-stone-900 font-semibold'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                    <span>Transfer</span>
                  </button>

                  <button
                    type="button"
                    disabled={!currentUserId}
                    onClick={() => setDonateMethod('wallet')}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs font-medium disabled:opacity-40 ${
                      donateMethod === 'wallet'
                        ? 'border-stone-900 bg-[#F4F3EE] text-stone-900 font-semibold'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <Wallet className="h-4 w-4" />
                    <span>Wallet</span>
                  </button>
                </div>
              </div>

              {/* Guest / Donor Name & Anonymous Toggle */}
              {!donateAnon && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Your Name (optional)"
                    className="rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-900"
                  />
                  {!currentUserId && (
                    <input
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="Email for receipt (optional)"
                      className="rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-900"
                    />
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={donateAnon}
                  onChange={(e) => setDonateAnon(e.target.checked)}
                  className="rounded border-stone-300 text-stone-900"
                />
                <span>Donate anonymously (hide my name on public supporter wall)</span>
              </label>

              <div>
                <input
                  value={donateMessage}
                  onChange={(e) => setDonateMessage(e.target.value)}
                  placeholder="Leave words of encouragement (optional)..."
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900"
                />
              </div>

              {/* Settlement Destination Transparency Box */}
              <div className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[11px] text-stone-600 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-stone-900 shrink-0" />
                <span>
                  {(donateTarget.cause_type ?? 'official') === 'official' ? (
                    <>
                      100% of this contribution is credited directly to the{' '}
                      <strong>Circle Treasury</strong>.
                    </>
                  ) : (
                    <>
                      Credited directly to{' '}
                      <strong>
                        {donateTarget.creator?.display_name || 'the organizer'}&apos;s Member Wallet
                      </strong>
                      {Number(settings.memberCauseFeePercentage ?? 0) > 0
                        ? ` (${Number(settings.memberCauseFeePercentage)}% community fee supports the Circle Treasury).`
                        : '.'}
                    </>
                  )}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDonateTarget(null)}
                  className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-100 hover:border-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-black px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>
                    {busy
                      ? 'Processing...'
                      : `Donate ${donateTarget.currency} ${Number(donateAmount || 0).toLocaleString()}`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: CAUSE DETAILS, MILESTONES, ORGANIZER UPDATES & SUPPORTER WALL*/}
      {/* ===================================================================== */}
      {detailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-start justify-between border-b border-stone-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#F4F3EE] px-2.5 py-0.5 text-[11px] font-semibold text-stone-900">
                    {(detailTarget.cause_type ?? 'official') === 'official'
                      ? 'Official Community Cause'
                      : `Member Cause by ${detailTarget.creator?.display_name || 'Member'}`}
                  </span>
                  <span className="text-xs text-stone-400">
                    {CATEGORY_LABELS[detailTarget.category ?? 'community_project']}
                  </span>
                </div>
                <h3 className="mt-1 text-lg font-bold text-stone-900">{detailTarget.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailTarget(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-stone-700 whitespace-pre-line leading-relaxed">
              {detailTarget.description}
            </p>

            {/* Milestones */}
            {detailTarget.milestones && detailTarget.milestones.length > 0 && (
              <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Budget & Milestones
                </h4>
                <div className="divide-y divide-stone-200/60">
                  {detailTarget.milestones.map((m, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 text-xs">
                      <span className="font-medium text-stone-800">{m.title}</span>
                      <span className="font-semibold text-stone-900">
                        {detailTarget.currency} {Number(m.amount).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Organizer Updates */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <Megaphone className="h-3.5 w-3.5 text-stone-900" />
                <span>Organizer Updates ({detailTarget.updates?.length ?? 0})</span>
              </h4>

              {(isStaff || (currentUserId && detailTarget.creator_id === currentUserId)) && (
                <form onSubmit={handlePostUpdate} className="flex gap-2">
                  <input
                    value={updateText}
                    onChange={(e) => setUpdateText(e.target.value)}
                    placeholder="Share a progress update or impact note with donors..."
                    className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={busy || !updateText.trim()}
                    className="rounded-xl bg-black px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-40"
                  >
                    Post Update
                  </button>
                </form>
              )}

              {detailTarget.updates && detailTarget.updates.length > 0 ? (
                <div className="space-y-2">
                  {detailTarget.updates.map((u) => (
                    <div
                      key={u.id}
                      className="rounded-xl border border-stone-200/80 bg-white p-3 text-xs space-y-1"
                    >
                      <div className="text-[10px] text-stone-400">
                        {new Date(u.created_at).toLocaleString()}
                      </div>
                      <p className="text-stone-800">{u.body}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-400">No organizer updates posted yet.</p>
              )}
            </div>

            {/* Supporter Wall */}
            <div className="space-y-2.5 border-t border-stone-100 pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Supporter Wall ({detailTarget.pledge_count ?? 0})
                </h4>
                {detailTarget.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => openDonateModal(detailTarget)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
                  >
                    <Heart className="h-3.5 w-3.5" />
                    <span>Donate Now</span>
                  </button>
                )}
              </div>

              {detailTarget.recent_donations && detailTarget.recent_donations.length > 0 ? (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {detailTarget.recent_donations.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-start justify-between rounded-xl border border-stone-100 bg-stone-50/70 px-3.5 py-2.5 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-stone-900">
                          {d.is_anonymous ? 'Anonymous Supporter' : d.donor_name || 'Supporter'}
                        </span>
                        {d.message && (
                          <p className="mt-0.5 text-stone-600">&ldquo;{d.message}&rdquo;</p>
                        )}
                      </div>
                      <span className="font-bold text-stone-900 shrink-0">
                        {detailTarget.currency} {Number(d.pledge_amount).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-400">
                  Be the first to support this cause and leave a note of encouragement!
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: ADMIN CAUSES SETTINGS                                        */}
      {/* ===================================================================== */}
      {showSettingsModal && isStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">Causes & Crowdfunding Settings</h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="rounded-lg border border-stone-200 bg-stone-50 p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-stone-700">
                  Default Currency
                </label>
                <select
                  value={String(settingsDraft.defaultCurrency || 'USD')}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({ ...prev, defaultCurrency: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 p-2 text-xs text-stone-900"
                >
                  {CAUSE_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700">
                  Who can create Causes?
                </label>
                <select
                  value={String(settingsDraft.creationPolicy || 'members_with_approval')}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({ ...prev, creationPolicy: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 p-2 text-xs text-stone-900"
                >
                  <option value="members_with_approval">
                    Members (With Admin Approval) + Official Admin Causes
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
                  value={Number(settingsDraft.memberCauseFeePercentage ?? 0)}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({
                      ...prev,
                      memberCauseFeePercentage: Math.min(
                        30,
                        Math.max(0, Number(e.target.value))
                      ),
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 p-2 text-xs text-stone-900"
                />
                <p className="mt-1 text-[11px] text-stone-500">
                  Official community causes always credit 100% to the Circle Treasury. Member causes credit the member&apos;s Wallet minus this fee.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-100 hover:border-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-black px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {busy ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
