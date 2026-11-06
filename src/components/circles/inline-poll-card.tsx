'use client';

import React, { useState } from 'react';
import { Check, CheckCircle2, Circle, Lock, Vote } from 'lucide-react';
import { CirclePollItem } from '@/types/domain';
import { Button } from '@/components/ui/button';

export interface InlinePollCardProps {
  poll: CirclePollItem;
  circleId: string;
  isMember: boolean;
  onPollUpdated?: (updatedPoll: CirclePollItem) => void;
}

export function InlinePollCard({
  poll: initialPoll,
  circleId,
  isMember,
  onPollUpdated,
}: InlinePollCardProps) {
  const [poll, setPoll] = useState<CirclePollItem>(initialPoll);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(() => {
    return initialPoll.options.filter((o) => o.viewer_voted).map((o) => o.id);
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasVoted = poll.viewer_has_voted ?? poll.options.some((o) => o.viewer_voted);
  const isClosed = poll.status !== 'open';
  const isMulti = poll.allow_multiple;

  async function submitVote(optionIdsToVote: string[]) {
    if (!isMember) {
      setError('You must be an active member to vote in this poll.');
      return;
    }
    if (isClosed) {
      setError('This poll is closed.');
      return;
    }
    if (optionIdsToVote.length === 0) {
      setError('Please select at least one option.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vote',
          pollId: poll.id,
          optionIds: optionIdsToVote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit vote.');
      }
      setPoll(data.poll);
      setSelectedOptionIds(
        data.poll.options.filter((o: { viewer_voted?: boolean; id: string }) => o.viewer_voted).map((o: { id: string }) => o.id)
      );
      if (onPollUpdated) {
        onPollUpdated(data.poll);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record your vote.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleOptionClick(optId: string) {
    if (isClosed || !isMember || hasVoted) return;

    if (!isMulti) {
      // WhatsApp / Telegram instant single-choice vote
      setSelectedOptionIds([optId]);
      submitVote([optId]);
    } else {
      // Toggle selection in multiple-choice
      setSelectedOptionIds((prev) =>
        prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]
      );
    }
  }

  const totalVotes = poll.total_votes ?? poll.options.reduce((acc, o) => acc + (o.vote_count ?? 0), 0);

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-stone-200/90 bg-stone-50/70 p-4 sm:p-5 shadow-xs transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-emerald-800 border border-emerald-200/60">
              <Vote className="h-3 w-3" />
              {isMulti ? 'Multiple Choice' : 'Poll'}
            </span>
            {isClosed && (
              <span className="rounded-full bg-stone-200/70 px-2 py-0.5 text-[10px] font-mono font-semibold text-stone-600">
                Closed
              </span>
            )}
          </div>
          <h4 className="text-sm sm:text-base font-semibold text-stone-900 leading-snug">
            {poll.question}
          </h4>
          {poll.description && (
            <p className="mt-1 text-xs text-stone-600 leading-relaxed font-normal">
              {poll.description}
            </p>
          )}
        </div>
      </div>

      {/* Options List */}
      <div className="mt-3.5 space-y-2">
        {poll.options.map((opt) => {
          const isSelected = selectedOptionIds.includes(opt.id) || opt.viewer_voted;
          const percentage = opt.percentage ?? 0;
          const canInteract = isMember && !isClosed && !hasVoted;

          return (
            <div
              key={opt.id}
              role={canInteract ? 'button' : undefined}
              tabIndex={canInteract ? 0 : undefined}
              onClick={() => canInteract && handleOptionClick(opt.id)}
              onKeyDown={(e) => {
                if (canInteract && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleOptionClick(opt.id);
                }
              }}
              className={`group relative overflow-hidden rounded-xl border p-3 text-left transition-all select-none ${
                canInteract
                  ? 'cursor-pointer hover:border-emerald-500 hover:bg-white active:scale-[0.99]'
                  : 'cursor-default'
              } ${
                isSelected
                  ? 'border-emerald-600/80 bg-white ring-1 ring-emerald-600/30 shadow-xs'
                  : 'border-stone-200 bg-white/80'
              }`}
            >
              {/* WhatsApp / Telegram Progress Bar Fill */}
              {poll.results_visible_to_viewer && (
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-500 ease-out ${
                    isSelected
                      ? 'bg-emerald-500/15'
                      : 'bg-stone-200/50'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              )}

              {/* Content Row */}
              <div className="relative z-10 flex items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Selector Icon */}
                  {isMulti ? (
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-stone-300 bg-white group-hover:border-emerald-500'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                  ) : (
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-stone-300 bg-white group-hover:border-emerald-500'
                      }`}
                    >
                      {isSelected && <Circle className="h-2 w-2 fill-current" />}
                    </div>
                  )}

                  <span
                    className={`font-medium truncate ${
                      isSelected ? 'text-stone-900 font-semibold' : 'text-stone-800'
                    }`}
                  >
                    {opt.label}
                  </span>
                </div>

                {/* Percentage / Vote Count or Hidden indicator */}
                <div className="shrink-0 flex items-center gap-1.5 font-mono text-[11px]">
                  {poll.results_visible_to_viewer ? (
                    <span
                      className={`font-semibold ${
                        isSelected ? 'text-emerald-700' : 'text-stone-600'
                      }`}
                    >
                      {percentage}%
                      {opt.vote_count !== undefined && (
                        <span className="ml-1 font-normal text-stone-400">
                          ({opt.vote_count})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-stone-400 text-[10px]">
                      <Lock className="h-3 w-3" />
                      Vote to view
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Multiple Choice Submit Action */}
      {isMulti && !hasVoted && !isClosed && isMember && (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={submitting || selectedOptionIds.length === 0}
            onClick={() => submitVote(selectedOptionIds)}
            className="h-8 rounded-lg bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Vote'}
          </Button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <p className="mt-2.5 text-xs text-rose-600 font-medium">
          {error}
        </p>
      )}

      {/* Footer Meta */}
      <div className="mt-3 flex items-center justify-between border-t border-stone-200/70 pt-2.5 text-[11px] font-mono text-stone-500">
        <span>
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </span>
        <div className="flex items-center gap-2">
          {hasVoted && (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Voted
            </span>
          )}
          {!isMember && (
            <span className="text-stone-400">Join Circle to vote</span>
          )}
        </div>
      </div>
    </div>
  );
}
