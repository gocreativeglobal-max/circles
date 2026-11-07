'use client';

import React, { useState } from 'react';
import { Heart, Plus } from 'lucide-react';
import { FundraisingCampaignItem } from '@/types/domain';
import { Button } from '@/components/ui/button';

export function CommunityHubBoard({
  circleId,
  initialCampaigns,
  isMember,
  isStaff,
}: {
  circleId: string;
  initialCampaigns: FundraisingCampaignItem[];
  isMember: boolean;
  isStaff: boolean;
}) {
  const [campaigns, setCampaigns] =
    useState<FundraisingCampaignItem[]>(initialCampaigns);
  const [error, setError] = useState<string | null>(null);

  // Campaign form
  const [campTitle, setCampTitle] = useState('');
  const [campDesc, setCampDesc] = useState('');
  const [campGoal, setCampGoal] = useState('1000');

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/governance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_campaign',
          title: campTitle,
          description: campDesc,
          goalAmount: Number(campGoal),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to launch campaign.');
      setCampaigns((prev) => [data.campaign, ...prev]);
      setCampTitle('');
      setCampDesc('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to launch campaign.');
    }
  }

  async function handlePledge(campaignId: string) {
    const amountStr = window.prompt('Enter pledge amount intention (e.g. 50.00):', '25.00');
    if (!amountStr || Number(amountStr) <= 0) return;
    try {
      const res = await fetch(`/api/circles/${circleId}/governance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record_pledge',
          campaignId,
          amount: Number(amountStr),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record pledge.');
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaignId
            ? {
                ...c,
                pledged_total: (c.pledged_total ?? 0) + Number(amountStr),
                pledge_count: (c.pledge_count ?? 0) + 1,
              }
            : c
        )
      );
      alert('Pledge intention recorded. Thank you for supporting the community!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to record pledge.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200/80 bg-white p-6 shadow-xs flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Causes & Fundraising</h2>
          <p className="mt-1 text-xs text-stone-500 font-normal">
            Community drives, non-profit pledges, and impact tracking.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F4F3EE] px-3 py-1 text-xs font-semibold text-[#1B4332]">
          <Heart className="h-3.5 w-3.5" />
          <span>{campaigns.length} active</span>
        </span>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {isStaff && (
          <form
            onSubmit={handleCreateCampaign}
            className="rounded-2xl border border-stone-200/90 bg-white p-5 space-y-3"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Launch Fundraising Campaign
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                required
                value={campTitle}
                onChange={(e) => setCampTitle(e.target.value)}
                placeholder="Campaign Title"
                className="rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-[#1B4332] focus:bg-white focus:outline-none"
              />
              <input
                type="number"
                required
                min={10}
                value={campGoal}
                onChange={(e) => setCampGoal(e.target.value)}
                placeholder="Goal Amount (e.g. 1500)"
                className="rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-[#1B4332] focus:bg-white focus:outline-none"
              />
            </div>
            <textarea
              required
              rows={2}
              value={campDesc}
              onChange={(e) => setCampDesc(e.target.value)}
              placeholder="Describe how community pledges will be allocated..."
              className="w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-[#1B4332] focus:bg-white focus:outline-none"
            />
            <div className="flex justify-end">
              <Button size="xs" type="submit">
                <Plus className="h-3 w-3" />
                <span>Launch Campaign</span>
              </Button>
            </div>
          </form>
        )}

        {campaigns.map((c) => {
          const ratio = Math.min(
            100,
            Math.round(((c.pledged_total ?? 0) / (c.goal_amount || 1)) * 100)
          );
          return (
            <div
              key={c.id}
              className="rounded-2xl border border-stone-200/80 bg-white p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-bold text-stone-900">{c.title}</h4>
                  <p className="mt-1 text-xs sm:text-sm text-stone-600 leading-relaxed font-normal">
                    {c.description}
                  </p>
                </div>
                {isMember && c.status === 'active' && (
                  <Button size="xs" onClick={() => handlePledge(c.id)}>
                    Record Pledge
                  </Button>
                )}
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-xs font-mono text-stone-500">
                  <span>
                    {c.currency} {(c.pledged_total ?? 0).toFixed(2)} pledged ({c.pledge_count ?? 0} backers)
                  </span>
                  <span>
                    {ratio}% of {c.currency} {c.goal_amount.toFixed(2)}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1B4332] rounded-full transition-all"
                    style={{ width: `${ratio}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {campaigns.length === 0 && (
          <div className="rounded-2xl border border-stone-200/80 bg-white p-10 text-center text-xs text-stone-500">
            No active fundraising causes yet.
          </div>
        )}
      </div>
    </div>
  );
}
