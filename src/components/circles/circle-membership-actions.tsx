'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Circle } from '@/types/domain';

interface CircleMembershipActionsProps {
  circle: Circle;
  isAuthenticated: boolean;
  inviteToken?: string | null;
}

type MembershipAction = 'join' | 'request' | 'accept_invite' | 'leave';

export function CircleMembershipActions({
  circle,
  isAuthenticated,
  inviteToken,
}: CircleMembershipActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);

  const isMember = circle.current_user_membership_status === 'active';
  const isPending = circle.current_user_join_request_status === 'pending';
  const canJoinDirectly = circle.membership_policy === 'open' && circle.visibility === 'public';
  const canRequest = circle.membership_policy === 'approval';

  async function submit(action: MembershipAction, extra: Record<string, unknown> = {}) {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circle.id}/membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }
      setShowRequestForm(false);
      router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }

  function handleLeave() {
    if (!confirm(`Leave ${circle.name}?`)) return;
    void submit('leave');
  }

  const primaryBtn =
    'rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50';
  const quietBtn =
    'rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-2xs hover:bg-stone-50 hover:border-stone-300 disabled:opacity-50';

  return (
    <div className="relative flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {inviteToken && !isMember && (
          <button type="button" onClick={() => submit('accept_invite', { token: inviteToken })} disabled={loading} className={primaryBtn}>
            Accept invite
          </button>
        )}

        {isMember ? (
          circle.current_user_role !== 'owner' && (
            <button type="button" onClick={handleLeave} disabled={loading} className={quietBtn}>
              Leave
            </button>
          )
        ) : isPending ? (
          <span className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-600">Pending</span>
        ) : canJoinDirectly ? (
          <button type="button" onClick={() => submit('join')} disabled={loading} className={primaryBtn}>
            {loading ? 'Joining…' : 'Join'}
          </button>
        ) : canRequest ? (
          <button
            type="button"
            onClick={() => (isAuthenticated ? setShowRequestForm((v) => !v) : router.push('/login'))}
            disabled={loading}
            className={primaryBtn}
          >
            Request to join
          </button>
        ) : null}
      </div>

      {showRequestForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit('request', { message: requestNote });
          }}
          className="absolute right-0 top-full z-30 mt-2 w-72 space-y-2 rounded-xl border border-stone-200 bg-white p-3 shadow-lg"
        >
          <textarea
            aria-label="Note to admins (optional)"
            rows={3}
            value={requestNote}
            onChange={(e) => setRequestNote(e.target.value)}
            placeholder="Add a note (optional)"
            className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50 p-2 text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-black"
          />
          <div className="flex justify-end gap-1">
            <button type="button" onClick={() => setShowRequestForm(false)} className={quietBtn}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className={primaryBtn}>
              {loading ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
