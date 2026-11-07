'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bookmark,
  BookOpen,
  ExternalLink,
  Flag,
  Hash,
  Heart,
  MessageSquare,
  Pin,
  Send,
  Sliders,
  Trash2,
  X,
  BarChart2,
  Plus,
  Check,
} from 'lucide-react';
import {
  Circle,
  CirclePollItem,
  CircleSpace,
  CommentItem,
  PollOptionItem,
  PostItem,
} from '@/types/domain';

interface DiscussionsClientProps {
  circle: Circle;
  spaces: CircleSpace[];
  initialPosts: PostItem[];
  selectedSpaceId: string | null;
  currentUserId: string | null;
  initialAllowMemberResources?: boolean;
  initialResourcesOnly?: boolean;
}

interface AttachedResourceMeta {
  title: string;
  category: string;
  url?: string | null;
}

const RESOURCE_CATEGORIES = ['Guide', 'Link', 'Document', 'Template', 'Video'];

function formatShortTime(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function parsePostContent(body: string): {
  resource: AttachedResourceMeta | null;
  cleanBody: string;
} {
  if (body.startsWith('__RESOURCE__:')) {
    const newlineIdx = body.indexOf('\n');
    const jsonPart = newlineIdx === -1 ? body.slice(13) : body.slice(13, newlineIdx);
    const restBody = newlineIdx === -1 ? '' : body.slice(newlineIdx + 1);
    try {
      const parsed = JSON.parse(jsonPart) as AttachedResourceMeta;
      if (parsed && typeof parsed.title === 'string') {
        return { resource: parsed, cleanBody: restBody };
      }
    } catch {
      // Fallback to normal body
    }
  }
  return { resource: null, cleanBody: body };
}

export function DiscussionsClient({
  circle,
  spaces,
  initialPosts,
  selectedSpaceId: initialSpaceId,
  currentUserId,
  initialAllowMemberResources = true,
  initialResourcesOnly = false,
}: DiscussionsClientProps) {
  const router = useRouter();
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(initialSpaceId);
  const [posts, setPosts] = useState<PostItem[]>(initialPosts);
  const [savedOnly, setSavedOnly] = useState(false);
  const [resourcesOnly, setResourcesOnly] = useState(initialResourcesOnly);
  const [allowMemberResources, setAllowMemberResources] = useState(initialAllowMemberResources);
  const [adminPopoverOpen, setAdminPopoverOpen] = useState(false);

  // Composer state
  const [chatMessage, setChatMessage] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Poll state
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null);

  // Resource composer state
  const [showResourceCreator, setShowResourceCreator] = useState(false);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceCategory, setResourceCategory] = useState('Guide');
  const [resourceUrl, setResourceUrl] = useState('');

  // Thread drawer state
  const [activeThreadPostId, setActiveThreadPostId] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommentItem[]>>({});
  const [commentDraft, setCommentDraft] = useState('');
  const [loadingThread, setLoadingThread] = useState(false);

  // Reporting state
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<
    'spam' | 'harassment' | 'rule_violation' | 'misinformation' | 'other'
  >('rule_violation');
  const [reportDetails, setReportDetails] = useState('');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const feedEndRef = useRef<HTMLDivElement>(null);

  const activeSpace = spaces.find((s) => s.id === selectedSpaceId) || null;
  const activeThreadPost = posts.find((p) => p.id === activeThreadPostId) || null;

  const canModerate =
    circle.current_user_role === 'owner' ||
    circle.current_user_role === 'admin' ||
    circle.current_user_role === 'moderator';
  const isAdmin =
    circle.current_user_role === 'owner' || circle.current_user_role === 'admin';

  const isActiveMember =
    circle.current_user_membership_status === 'active' || Boolean(circle.current_user_role);

  const canPostInActiveSpace = (() => {
    if (!currentUserId || !isActiveMember) return false;
    const targetSpace = activeSpace || spaces[0];
    if (!targetSpace) return true;
    if (targetSpace.posting_policy === 'members') return true;
    if (targetSpace.posting_policy === 'moderators') return canModerate;
    if (targetSpace.posting_policy === 'admins') {
      return isAdmin;
    }
    return false;
  })();

  const canShareResource = canPostInActiveSpace && (allowMemberResources || canModerate);

  const displayedPosts = [...posts]
    .filter((post) => {
      if (savedOnly && !post.viewer_has_saved) return false;
      if (resourcesOnly && !post.body.startsWith('__RESOURCE__:')) return false;
      if (!selectedSpaceId) return true;
      return post.space_id === selectedSpaceId;
    })
    .reverse();

  const pinnedInSpace = displayedPosts.filter((p) => p.is_pinned);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedSpaceId, posts.length]);

  async function handleToggleAllowMemberResources(nextAllowed: boolean) {
    setAllowMemberResources(nextAllowed);
    setAdminPopoverOpen(false);
    await fetch(`/api/circles/${circle.id}/capabilities`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        capabilityKey: 'discussions',
        enabled: true,
        settings: { allowMemberResources: nextAllowed },
      }),
    });
  }

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = chatMessage.trim();
    if (!trimmed && !showPollCreator && !showResourceCreator) return;

    const targetSpace = activeSpace || spaces[0] || null;

    setSubmittingPost(true);
    setErrorMessage(null);

    try {
      let createdPoll: CirclePollItem | null = null;
      let bodyToSend = trimmed;
      let titleToSend = trimmed.split('\n')[0].slice(0, 90) || 'Discussion';

      if (showResourceCreator) {
        if (resourceTitle.trim().length < 2) {
          setErrorMessage('Please enter a resource title.');
          setSubmittingPost(false);
          return;
        }
        const meta: AttachedResourceMeta = {
          title: resourceTitle.trim(),
          category: resourceCategory,
          url: resourceUrl.trim() || null,
        };
        bodyToSend = `__RESOURCE__:${JSON.stringify(meta)}\n${trimmed}`;
        titleToSend = `Resource: ${meta.title}`;

        // Best-effort sync to learning_resources_items table
        fetch(`/api/circles/${circle.id}/resources`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            capabilityKey: 'shared_resources',
            category: meta.category.toLowerCase(),
            title: meta.title,
            summary: trimmed.slice(0, 500),
            contentBody: trimmed,
            externalUrl: meta.url || null,
          }),
        }).catch(() => {});
      } else if (showPollCreator) {
        const validOpts = pollOptions.map((o) => o.trim()).filter(Boolean);
        if (pollQuestion.trim().length < 3 || validOpts.length < 2) {
          setErrorMessage('Poll needs a question and at least 2 options.');
          setSubmittingPost(false);
          return;
        }

        const pollRes = await fetch(`/api/circles/${circle.id}/polls`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spaceId: targetSpace?.id ?? null,
            question: pollQuestion.trim(),
            description: trimmed || '',
            allowMultiple: pollAllowMultiple,
            options: validOpts,
          }),
        });
        const pollData = await pollRes.json();
        if (!pollRes.ok) {
          setErrorMessage(pollData.error || 'Could not create poll.');
          setSubmittingPost(false);
          return;
        }
        createdPoll = pollData.poll;
        bodyToSend = trimmed || createdPoll!.question;
        titleToSend = `Poll: ${createdPoll!.question}`;
      }

      const res = await fetch(`/api/circles/${circle.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spaceId: targetSpace?.id ?? null,
          title: titleToSend,
          body: bodyToSend,
          pollId: createdPoll?.id ?? null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to send.');
        return;
      }

      const newPost: PostItem = {
        ...data.post,
        poll: createdPoll ?? data.post.poll ?? null,
      };

      setPosts((prev) => [newPost, ...prev]);
      setChatMessage('');
      if (showPollCreator) {
        setShowPollCreator(false);
        setPollQuestion('');
        setPollOptions(['', '']);
      }
      if (showResourceCreator) {
        setShowResourceCreator(false);
        setResourceTitle('');
        setResourceUrl('');
      }
      router.refresh();
    } catch {
      setErrorMessage('Network error.');
    } finally {
      setSubmittingPost(false);
    }
  }

  async function handleVotePoll(postId: string, pollId: string, optionId: string) {
    if (!currentUserId) return;
    setVotingOptionId(optionId);
    try {
      const res = await fetch(`/api/circles/${circle.id}/polls`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vote', pollId, optionIds: [optionId] }),
      });
      const data = await res.json();
      if (res.ok && data.poll) {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, poll: data.poll } : p))
        );
      }
    } finally {
      setVotingOptionId(null);
    }
  }

  async function handlePostInteraction(
    postId: string,
    action: 'toggle_reaction' | 'toggle_save' | 'pin' | 'delete',
    extra?: Record<string, unknown>
  ) {
    const res = await fetch(`/api/circles/${circle.id}/posts`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, action, ...extra }),
    });
    if (!res.ok) return;

    if (action === 'toggle_reaction') {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const nextLiked = !p.viewer_has_liked;
          return {
            ...p,
            viewer_has_liked: nextLiked,
            reaction_count: Math.max(0, p.reaction_count + (nextLiked ? 1 : -1)),
          };
        })
      );
    } else if (action === 'toggle_save') {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, viewer_has_saved: !p.viewer_has_saved } : p))
      );
    } else if (action === 'pin') {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, is_pinned: Boolean(extra?.pinned) } : p))
      );
    } else if (action === 'delete') {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (activeThreadPostId === postId) setActiveThreadPostId(null);
    }
  }

  async function handleOpenThread(postId: string) {
    setActiveThreadPostId(postId);
    if (!commentsByPost[postId]) {
      setLoadingThread(true);
      try {
        const res = await fetch(`/api/circles/${circle.id}/comments?postId=${postId}`);
        const data = await res.json();
        if (res.ok) {
          setCommentsByPost((prev) => ({ ...prev, [postId]: data.comments || [] }));
        }
      } finally {
        setLoadingThread(false);
      }
    }
  }

  async function handleSubmitThreadReply(e: React.FormEvent) {
    e.preventDefault();
    if (!activeThreadPostId) return;
    const body = commentDraft.trim();
    if (!body) return;

    const res = await fetch(`/api/circles/${circle.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId: activeThreadPostId,
        body,
      }),
    });
    const data = await res.json();
    if (!res.ok) return;

    setCommentsByPost((prev) => ({
      ...prev,
      [activeThreadPostId]: [...(prev[activeThreadPostId] || []), data.comment],
    }));
    setPosts((prev) =>
      prev.map((p) =>
        p.id === activeThreadPostId ? { ...p, comment_count: p.comment_count + 1 } : p
      )
    );
    setCommentDraft('');
  }

  async function handleDeleteComment(postId: string, commentId: string) {
    const res = await fetch(`/api/circles/${circle.id}/comments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId }),
    });
    if (!res.ok) return;

    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).filter((c) => c.id !== commentId),
    }));
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p
      )
    );
  }

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!reportingPostId) return;

    const res = await fetch('/api/moderation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        circleId: circle.id,
        targetType: 'post',
        targetId: reportingPostId,
        reason: reportReason,
        details: reportDetails,
      }),
    });

    if (res.ok) {
      setReportingPostId(null);
      setReportDetails('');
      setFeedbackToast('Reported');
      setTimeout(() => setFeedbackToast(null), 3000);
    }
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[540px] w-full overflow-hidden rounded-2xl border border-stone-200/80 bg-white">
      {/* Main Feed Column */}
      <div className="flex flex-1 flex-col min-w-0 bg-white">
        {/* Header with Space Pills & Inline Filter Toggles */}
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 px-5 py-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedSpaceId(null)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                selectedSpaceId === null
                  ? 'bg-[#F4F3EE] text-[#1B4332] font-semibold'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Hash className="h-3.5 w-3.5 opacity-60" />
              <span>All</span>
            </button>
            {spaces.map((sp) => {
              const active = selectedSpaceId === sp.id;
              return (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => setSelectedSpaceId(sp.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#F4F3EE] text-[#1B4332] font-semibold'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <Hash className="h-3.5 w-3.5 opacity-60" />
                  <span>{sp.name}</span>
                </button>
              );
            })}
          </div>

          <div className="relative flex items-center gap-1.5">
            {/* Option B: Resources Filter Toggle */}
            <button
              type="button"
              onClick={() => setResourcesOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                resourcesOnly
                  ? 'bg-[#1B4332] text-white'
                  : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Resources</span>
            </button>

            <button
              type="button"
              onClick={() => setSavedOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                savedOnly
                  ? 'bg-[#1B4332] text-white'
                  : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              <span>Saved</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setAdminPopoverOpen((v) => !v)}
                title="Chat settings"
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <Sliders className="h-3.5 w-3.5" />
              </button>
            )}

            {adminPopoverOpen && (
              <div className="absolute right-0 top-9 z-30 w-60 rounded-xl border border-stone-200 bg-white p-3 shadow-lg">
                <label className="flex items-center justify-between gap-2 text-xs font-medium text-stone-800 cursor-pointer">
                  <span>Allow members to share resources</span>
                  <input
                    type="checkbox"
                    checked={allowMemberResources}
                    onChange={(e) => handleToggleAllowMemberResources(e.target.checked)}
                  />
                </label>
              </div>
            )}
          </div>
        </header>

        {/* Pinned Banner */}
        {pinnedInSpace.length > 0 && (
          <div className="flex items-center gap-2 border-b border-stone-100 bg-[#FAF9F6] px-5 py-2 text-xs text-stone-700">
            <Pin className="h-3.5 w-3.5 shrink-0 text-[#1B4332]" />
            <div className="flex flex-1 items-center gap-3 overflow-x-auto no-scrollbar">
              {pinnedInSpace.map((p) => {
                const { resource, cleanBody } = parsePostContent(p.body);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleOpenThread(p.id)}
                    className="truncate hover:underline font-medium"
                  >
                    {resource ? resource.title : p.title || cleanBody.slice(0, 80)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {feedbackToast && (
          <div className="bg-[#1B4332] px-4 py-1.5 text-center text-xs font-medium text-white">
            {feedbackToast}
          </div>
        )}

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {displayedPosts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center">
              {resourcesOnly ? (
                <>
                  <BookOpen className="h-7 w-7 text-stone-300" />
                  <p className="mt-2 text-sm font-medium text-stone-600">No resources shared yet</p>
                  {canShareResource && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowPollCreator(false);
                        setShowResourceCreator(true);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#1B4332] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2D6A4F]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Share resource</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <MessageSquare className="h-7 w-7 text-stone-300" />
                  <p className="mt-2 text-sm font-medium text-stone-600">No messages yet</p>
                </>
              )}
            </div>
          ) : (
            displayedPosts.map((post, idx) => {
              const prevPost = idx > 0 ? displayedPosts[idx - 1] : null;
              const isGroupedWithPrev =
                prevPost &&
                prevPost.author_id === post.author_id &&
                new Date(post.created_at).getTime() - new Date(prevPost.created_at).getTime() <
                  5 * 60 * 1000 &&
                !post.is_pinned;

              const canEditOrDelete = canModerate || post.author_id === currentUserId;
              const attachedPoll = post.poll ?? null;
              const { resource: attachedResource, cleanBody } = parsePostContent(post.body);
              const showTitle =
                !attachedResource &&
                !attachedPoll &&
                post.title &&
                post.title.trim() !== cleanBody.trim().slice(0, post.title.trim().length);

              return (
                <div
                  key={post.id}
                  className={`group relative flex items-start gap-3 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-stone-50/80 ${
                    isGroupedWithPrev ? 'mt-0' : 'mt-3 pt-2'
                  }`}
                >
                  {!isGroupedWithPrev ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F4F3EE] text-xs font-semibold text-[#1B4332]">
                      {(post.author?.display_name || 'M').slice(0, 2).toUpperCase()}
                    </div>
                  ) : (
                    <div className="w-8 shrink-0 text-right opacity-0 group-hover:opacity-100">
                      <span className="text-[10px] text-stone-400">
                        {formatShortTime(post.created_at)}
                      </span>
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    {!isGroupedWithPrev && (
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-sm font-semibold text-stone-900">
                          {post.author?.display_name || 'Member'}
                        </span>
                        {!selectedSpaceId && post.space?.name && (
                          <span className="text-[11px] text-stone-400">#{post.space.name}</span>
                        )}
                        <span className="text-[11px] text-stone-400">
                          {formatShortTime(post.created_at)}
                        </span>
                        {post.is_pinned && <Pin className="h-3 w-3 text-[#1B4332]" />}
                      </div>
                    )}

                    {showTitle && (
                      <h4 className="mt-0.5 text-sm font-semibold text-stone-900">{post.title}</h4>
                    )}

                    {/* Inline Resource Card */}
                    {attachedResource && (
                      <div className="mt-2 max-w-lg rounded-xl border border-stone-200 bg-[#FAF9F6] p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F4F3EE] text-[#1B4332]">
                              <BookOpen className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1B4332]">
                                {attachedResource.category}
                              </span>
                              <h4 className="text-sm font-semibold text-stone-900 truncate">
                                {attachedResource.title}
                              </h4>
                            </div>
                          </div>

                          {attachedResource.url && (
                            <a
                              href={attachedResource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#1B4332] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#2D6A4F]"
                            >
                              <span>Open</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>

                        {cleanBody && (
                          <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-stone-600">
                            {cleanBody}
                          </p>
                        )}
                      </div>
                    )}

                    {!attachedResource && cleanBody && (
                      <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-stone-700 break-words">
                        {cleanBody}
                      </p>
                    )}

                    {/* Inline Poll */}
                    {attachedPoll && (
                      <div className="mt-2.5 max-w-md rounded-xl border border-stone-200 bg-[#FAF9F6] p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-stone-900">
                            {attachedPoll.question}
                          </span>
                          <span className="text-[11px] text-stone-400">
                            {attachedPoll.status === 'closed'
                              ? 'Closed'
                              : `${attachedPoll.total_votes || 0} votes`}
                          </span>
                        </div>

                        <div className="mt-2.5 space-y-1.5">
                          {(attachedPoll.options || []).map((opt: PollOptionItem) => {
                            const totalVotes = attachedPoll.total_votes || 0;
                            const pct =
                              totalVotes > 0
                                ? Math.round(((opt.vote_count || 0) / totalVotes) * 100)
                                : 0;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                disabled={
                                  attachedPoll.status === 'closed' ||
                                  !currentUserId ||
                                  votingOptionId === opt.id
                                }
                                onClick={() => handleVotePoll(post.id, attachedPoll.id, opt.id)}
                                className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                                  opt.viewer_voted
                                    ? 'border-[#1B4332] bg-white font-semibold text-stone-900'
                                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                                }`}
                              >
                                <div
                                  className="pointer-events-none absolute inset-y-0 left-0 bg-[#F4F3EE]"
                                  style={{ width: `${pct}%` }}
                                />
                                <div className="relative flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-1.5">
                                    {opt.viewer_voted && (
                                      <Check className="h-3.5 w-3.5 text-[#1B4332]" />
                                    )}
                                    <span>{opt.label}</span>
                                  </span>
                                  <span className="text-[11px] text-stone-500">{pct}%</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Reactions & Thread Count */}
                    {(post.reaction_count > 0 || post.comment_count > 0) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {post.reaction_count > 0 && (
                          <button
                            type="button"
                            onClick={() => handlePostInteraction(post.id, 'toggle_reaction')}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                              post.viewer_has_liked
                                ? 'border-[#1B4332]/30 bg-[#F4F3EE] text-[#1B4332] font-medium'
                                : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                            }`}
                          >
                            <Heart className="h-3 w-3" />
                            <span>{post.reaction_count}</span>
                          </button>
                        )}

                        {post.comment_count > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenThread(post.id)}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-[#1B4332] hover:bg-[#F4F3EE]"
                          >
                            <MessageSquare className="h-3 w-3" />
                            <span>
                              {post.comment_count}{' '}
                              {post.comment_count === 1 ? 'reply' : 'replies'}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Hover Action Toolbar */}
                  <div className="absolute -top-2.5 right-3 hidden items-center gap-0.5 rounded-lg border border-stone-200 bg-white p-0.5 shadow-xs group-hover:flex">
                    <button
                      type="button"
                      onClick={() => handlePostInteraction(post.id, 'toggle_reaction')}
                      title="Like"
                      className={`rounded p-1.5 hover:bg-stone-100 ${
                        post.viewer_has_liked
                          ? 'text-[#1B4332]'
                          : 'text-stone-500 hover:text-stone-900'
                      }`}
                    >
                      <Heart className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenThread(post.id)}
                      title="Reply"
                      className="rounded p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePostInteraction(post.id, 'toggle_save')}
                      title="Save"
                      className={`rounded p-1.5 hover:bg-stone-100 ${
                        post.viewer_has_saved
                          ? 'text-[#1B4332]'
                          : 'text-stone-500 hover:text-stone-900'
                      }`}
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                    </button>

                    {canModerate && (
                      <button
                        type="button"
                        onClick={() =>
                          handlePostInteraction(post.id, 'pin', { pinned: !post.is_pinned })
                        }
                        title={post.is_pinned ? 'Unpin' : 'Pin'}
                        className="rounded p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {canEditOrDelete && (
                      <button
                        type="button"
                        onClick={() => handlePostInteraction(post.id, 'delete')}
                        title="Delete"
                        className="rounded p-1.5 text-stone-500 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {currentUserId && post.author_id !== currentUserId && (
                      <button
                        type="button"
                        onClick={() => setReportingPostId(post.id)}
                        title="Report"
                        className="rounded p-1.5 text-stone-500 hover:bg-amber-50 hover:text-amber-700"
                      >
                        <Flag className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={feedEndRef} />
        </div>

        {/* Composer */}
        <div className="border-t border-stone-200/80 bg-white px-4 py-3">
          {errorMessage && (
            <div className="mb-2 flex items-center justify-between rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
              <span>{errorMessage}</span>
              <button type="button" onClick={() => setErrorMessage(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Share Resource Creator */}
          {showResourceCreator && (
            <div className="mb-3 rounded-xl border border-stone-200 bg-[#FAF9F6] p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-900">Share Resource</span>
                <button
                  type="button"
                  onClick={() => setShowResourceCreator(false)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  type="text"
                  value={resourceTitle}
                  onChange={(e) => setResourceTitle(e.target.value)}
                  placeholder="Resource title *"
                  className="sm:col-span-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-[#1B4332] focus:outline-none"
                />
                <select
                  value={resourceCategory}
                  onChange={(e) => setResourceCategory(e.target.value)}
                  className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:border-[#1B4332] focus:outline-none"
                >
                  {RESOURCE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <input
                type="url"
                value={resourceUrl}
                onChange={(e) => setResourceUrl(e.target.value)}
                placeholder="Link URL (https://... optional)"
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-[#1B4332] focus:outline-none"
              />
            </div>
          )}

          {/* Poll Creator */}
          {showPollCreator && (
            <div className="mb-3 rounded-xl border border-stone-200 bg-[#FAF9F6] p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-900">New Poll</span>
                <button
                  type="button"
                  onClick={() => setShowPollCreator(false)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Question"
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-[#1B4332] focus:outline-none"
              />
              <div className="space-y-1.5">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) =>
                        setPollOptions((prev) =>
                          prev.map((v, idx) => (idx === i ? e.target.value : v))
                        )
                      }
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-900 focus:border-[#1B4332] focus:outline-none"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPollOptions((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="text-stone-400 hover:text-red-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1">
                {pollOptions.length < 8 ? (
                  <button
                    type="button"
                    onClick={() => setPollOptions((prev) => [...prev, ''])}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#1B4332]"
                  >
                    <Plus className="h-3 w-3" /> Add option
                  </button>
                ) : (
                  <span />
                )}
                <label className="inline-flex items-center gap-1 text-[11px] text-stone-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pollAllowMultiple}
                    onChange={(e) => setPollAllowMultiple(e.target.checked)}
                  />
                  <span>Multiple choice</span>
                </label>
              </div>
            </div>
          )}

          {canPostInActiveSpace ? (
            <form onSubmit={handleSendMessage} className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowResourceCreator(false);
                  setShowPollCreator((v) => !v);
                }}
                title="Create poll"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                  showPollCreator
                    ? 'border-[#1B4332] bg-[#F4F3EE] text-[#1B4332]'
                    : 'border-stone-200 text-stone-500 hover:bg-stone-50'
                }`}
              >
                <BarChart2 className="h-4 w-4" />
              </button>

              {canShareResource && (
                <button
                  type="button"
                  onClick={() => {
                    setShowPollCreator(false);
                    setShowResourceCreator((v) => !v);
                  }}
                  title="Share resource"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                    showResourceCreator
                      ? 'border-[#1B4332] bg-[#F4F3EE] text-[#1B4332]'
                      : 'border-stone-200 text-stone-500 hover:bg-stone-50'
                  }`}
                >
                  <BookOpen className="h-4 w-4" />
                </button>
              )}

              <textarea
                rows={1}
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  showResourceCreator
                    ? 'Add notes or summary for this resource...'
                    : `Write a message in #${activeSpace?.name || spaces[0]?.name || 'general'}...`
                }
                className="max-h-32 min-h-[38px] flex-1 resize-none rounded-xl border border-stone-200 bg-[#FAF9F6] px-3.5 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#1B4332] focus:bg-white focus:outline-none"
              />

              <button
                type="submit"
                disabled={
                  submittingPost ||
                  (!chatMessage.trim() && !showPollCreator && !showResourceCreator)
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1B4332] text-white transition-colors hover:bg-[#2D6A4F] disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div className="py-1.5 text-center text-xs text-stone-400">
              {currentUserId ? 'Read-only space' : 'Sign in to post'}
            </div>
          )}
        </div>
      </div>

      {/* Thread Drawer */}
      {activeThreadPost && (
        <aside className="flex w-full flex-col border-l border-stone-200 bg-white sm:w-80 lg:w-96">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
            <h4 className="text-xs font-semibold text-stone-900">Thread</h4>
            <button
              type="button"
              onClick={() => setActiveThreadPostId(null)}
              className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="rounded-xl bg-[#FAF9F6] p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-900">
                  {activeThreadPost.author?.display_name || 'Member'}
                </span>
                <span className="text-[10px] text-stone-400">
                  {formatShortTime(activeThreadPost.created_at)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-stone-700">
                {parsePostContent(activeThreadPost.body).cleanBody ||
                  parsePostContent(activeThreadPost.body).resource?.title}
              </p>
            </div>

            <div className="space-y-2.5">
              {loadingThread ? (
                <p className="text-xs text-stone-400">Loading...</p>
              ) : (commentsByPost[activeThreadPost.id] || []).length === 0 ? (
                <p className="text-xs text-stone-400">No replies yet</p>
              ) : (
                (commentsByPost[activeThreadPost.id] || []).map((c) => {
                  const canRemove = canModerate || c.author_id === currentUserId;
                  return (
                    <div
                      key={c.id}
                      className="group rounded-xl border border-stone-100 bg-white p-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-stone-900">
                          {c.author?.display_name || 'Member'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-stone-400">
                            {formatShortTime(c.created_at)}
                          </span>
                          {canRemove && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(activeThreadPost.id, c.id)}
                              className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-stone-700 leading-relaxed">{c.body}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {currentUserId && isActiveMember && (
            <form
              onSubmit={handleSubmitThreadReply}
              className="border-t border-stone-200 p-3 flex items-center gap-2"
            >
              <input
                type="text"
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Reply..."
                className="flex-1 rounded-xl border border-stone-200 bg-[#FAF9F6] px-3 py-2 text-xs text-stone-900 focus:border-[#1B4332] focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={!commentDraft.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1B4332] text-white hover:bg-[#2D6A4F] disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          )}
        </aside>
      )}

      {/* Report Modal */}
      {reportingPostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSubmitReport}
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-5 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-stone-900">Report message</h4>
              <button
                type="button"
                onClick={() => setReportingPostId(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value as typeof reportReason)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-800"
              >
                <option value="rule_violation">Rule violation</option>
                <option value="spam">Spam</option>
                <option value="harassment">Harassment</option>
                <option value="misinformation">Misinformation</option>
                <option value="other">Other</option>
              </select>

              <input
                type="text"
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Notes (optional)"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-800"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportingPostId(null)}
                className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#1B4332] px-4 py-1.5 text-xs font-semibold text-white"
              >
                Report
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
