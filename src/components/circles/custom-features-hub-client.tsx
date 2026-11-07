'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Archive,
  ArrowRight,
  Check,
  CheckCircle2,
  Plus,
  Share2,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { CircleCustomModuleItem } from '@/types/domain';
import { CustomFeatureTemplatePreset } from '@/features/custom-modules/presets';
import { DynamicIcon } from '@/components/ui/icon-map';
import { CustomFeatureBuilderModal } from './custom-feature-builder-modal';

export function CustomFeaturesHubClient({
  circleId,
  circleSlug,
  circleName,
  initialModules,
  sharedTemplates,
  isMember,
  isStaff,
}: {
  circleId: string;
  circleSlug: string;
  circleName: string;
  initialModules: CircleCustomModuleItem[];
  sharedTemplates: CustomFeatureTemplatePreset[];
  isMember: boolean;
  isStaff: boolean;
}) {
  const router = useRouter();
  const [modules, setModules] = useState<CircleCustomModuleItem[]>(initialModules);
  const [showBuilder, setShowBuilder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showSuccess(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleQuickInstall(tpl: CustomFeatureTemplatePreset) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/custom-modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_module',
          name: tpl.name,
          description: tpl.description,
          icon: tpl.icon,
          layoutType: tpl.layoutType,
          fieldsSchema: tpl.fieldsSchema,
          boardColumns: tpl.boardColumns,
          reactionLabel: tpl.reactionLabel,
          enablePayments: tpl.enablePayments,
          paymentLabel: tpl.paymentLabel,
          defaultCurrency: 'USD',
          postingPolicy: 'all_members',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not install feature.');
      setModules((prev) => [...prev, data.module]);
      showSuccess(
        data.module.status === 'active'
          ? `"${tpl.name}" installed and added to the Circle side menu!`
          : `"${tpl.name}" proposed for Admin approval!`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to install feature.');
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateModuleStatus(
    moduleId: string,
    status: 'active' | 'archived'
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/custom-modules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update feature.');
      setModules((prev) =>
        prev.map((m) => (m.id === moduleId ? { ...m, status: data.module.status } : m))
      );
      showSuccess(
        status === 'active'
          ? 'Feature approved and added to the Circle side menu!'
          : 'Feature archived from side menu.'
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update feature.');
    } finally {
      setBusy(false);
    }
  }

  const activeModules = modules.filter((m) => m.status === 'active');
  const pendingModules = modules.filter((m) => m.status === 'pending_approval');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-4">
        <div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#1B4332]">
            <Sparkles className="h-3 w-3" />
            <span>User-Built Community Features</span>
          </span>
          <h1 className="text-lg font-bold text-stone-900">
            Custom Features & Mini-Apps
          </h1>
          <p className="text-xs text-stone-500">
            Build custom modules for {circleName} or install user-made features in one click.
          </p>
        </div>

        {isMember && (
          <button
            type="button"
            onClick={() => setShowBuilder(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isStaff ? 'Create Custom Feature' : 'Build / Propose Feature'}</span>
          </button>
        )}
      </div>

      {toast && (
        <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-[#F4F3EE] px-4 py-2.5 text-xs font-medium text-[#1B4332]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      {/* Pending Member Feature Proposals */}
      {pendingModules.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-900">
              Member-Proposed Features Awaiting Approval ({pendingModules.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {pendingModules.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-white p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <DynamicIcon name={m.icon || 'sparkles'} className="h-4 w-4 text-[#1B4332]" />
                    <span className="text-sm font-bold text-stone-900">{m.name}</span>
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">
                      {m.layout_type}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-500 line-clamp-1">{m.description}</p>
                  <p className="mt-1 text-[11px] text-stone-400">
                    Proposed by {m.creator?.display_name || 'Member'}
                  </p>
                </div>

                {isStaff ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleUpdateModuleStatus(m.id, 'active')}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#1B4332] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2D6A4F]"
                    >
                      <Check className="h-3 w-3" />
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleUpdateModuleStatus(m.id, 'archived')}
                      className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-900 shrink-0">
                    Pending Admin Review
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Custom Features in this Circle */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Active Custom Features in {circleName} ({activeModules.length})
        </h2>

        {activeModules.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {activeModules.map((m) => (
              <div
                key={m.id}
                className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-5 space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F4F3EE] text-[#1B4332]">
                        <DynamicIcon name={m.icon || 'sparkles'} className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-stone-900">{m.name}</h3>
                        <span className="text-[11px] text-stone-400">
                          {m.entry_count ?? 0} entries · {m.layout_type} layout
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {m.enable_payments && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F4F3EE] px-2 py-0.5 text-[10px] font-semibold text-[#1B4332]">
                          <Wallet className="h-2.5 w-2.5" />
                          <span>Paid / Tips</span>
                        </span>
                      )}
                      {m.is_shared_template && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                          <Share2 className="h-2.5 w-2.5" />
                          <span>Shared</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {m.description && (
                    <p className="text-xs text-stone-600 line-clamp-2">{m.description}</p>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-stone-100 pt-3">
                  {isStaff ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleUpdateModuleStatus(m.id, 'archived')}
                      className="inline-flex items-center gap-1 text-xs font-medium text-stone-400 hover:text-stone-700"
                    >
                      <Archive className="h-3.5 w-3.5" />
                      <span>Remove from Menu</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-stone-400">
                      Built by {m.creator?.display_name || 'Community'}
                    </span>
                  )}

                  <Link
                    href={`/circles/${circleSlug}/custom/${m.slug}`}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#1B4332] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2D6A4F]"
                  >
                    <span>Open {m.name}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-stone-200/80 bg-white p-8 text-center space-y-2">
            <Sparkles className="mx-auto h-6 w-6 text-stone-300" />
            <p className="text-sm font-semibold text-stone-800">
              No custom features added yet
            </p>
            <p className="text-xs text-stone-500">
              Install a ready-made community feature below in 1 click or build your own from scratch!
            </p>
          </div>
        )}
      </div>

      {/* Shared Community Feature Library */}
      <div className="space-y-3 pt-2">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">
            1-Click Community Feature Library
          </h2>
          <p className="text-xs text-stone-500">
            Ready-to-use features created by the Circles community. Click to add to {circleName}.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {sharedTemplates.map((tpl) => {
            const alreadyActive = activeModules.some(
              (m) => m.name.toLowerCase() === tpl.name.toLowerCase()
            );
            return (
              <div
                key={tpl.key}
                className="flex flex-col justify-between rounded-2xl border border-stone-200/80 bg-white p-4 space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F4F3EE] text-[#1B4332]">
                        <DynamicIcon name={tpl.icon || 'sparkles'} className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-bold text-stone-900">{tpl.name}</span>
                    </div>
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
                      {tpl.layoutType}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 line-clamp-2">{tpl.description}</p>
                </div>

                <div className="flex items-center justify-between border-t border-stone-100 pt-2.5">
                  <span className="text-[10px] text-stone-400">
                    {tpl.fieldsSchema.length} custom fields
                    {tpl.enablePayments ? ' · Wallet payments' : ''}
                  </span>

                  {isMember && (
                    <button
                      type="button"
                      disabled={busy || alreadyActive}
                      onClick={() => handleQuickInstall(tpl)}
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-[#1B4332] hover:bg-[#F4F3EE] disabled:opacity-40"
                    >
                      {alreadyActive ? (
                        <span>Installed</span>
                      ) : (
                        <>
                          <Plus className="h-3 w-3" />
                          <span>{isStaff ? 'Add to Menu' : 'Propose'}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showBuilder && (
        <CustomFeatureBuilderModal
          circleId={circleId}
          isStaff={isStaff}
          sharedTemplates={sharedTemplates}
          onClose={() => setShowBuilder(false)}
          onCreated={(newMod) => {
            setModules((prev) => [...prev, newMod]);
            setShowBuilder(false);
            showSuccess(
              newMod.status === 'active'
                ? `"${newMod.name}" created and added to the Circle side menu!`
                : `"${newMod.name}" submitted for Circle Admin approval!`
            );
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
