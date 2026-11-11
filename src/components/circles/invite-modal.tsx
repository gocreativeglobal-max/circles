'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Link as LinkIcon,
  Copy,
  Check,
  Mail,
  X,
  Trash2,
  Plus,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { Circle, CircleInviteLink, CircleRole } from '@/types/domain';

interface InviteModalProps {
  circle: Circle;
  isOpen: boolean;
  onClose: () => void;
  isStaff?: boolean;
}

export function InviteModal({ circle, isOpen, onClose, isStaff = false }: InviteModalProps) {
  const [activeTab, setActiveTab] = useState<'link' | 'email'>('link');

  // Link state
  const [defaultLink, setDefaultLink] = useState<CircleInviteLink | null>(null);
  const [allLinks, setAllLinks] = useState<CircleInviteLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Link Generator state (for staff)
  const [newLinkRole, setNewLinkRole] = useState<'member' | 'moderator'>('member');
  const [newLinkExpiresDays, setNewLinkExpiresDays] = useState<number | null>(30);
  const [newLinkMaxUses, setNewLinkMaxUses] = useState<number | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Email state
  const [email, setEmail] = useState('');
  const [emailRole, setEmailRole] = useState<Exclude<CircleRole, 'owner'>>('member');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    setLoadingLinks(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circle.id}/invite-links`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load invite link');
      setDefaultLink(data.defaultLink);
      setAllLinks(data.inviteLinks || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading invite link');
    } finally {
      setLoadingLinks(false);
    }
  }, [circle.id]);

  useEffect(() => {
    if (isOpen) {
      void loadLinks();
    }
  }, [isOpen, loadLinks]);

  function getFullInviteUrl(code: string): string {
    if (typeof window === 'undefined') return `/invite/${code}`;
    return `${window.location.origin}/invite/${code}`;
  }

  async function handleCopy(code: string) {
    const url = getFullInviteUrl(code);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 3000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 3000);
    }
  }

  async function handleCreateCustomLink(e: React.FormEvent) {
    e.preventDefault();
    setGeneratingLink(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circle.id}/invite-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: newLinkRole,
          expiresInDays: newLinkExpiresDays,
          maxUses: newLinkMaxUses,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate link');

      setDefaultLink(data.inviteLink);
      setAllLinks((prev) => [data.inviteLink, ...prev]);
      setShowAdvanced(false);
      handleCopy(data.inviteLink.code);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating custom invite link');
    } finally {
      setGeneratingLink(false);
    }
  }

  async function handleRevokeLink(inviteLinkId: string) {
    if (!confirm('Are you sure you want to revoke this invite link? New members will no longer be able to use it.')) {
      return;
    }
    try {
      const res = await fetch(`/api/circles/${circle.id}/invite-links`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteLinkId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to revoke link');
      }
      setAllLinks((prev) =>
        prev.map((l) => (l.id === inviteLinkId ? { ...l, is_revoked: true } : l))
      );
      if (defaultLink?.id === inviteLinkId) {
        setDefaultLink((prev) => (prev ? { ...prev, is_revoked: true } : null));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error revoking invite link');
    }
  }

  async function handleSendEmailInvite(e: React.FormEvent) {
    e.preventDefault();
    setSendingEmail(true);
    setError(null);
    setEmailSuccess(null);
    try {
      const res = await fetch(`/api/circles/${circle.id}/membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invite',
          email,
          role: emailRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invitation');

      setEmailSuccess(`Invitation sent to ${email}`);
      setEmail('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error sending email invitation');
    } finally {
      setSendingEmail(false);
    }
  }

  if (!isOpen) return null;

  const currentActiveLink = defaultLink && !defaultLink.is_revoked ? defaultLink : allLinks.find((l) => !l.is_revoked);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black text-xs font-bold text-white">
              {circle.name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">Invite to {circle.name}</h3>
              <p className="text-[11px] text-stone-500">Share your community link or send email invites</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-stone-100 bg-stone-50/70 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'link'
                ? 'border-black text-black'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <LinkIcon className="h-3.5 w-3.5" />
            Invitation by Link
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('email')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'email'
                ? 'border-black text-black'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            Invite by Email
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'link' ? (
            <div className="space-y-5">
              {/* Primary Copy Link Section */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Shareable Community Invite Link
                </label>
                {loadingLinks ? (
                  <div className="h-11 w-full animate-pulse rounded-xl bg-stone-100" />
                ) : currentActiveLink ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 overflow-hidden rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2.5 text-xs font-mono text-stone-700 truncate select-all">
                      {getFullInviteUrl(currentActiveLink.code)}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentActiveLink.code)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all shadow-xs ${
                        copiedCode === currentActiveLink.code
                          ? 'bg-emerald-600 text-white'
                          : 'bg-black text-white hover:bg-zinc-800'
                      }`}
                    >
                      {copiedCode === currentActiveLink.code ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy Link
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-stone-200 p-4 text-center">
                    <p className="text-xs text-stone-500">No active invite link found.</p>
                  </div>
                )}
                <p className="mt-1.5 text-[11px] text-stone-500">
                  Anyone who has this link can view the community preview and join directly.
                </p>
              </div>

              {/* Staff Custom Link Generator */}
              {isStaff && (
                <div className="rounded-2xl border border-stone-200/80 bg-stone-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      <span>Link Settings & Custom Links</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAdvanced((v) => !v)}
                      className="text-xs font-semibold text-stone-600 hover:text-black underline"
                    >
                      {showAdvanced ? 'Hide Options' : 'Configure Custom Link'}
                    </button>
                  </div>

                  {showAdvanced && (
                    <form onSubmit={handleCreateCustomLink} className="pt-2 border-t border-stone-200/60 space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-stone-700">Role</label>
                          <select
                            value={newLinkRole}
                            onChange={(e) => setNewLinkRole(e.target.value as 'member' | 'moderator')}
                            className="mt-1 w-full rounded-lg border border-stone-200 bg-white p-1.5 text-xs text-stone-800"
                          >
                            <option value="member">Member</option>
                            <option value="moderator">Moderator</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-stone-700">Expires</label>
                          <select
                            value={newLinkExpiresDays === null ? 'never' : String(newLinkExpiresDays)}
                            onChange={(e) =>
                              setNewLinkExpiresDays(e.target.value === 'never' ? null : Number(e.target.value))
                            }
                            className="mt-1 w-full rounded-lg border border-stone-200 bg-white p-1.5 text-xs text-stone-800"
                          >
                            <option value="7">7 days</option>
                            <option value="30">30 days</option>
                            <option value="90">90 days</option>
                            <option value="never">Never</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-stone-700">Max Uses</label>
                          <select
                            value={newLinkMaxUses === null ? 'unlimited' : String(newLinkMaxUses)}
                            onChange={(e) =>
                              setNewLinkMaxUses(e.target.value === 'unlimited' ? null : Number(e.target.value))
                            }
                            className="mt-1 w-full rounded-lg border border-stone-200 bg-white p-1.5 text-xs text-stone-800"
                          >
                            <option value="unlimited">Unlimited</option>
                            <option value="1">1 use</option>
                            <option value="5">5 uses</option>
                            <option value="25">25 uses</option>
                            <option value="100">100 uses</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="submit"
                          disabled={generatingLink}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {generatingLink ? 'Creating...' : 'Create New Link'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Active Links History (for staff) */}
              {isStaff && allLinks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-stone-800">Active Links ({allLinks.length})</h4>
                  <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white overflow-hidden">
                    {allLinks.map((link) => {
                      const isExpired = link.expires_at && new Date(link.expires_at).getTime() < Date.now();
                      const isMaxed = link.max_uses !== null && link.uses_count >= link.max_uses;
                      const isInactive = link.is_revoked || isExpired || isMaxed;

                      return (
                        <div key={link.id} className="flex items-center justify-between p-3 hover:bg-stone-50/50 text-xs">
                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-stone-900">{link.code}</span>
                              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-mono text-stone-600">
                                {link.role}
                              </span>
                              {isInactive && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                  {link.is_revoked ? 'Revoked' : isExpired ? 'Expired' : 'Max uses'}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] text-stone-500">
                              {link.uses_count} {link.uses_count === 1 ? 'use' : 'uses'}
                              {link.max_uses ? ` / ${link.max_uses} max` : ''}
                              {link.expires_at ? ` · expires ${new Date(link.expires_at).toLocaleDateString()}` : ' · never expires'}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {!isInactive && (
                              <button
                                type="button"
                                onClick={() => handleCopy(link.code)}
                                title="Copy link"
                                className="rounded-lg border border-stone-200 bg-white p-1.5 text-stone-700 hover:bg-stone-50"
                              >
                                {copiedCode === link.code ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                            )}
                            {!link.is_revoked && (
                              <button
                                type="button"
                                onClick={() => handleRevokeLink(link.id)}
                                title="Revoke link"
                                className="rounded-lg border border-stone-200 bg-white p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Email Tab */
            <form onSubmit={handleSendEmailInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-800">Invitee Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 p-2.5 text-xs text-stone-900 focus:border-black focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-800">Assigned Community Role</label>
                <select
                  value={emailRole}
                  onChange={(e) => setEmailRole(e.target.value as Exclude<CircleRole, 'owner'>)}
                  className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50/50 p-2.5 text-xs text-stone-900"
                >
                  <option value="member">Member</option>
                  <option value="moderator">Moderator</option>
                  {circle.current_user_role === 'owner' && <option value="admin">Administrator</option>}
                </select>
              </div>

              {emailSuccess && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>{emailSuccess}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={sendingEmail || !email}
                  className="rounded-xl bg-black px-4 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 shadow-sm"
                >
                  {sendingEmail ? 'Sending invite...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/50 px-6 py-3.5">
          <p className="text-[11px] text-stone-400">
            Circles Community Platform
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stone-200 bg-white px-4 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
