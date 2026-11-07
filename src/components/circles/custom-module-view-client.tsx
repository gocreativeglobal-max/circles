'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Heart,
  Plus,
  Sparkles,
  ThumbsUp,
  Wallet,
  X,
} from 'lucide-react';
import {
  CircleCustomModuleEntryItem,
  CircleCustomModuleItem,
} from '@/types/domain';
import { DynamicIcon } from '@/components/ui/icon-map';

export function CustomModuleViewClient({
  circleId,
  circleSlug,
  initialModule,
  initialEntries,
  currentUserId,
  isMember,
  isStaff,
}: {
  circleId: string;
  circleSlug: string;
  initialModule: CircleCustomModuleItem;
  initialEntries: CircleCustomModuleEntryItem[];
  currentUserId: string | null;
  isMember: boolean;
  isStaff: boolean;
}) {
  const [mod] = useState<CircleCustomModuleItem>(initialModule);
  const [entries, setEntries] = useState<CircleCustomModuleEntryItem[]>(initialEntries);
  const [activeColumn, setActiveColumn] = useState<string>('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [boardStatus, setBoardStatus] = useState(
    mod.board_columns?.[0] || 'Open'
  );
  const [priceAmount, setPriceAmount] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string | number>>({});

  // Payment / Tip Modal
  const [payTarget, setPayTarget] = useState<CircleCustomModuleEntryItem | null>(null);
  const [payAmount, setPayAmount] = useState('15');
  const [payMethod, setPayMethod] = useState<'card' | 'wallet' | 'bank_transfer'>('card');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const canPost =
    isMember && (mod.posting_policy === 'all_members' || isStaff);

  function showSuccess(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleCreateEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/custom-modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_entry',
          moduleId: mod.id,
          title: title.trim(),
          body: body.trim(),
          imageUrl: imageUrl.trim() || null,
          boardStatus,
          fieldValues,
          priceAmount: priceAmount ? Number(priceAmount) : null,
          currency: mod.default_currency || 'USD',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add entry.');
      setEntries((prev) => [data.entry, ...prev]);
      setTitle('');
      setBody('');
      setImageUrl('');
      setPriceAmount('');
      setFieldValues({});
      setShowAddModal(false);
      showSuccess('Added!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add entry.');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleUpvote(entryId: string) {
    if (!currentUserId) {
      setError('Please sign in to react or upvote.');
      return;
    }
    try {
      const res = await fetch(`/api/circles/${circleId}/custom-modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'interact_entry',
          entryId,
          interactionType: 'toggle_upvote',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to react.');
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? {
                ...e,
                upvote_count: data.entry.upvote_count,
                viewer_has_upvoted: data.entry.viewer_has_upvoted,
              }
            : e
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to react.');
    }
  }

  async function handleChangeBoardStatus(entryId: string, nextStatus: string) {
    try {
      const res = await fetch(`/api/circles/${circleId}/custom-modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'interact_entry',
          entryId,
          interactionType: 'update_board_status',
          boardStatus: nextStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update status.');
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, board_status: data.entry.board_status } : e))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update status.');
    }
  }

  async function handlePaySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!payTarget) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/custom-modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'interact_entry',
          entryId: payTarget.id,
          interactionType: 'pay_or_tip',
          amount: amt,
          paymentMethod: payMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed.');
      setEntries((prev) =>
        prev.map((item) =>
          item.id === payTarget.id
            ? { ...item, tips_total: data.entry.tips_total }
            : item
        )
      );
      showSuccess(
        `Sent ${payTarget.currency} ${amt.toLocaleString()} to ${payTarget.author?.display_name || 'Member'}'s Wallet!`
      );
      setPayTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed.');
    } finally {
      setBusy(false);
    }
  }

  const visibleEntries =
    mod.layout_type === 'board' && activeColumn !== 'all'
      ? entries.filter((e) => e.board_status === activeColumn)
      : entries;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F4F3EE] text-[#1B4332]">
            <DynamicIcon name={mod.icon || 'sparkles'} className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-stone-900">{mod.name}</h1>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                Custom Feature
              </span>
            </div>
            {mod.description && (
              <p className="text-xs text-stone-500">{mod.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/circles/${circleSlug}/custom`}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
          >
            All Custom Features
          </Link>

          {mod.layout_type !== 'embed' && canPost && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add to {mod.name}</span>
            </button>
          )}
        </div>
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

      {/* EMBEDDED MINI-APP LAYOUT */}
      {mod.layout_type === 'embed' && mod.embed_url ? (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5 bg-stone-50/60">
            <span className="text-xs font-medium text-stone-600 truncate">
              Embedded Mini-App: {mod.embed_url}
            </span>
            <a
              href={mod.embed_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1B4332] hover:underline shrink-0"
            >
              <span>Open in New Tab</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <iframe
            src={mod.embed_url}
            title={mod.name}
            className="h-[640px] w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      ) : (
        <>
          {/* STATUS BOARD COLUMN PILLS */}
          {mod.layout_type === 'board' && mod.board_columns.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveColumn('all')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activeColumn === 'all'
                    ? 'bg-[#1B4332] text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
                }`}
              >
                All ({entries.length})
              </button>
              {mod.board_columns.map((col) => {
                const count = entries.filter((e) => e.board_status === col).length;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setActiveColumn(col)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      activeColumn === col
                        ? 'bg-[#1B4332] text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
                    }`}
                  >
                    {col} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* ENTRIES LIST / GRID */}
          <div
            className={
              mod.layout_type === 'wall'
                ? 'space-y-3 max-w-2xl'
                : 'grid grid-cols-1 gap-4 md:grid-cols-2'
            }
          >
            {visibleEntries.map((entry) => {
              const canEditStatus =
                isStaff || (currentUserId && entry.author_id === currentUserId);

              return (
                <div
                  key={entry.id}
                  className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-5 space-y-3.5 transition-shadow hover:shadow-xs"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-stone-500">
                        By{' '}
                        <strong className="text-stone-800">
                          {entry.author?.display_name || 'Member'}
                        </strong>{' '}
                        · {new Date(entry.created_at).toLocaleDateString()}
                      </span>

                      {mod.layout_type === 'board' && (
                        <div>
                          {canEditStatus ? (
                            <select
                              value={entry.board_status}
                              onChange={(e) =>
                                handleChangeBoardStatus(entry.id, e.target.value)
                              }
                              className="rounded-full border border-stone-200 bg-[#F4F3EE] px-2.5 py-0.5 text-[11px] font-semibold text-[#1B4332]"
                            >
                              {mod.board_columns.map((col) => (
                                <option key={col} value={col}>
                                  {col}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="rounded-full bg-[#F4F3EE] px-2.5 py-0.5 text-[11px] font-semibold text-[#1B4332]">
                              {entry.board_status}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-stone-900">{entry.title}</h3>
                    {entry.body && (
                      <p className="text-xs sm:text-sm text-stone-600 whitespace-pre-line leading-relaxed">
                        {entry.body}
                      </p>
                    )}

                    {/* Custom Schema Field Values */}
                    {mod.fields_schema.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {mod.fields_schema.map((field) => {
                          const val = entry.field_values?.[field.key];
                          if (val === undefined || val === null || val === '') return null;
                          const strVal = String(val);

                          if (field.type === 'url') {
                            return (
                              <a
                                key={field.key}
                                href={
                                  strVal.startsWith('http') ? strVal : `https://${strVal}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-[#1B4332] hover:bg-stone-100"
                              >
                                <span>{field.label}</span>
                                <ArrowUpRight className="h-3 w-3" />
                              </a>
                            );
                          }

                          return (
                            <div
                              key={field.key}
                              className="rounded-lg bg-stone-100/80 px-2.5 py-1 text-xs text-stone-700"
                            >
                              <span className="text-stone-400">{field.label}: </span>
                              <span className="font-semibold text-stone-800">{strVal}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Reaction Button + Optional Payment/Tip Button */}
                  <div className="flex items-center justify-between border-t border-stone-100 pt-3">
                    <button
                      type="button"
                      onClick={() => handleToggleUpvote(entry.id)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        entry.viewer_has_upvoted
                          ? 'border-[#1B4332] bg-[#F4F3EE] text-[#1B4332]'
                          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      <span>{mod.reaction_label || 'Upvote'}</span>
                      <span className="ml-0.5 rounded-full bg-stone-100 px-1.5 py-0.2 text-[11px] text-stone-800">
                        {entry.upvote_count}
                      </span>
                    </button>

                    {mod.enable_payments && (
                      <div className="flex items-center gap-2">
                        {entry.tips_total > 0 && (
                          <span className="text-[11px] font-medium text-stone-500">
                            {entry.currency} {entry.tips_total.toLocaleString()} received
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setPayTarget(entry);
                            setPayAmount(
                              entry.price_amount && entry.price_amount > 0
                                ? String(entry.price_amount)
                                : '15'
                            );
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B4332] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2D6A4F]"
                        >
                          <Heart className="h-3.5 w-3.5" />
                          <span>
                            {mod.payment_label || 'Support'}
                            {entry.price_amount && entry.price_amount > 0
                              ? ` · ${entry.currency} ${entry.price_amount.toLocaleString()}`
                              : ''}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {visibleEntries.length === 0 && (
            <div className="rounded-2xl border border-stone-200/80 bg-white p-12 text-center space-y-2">
              <Sparkles className="mx-auto h-6 w-6 text-stone-300" />
              <p className="text-sm font-semibold text-stone-800">No entries yet</p>
              <p className="text-xs text-stone-500">
                {canPost
                  ? `Be the first to add an entry to ${mod.name}!`
                  : 'Nothing has been posted here yet.'}
              </p>
            </div>
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: ADD ENTRY (RENDERS CUSTOM SCHEMA FIELDS DYNAMICALLY)         */}
      {/* ===================================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">Add to {mod.name}</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEntry} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-stone-700">Title</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title or headline..."
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900 focus:border-[#1B4332] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700">
                  Details / Description
                </label>
                <textarea
                  rows={3}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Share details..."
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900 focus:border-[#1B4332] focus:bg-white focus:outline-none"
                />
              </div>

              {mod.layout_type === 'board' && mod.board_columns.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-stone-700">Status</label>
                  <select
                    value={boardStatus}
                    onChange={(e) => setBoardStatus(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-900"
                  >
                    {mod.board_columns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dynamic Custom Fields */}
              {mod.fields_schema.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-stone-700">
                    {field.label}
                  </label>
                  {field.type === 'select' && field.options && field.options.length > 0 ? (
                    <select
                      value={String(fieldValues[field.key] ?? '')}
                      onChange={(e) =>
                        setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-900"
                    >
                      <option value="">Select...</option>
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      rows={2}
                      value={String(fieldValues[field.key] ?? '')}
                      onChange={(e) =>
                        setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900"
                    />
                  ) : (
                    <input
                      type={
                        field.type === 'number'
                          ? 'number'
                          : field.type === 'date'
                            ? 'date'
                            : 'text'
                      }
                      value={String(fieldValues[field.key] ?? '')}
                      onChange={(e) =>
                        setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      placeholder={field.type === 'url' ? 'https://...' : ''}
                      className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900"
                    />
                  )}
                </div>
              ))}

              {mod.enable_payments && (
                <div>
                  <label className="block text-xs font-medium text-stone-700">
                    Suggested Price / Amount ({mod.default_currency}) — Optional
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={priceAmount}
                    onChange={(e) => setPriceAmount(e.target.value)}
                    placeholder="Leave blank for open-amount tips"
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-[#1B4332] px-5 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-50"
                >
                  {busy ? 'Posting...' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: PAY / TIP ENTRY AUTHOR (CREDITS MEMBER WALLET)               */}
      {/* ===================================================================== */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1B4332]">
                  {mod.payment_label || 'Support / Pay'}
                </span>
                <h3 className="text-base font-bold text-stone-900">{payTarget.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPayTarget(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handlePaySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700">
                  Amount ({payTarget.currency})
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  step="any"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-sm font-semibold text-stone-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPayMethod('card')}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs font-medium ${
                    payMethod === 'card'
                      ? 'border-[#1B4332] bg-[#F4F3EE] text-[#1B4332] font-semibold'
                      : 'border-stone-200 text-stone-600'
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod('bank_transfer')}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs font-medium ${
                    payMethod === 'bank_transfer'
                      ? 'border-[#1B4332] bg-[#F4F3EE] text-[#1B4332] font-semibold'
                      : 'border-stone-200 text-stone-600'
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  <span>Transfer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod('wallet')}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-xs font-medium ${
                    payMethod === 'wallet'
                      ? 'border-[#1B4332] bg-[#F4F3EE] text-[#1B4332] font-semibold'
                      : 'border-stone-200 text-stone-600'
                  }`}
                >
                  <Wallet className="h-4 w-4" />
                  <span>Wallet</span>
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayTarget(null)}
                  className="rounded-xl px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B4332] px-5 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>
                    {busy
                      ? 'Sending...'
                      : `Pay ${payTarget.currency} ${Number(payAmount || 0).toLocaleString()}`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
