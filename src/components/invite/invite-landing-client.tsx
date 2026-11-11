'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  Shield,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Lock,
  Globe,
  Sparkles,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { Circle, CircleInviteLink } from '@/types/domain';

interface InviteLandingClientProps {
  inviteLink: CircleInviteLink;
  circle: Circle;
  inviterName: string;
  isValid: boolean;
  invalidReason?: string;
  isAlreadyMember: boolean;
  isAuthenticated: boolean;
}

export function InviteLandingClient({
  inviteLink,
  circle,
  inviterName,
  isValid,
  invalidReason,
  isAlreadyMember,
  isAuthenticated,
}: InviteLandingClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  async function handleAccept() {
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(`/invite/${inviteLink.code}`)}`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invite/${inviteLink.code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to accept invitation.');
        return;
      }

      setAccepted(true);
      router.push(`/circles/${data.circleSlug || circle.slug}`);
      router.refresh();
    } catch {
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const roleLabel =
    inviteLink.role === 'admin'
      ? 'Administrator'
      : inviteLink.role === 'moderator'
        ? 'Moderator'
        : 'Member';

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#FAF9F6] p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-xl">
        {/* Header Banner */}
        <div className="border-b border-stone-100 bg-stone-50/70 p-6 sm:p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-black text-2xl font-bold text-white shadow-md">
            {circle.name.slice(0, 1).toUpperCase()}
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-mono font-medium uppercase tracking-wider text-stone-600 border border-stone-200">
              {circle.category.replace('_', ' ')}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-mono text-stone-600 border border-stone-200">
              {circle.visibility === 'public' ? (
                <Globe className="h-3 w-3" />
              ) : (
                <Lock className="h-3 w-3" />
              )}
              {circle.visibility.replace('_', ' ')}
            </span>
          </div>

          <h1 className="mt-3 text-xl font-extrabold text-stone-900 sm:text-2xl">
            {circle.name}
          </h1>

          <p className="mt-1.5 text-xs text-stone-500 font-medium">
            Invited by <span className="font-semibold text-stone-800">{inviterName}</span> to join as a <span className="font-semibold text-black">{roleLabel}</span>
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {circle.description && (
            <p className="text-center text-sm text-stone-600 leading-relaxed font-normal">
              {circle.description}
            </p>
          )}

          <div className="flex items-center justify-center gap-6 rounded-2xl border border-stone-100 bg-[#F9F8F5] py-3.5 px-4 text-xs text-stone-600">
            <div className="flex items-center gap-1.5 font-medium">
              <Users className="h-4 w-4 text-stone-400" />
              <span>{circle.member_count ?? 1} {circle.member_count === 1 ? 'member' : 'members'}</span>
            </div>
            <div className="h-3.5 w-px bg-stone-200" />
            <div className="flex items-center gap-1.5 font-medium">
              <Shield className="h-4 w-4 text-stone-400" />
              <span>Role: <strong className="text-stone-900 font-semibold">{roleLabel}</strong></span>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Area */}
          {!isValid ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-xs text-amber-800">
                <AlertCircle className="mx-auto h-5 w-5 text-amber-600 mb-1" />
                <p className="font-semibold">Invitation Link Unavailable</p>
                <p className="mt-1 text-amber-700">{invalidReason || 'This link has expired or reached maximum capacity.'}</p>
              </div>
              <Link
                href="/explore"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 py-3 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors"
              >
                Explore other communities
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : isAlreadyMember ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 py-3 px-4 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>You are already a member of this community!</span>
              </div>
              <Link
                href={`/circles/${circle.slug}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3 text-xs font-bold text-white hover:bg-zinc-800 transition-colors shadow-sm"
              >
                Go to {circle.name}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : !isAuthenticated ? (
            <div className="space-y-3">
              <Link
                href={`/login?redirect=${encodeURIComponent(`/invite/${inviteLink.code}`)}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3 text-xs font-bold text-white hover:bg-zinc-800 transition-colors shadow-sm"
              >
                <LogIn className="h-4 w-4" />
                Sign in to accept invitation
              </Link>
              <Link
                href={`/register?redirect=${encodeURIComponent(`/invite/${inviteLink.code}`)}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 py-3 text-xs font-semibold text-stone-800 hover:bg-stone-100 transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                Create account & join
              </Link>
            </div>
          ) : (
            <button
              type="button"
              disabled={loading || accepted}
              onClick={handleAccept}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-md"
            >
              {loading ? (
                'Joining community...'
              ) : accepted ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Joined! Redirecting...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  Accept Invite & Join {circle.name}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
