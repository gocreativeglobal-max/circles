'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BarChart2,
  Bookmark,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Compass,
  ExternalLink,
  Globe,
  GraduationCap,
  Hash,
  Heart,
  HeartHandshake,
  Layers,
  Lock,
  MapPin,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  Pin,
  Play,
  Plus,
  PlusCircle,
  Search,
  Send,
  Share2,
  ShoppingBag,
  Sparkles,
  Tag,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  Circle,
  CircleEventItem,
  CirclePollItem,
  CommentItem,
  MarketplaceListingItem,
  PollOptionItem,
  PostItem,
  UserProfile,
} from '@/types/domain';
import {
  ComposerCircleOption,
  FeedCircleContext,
  GlobalFeedItem,
} from '@/features/feed/service';

export interface SocialNewsfeedClientProps {
  currentUser: UserProfile | null;
  initialItems: GlobalFeedItem[];
  composerCircles: ComposerCircleOption[];
  myCircles: Circle[];
  trendingCircles: Circle[];
  upcomingEvents: Array<CircleEventItem & { circle: FeedCircleContext }>;
  stats: {
    publicCircleCount: number;
    totalPostCount: number;
    upcomingEventCount: number;
  };
}

type FeedScope = 'public' | 'my_circles' | 'saved';
type ContentTypeFilter = 'all' | 'posts' | 'courses' | 'events' | 'marketplace';

interface AttachedResourceMeta {
  title: string;
  category: string;
  url?: string | null;
}

const CATEGORIES = [
  { key: 'all', label: 'All Topics' },
  { key: 'university', label: 'University' },
  { key: 'creator', label: 'Creator' },
  { key: 'professional', label: 'Professional' },
  { key: 'learning', label: 'Learning' },
  { key: 'neighbourhood', label: 'Neighbourhood' },
  { key: 'sports', label: 'Sports' },
  { key: 'project', label: 'Projects' },
  { key: 'local_business', label: 'Local Business' },
];

const RESOURCE_CATEGORIES = ['Guide', 'Link', 'Document', 'Template', 'Video'];

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

function formatRelativeTime(isoStr: string): string {
  try {
    const diffMs = Date.now() - new Date(isoStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(isoStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function getEventChannelLabel(ev: CircleEventItem): string {
  const hc = ev.host_controls as Record<string, unknown> | undefined;
  const savedChannel = hc?.meeting_channel;
  if (savedChannel === 'google_meet') return 'Google Meet';
  if (savedChannel === 'zoom') return 'Zoom';
  if (savedChannel === 'teams') return 'Microsoft Teams';
  if (savedChannel === 'youtube') return 'YouTube Live';
  if (savedChannel === 'custom') return 'Online Meeting';

  const url = (ev.meeting_url || '').toLowerCase();
  if (url.includes('meet.google.com')) return 'Google Meet';
  if (url.includes('zoom.us') || ev.location_type === 'zoom') return 'Zoom';
  if (url.includes('teams.microsoft.com') || url.includes('teams.live.com')) return 'Microsoft Teams';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube Live';
  if (ev.location_type === 'in_person') return 'In-Person';
  if (ev.location_type === 'hybrid') return 'Hybrid';
  return 'Online Meeting';
}

function formatListingPrice(listing: MarketplaceListingItem): string {
  if (listing.transaction_type === 'free' || listing.pricing_unit === 'free') return 'Free';
  if (listing.transaction_type === 'negotiable' || listing.pricing_unit === 'negotiable') {
    return 'Negotiable';
  }
  const symbol =
    listing.price_currency === 'GBP'
      ? '£'
      : listing.price_currency === 'EUR'
        ? '€'
        : listing.price_currency === 'NGN'
          ? '₦'
          : '$';
  if (
    listing.transaction_type === 'range' &&
    listing.price_min !== null &&
    listing.price_max !== null
  ) {
    return `${symbol}${listing.price_min} – ${symbol}${listing.price_max}`;
  }
  if (listing.price_amount === null || listing.price_amount === undefined) return 'Free';
  const amount = Number(listing.price_amount);
  const formatted = `${symbol}${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
  const unit = listing.rate_interval || listing.pricing_unit;
  if (unit && unit !== 'fixed') {
    return `${formatted}/${unit}`;
  }
  return formatted;
}

export function SocialNewsfeedClient({
  currentUser,
  initialItems,
  composerCircles: initialComposerCircles,
  myCircles: initialMyCircles,
  trendingCircles: initialTrendingCircles,
  upcomingEvents,
  stats: _stats,
}: SocialNewsfeedClientProps) {
  const router = useRouter();
  const [items, setItems] = useState<GlobalFeedItem[]>(initialItems);
  const [myCircles, setMyCircles] = useState<Circle[]>(initialMyCircles);
  const [trendingCircles, setTrendingCircles] = useState<Circle[]>(initialTrendingCircles);
  const [composerCircles] = useState<ComposerCircleOption[]>(initialComposerCircles);

  // Feed Filters
  const [scope, setScope] = useState<FeedScope>('public');
  const [contentType, setContentType] = useState<ContentTypeFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Collapsible Sidemenu state (Desktop & Mobile)
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('circles_newsfeed_sidebar_collapsed') === 'true') {
        setIsDesktopSidebarCollapsed(true);
      }
    } catch {
      // Ignore in private browsing
    }
  }, []);

  function toggleDesktopSidebar() {
    setIsDesktopSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('circles_newsfeed_sidebar_collapsed', String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }

  // Track Circles joined during this session (circleId -> 'active' | 'pending')
  const [joinedCircleMap, setJoinedCircleMap] = useState<Record<string, 'active' | 'pending'>>({});
  const [joiningCircleId, setJoiningCircleId] = useState<string | null>(null);

  // Quick-Post Composer state
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [selectedCircleId, setSelectedCircleId] = useState<string>(
    initialComposerCircles[0]?.id ?? ''
  );
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(
    initialComposerCircles[0]?.spaces[0]?.id ?? ''
  );
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [composerMode, setComposerMode] = useState<'post' | 'poll' | 'resource'>('post');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceCategory, setResourceCategory] = useState('Guide');
  const [resourceUrl, setResourceUrl] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  // Inline Expandable Comments state (postId -> open/comments/draft/loading)
  const [expandedCommentPosts, setExpandedCommentPosts] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommentItem[]>>({});
  const [loadingCommentsByPost, setLoadingCommentsByPost] = useState<Record<string, boolean>>({});
  const [commentDraftByPost, setCommentDraftByPost] = useState<Record<string, string>>({});
  const [submittingCommentByPost, setSubmittingCommentByPost] = useState<Record<string, boolean>>(
    {}
  );

  // Poll voting & Event RSVP loading state
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null);
  const [rsvpLoadingByEvent, setRsvpLoadingByEvent] = useState<Record<string, boolean>>({});
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);

  const selectedComposerCircle = useMemo(
    () => composerCircles.find((c) => c.id === selectedCircleId) ?? composerCircles[0] ?? null,
    [composerCircles, selectedCircleId]
  );

  function isViewerActiveMember(circle: FeedCircleContext): boolean {
    if (joinedCircleMap[circle.id] === 'active') return true;
    return circle.viewer_membership_status === 'active' || Boolean(circle.viewer_role);
  }

  function isViewerPendingMember(circle: FeedCircleContext): boolean {
    if (joinedCircleMap[circle.id] === 'pending') return true;
    return circle.viewer_join_request_status === 'pending';
  }

  // Filtered & sorted feed items
  const filteredItems = useMemo(() => {
    const list = items.filter((item) => {
      const isMember = isViewerActiveMember(item.circle);

      // 1. Scope filter
      if (scope === 'my_circles' && !isMember) {
        return false;
      }
      if (scope === 'saved') {
        if (item.itemType !== 'post' || !item.data.viewer_has_saved) return false;
      }

      // 2. Content Type filter
      if (contentType === 'posts' && item.itemType !== 'post') return false;
      if (contentType === 'courses' && item.itemType !== 'course') return false;
      if (contentType === 'events' && item.itemType !== 'event') return false;
      if (contentType === 'marketplace' && item.itemType !== 'listing') return false;

      // 3. Circle Category filter
      if (selectedCategory !== 'all' && item.circle.category !== selectedCategory) {
        return false;
      }

      // 4. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inCircleName = item.circle.name.toLowerCase().includes(q);
        if (item.itemType === 'post') {
          const inTitle = item.data.title.toLowerCase().includes(q);
          const inBody = item.data.body.toLowerCase().includes(q);
          const inAuthor = (item.data.author?.display_name || '').toLowerCase().includes(q);
          if (!inCircleName && !inTitle && !inBody && !inAuthor) return false;
        } else if (item.itemType === 'course') {
          const inTitle = item.data.title.toLowerCase().includes(q);
          const inDesc = (item.data.description || '').toLowerCase().includes(q);
          const inInstructor = (item.data.instructor?.display_name || '').toLowerCase().includes(q);
          if (!inCircleName && !inTitle && !inDesc && !inInstructor) return false;
        } else if (item.itemType === 'event') {
          const inTitle = item.data.title.toLowerCase().includes(q);
          const inDesc = (item.data.description || '').toLowerCase().includes(q);
          if (!inCircleName && !inTitle && !inDesc) return false;
        } else if (item.itemType === 'listing') {
          const inTitle = item.data.title.toLowerCase().includes(q);
          const inDesc = (item.data.description || '').toLowerCase().includes(q);
          if (!inCircleName && !inTitle && !inDesc) return false;
        } else if (item.itemType === 'resource') {
          const inTitle = item.data.title.toLowerCase().includes(q);
          const inSummary = (item.data.summary || '').toLowerCase().includes(q);
          if (!inCircleName && !inTitle && !inSummary) return false;
        } else if (item.itemType === 'cause') {
          const inTitle = item.data.title.toLowerCase().includes(q);
          const inDesc = (item.data.description || '').toLowerCase().includes(q);
          if (!inCircleName && !inTitle && !inDesc) return false;
        }
      }

      return true;
    });

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, scope, contentType, selectedCategory, searchQuery, joinedCircleMap]);

  // 1-Click Join or Request to Join a Circle
  async function handleJoinCircle(circle: {
    id: string;
    name: string;
    slug: string;
    membership_policy: string;
    category?: string;
    visibility?: string;
  }) {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    setJoiningCircleId(circle.id);
    try {
      const isApproval = circle.membership_policy === 'approval';
      const res = await fetch(`/api/circles/${circle.id}/membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isApproval ? 'request' : 'join',
          message: isApproval ? 'Joining from the public community feed.' : undefined,
        }),
      });
      if (res.ok) {
        const nextStatus = isApproval ? 'pending' : 'active';
        setJoinedCircleMap((prev) => ({ ...prev, [circle.id]: nextStatus }));
        setTrendingCircles((prev) =>
          prev.map((c) =>
            c.id === circle.id
              ? {
                  ...c,
                  current_user_membership_status: isApproval ? null : 'active',
                  current_user_role: isApproval ? null : 'member',
                  current_user_join_request_status: isApproval ? 'pending' : null,
                  member_count: isApproval ? c.member_count : (c.member_count ?? 1) + 1,
                }
              : c
          )
        );
        if (!isApproval) {
          const matchedTrending = trendingCircles.find((c) => c.id === circle.id);
          if (matchedTrending && !myCircles.some((m) => m.id === circle.id)) {
            setMyCircles((prev) => [
              ...prev,
              {
                ...matchedTrending,
                current_user_role: 'member',
                current_user_membership_status: 'active',
              },
            ]);
          }
        }
      }
    } finally {
      setJoiningCircleId(null);
    }
  }

  // Create Post from Homepage Quick Composer
  async function handleCreateFeedPost(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser || !selectedComposerCircle) return;

    const trimmedBody = postBody.trim();
    if (!trimmedBody && composerMode === 'post') {
      setComposerError('Please write something to share with the community.');
      return;
    }

    setSubmittingPost(true);
    setComposerError(null);

    try {
      let createdPoll: CirclePollItem | null = null;
      let finalBody = trimmedBody;
      let finalTitle =
        postTitle.trim() || trimmedBody.split('\n')[0]?.slice(0, 90) || 'Community Update';

      if (composerMode === 'resource') {
        if (resourceTitle.trim().length < 2) {
          setComposerError('Please enter a title for the shared resource.');
          setSubmittingPost(false);
          return;
        }
        const meta: AttachedResourceMeta = {
          title: resourceTitle.trim(),
          category: resourceCategory,
          url: resourceUrl.trim() || null,
        };
        finalBody = `__RESOURCE__:${JSON.stringify(meta)}\n${trimmedBody}`;
        finalTitle = postTitle.trim() || `Resource: ${meta.title}`;
      } else if (composerMode === 'poll') {
        const validOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
        if (pollQuestion.trim().length < 3 || validOptions.length < 2) {
          setComposerError('Please enter a poll question and at least 2 options.');
          setSubmittingPost(false);
          return;
        }
        const pollRes = await fetch(`/api/circles/${selectedComposerCircle.id}/polls`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spaceId: selectedSpaceId || null,
            question: pollQuestion.trim(),
            description: trimmedBody,
            allowMultiple: false,
            options: validOptions,
          }),
        });
        const pollData = await pollRes.json();
        if (!pollRes.ok) {
          setComposerError(pollData.error || 'Could not create poll.');
          setSubmittingPost(false);
          return;
        }
        createdPoll = pollData.poll;
        finalBody = trimmedBody || pollQuestion.trim();
        finalTitle = postTitle.trim() || `Poll: ${pollQuestion.trim()}`;
      }

      const res = await fetch(`/api/circles/${selectedComposerCircle.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spaceId: selectedSpaceId || null,
          title: finalTitle,
          body: finalBody,
          pollId: createdPoll?.id ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setComposerError(data.error || 'Failed to publish post.');
        setSubmittingPost(false);
        return;
      }

      const matchedSpace = selectedComposerCircle.spaces.find((s) => s.id === selectedSpaceId);
      const newPost: PostItem = {
        ...data.post,
        author: {
          id: currentUser.id,
          username: currentUser.username,
          display_name: currentUser.display_name,
          avatar_url: currentUser.avatar_url,
        },
        space: matchedSpace
          ? {
              id: matchedSpace.id,
              name: matchedSpace.name,
              slug: matchedSpace.slug,
              icon: 'message-square',
            }
          : null,
        viewer_has_liked: false,
        viewer_has_saved: false,
        poll: createdPoll ?? data.post.poll ?? null,
      };

      const newFeedItem: GlobalFeedItem = {
        id: `post-${newPost.id}`,
        itemType: 'post',
        timestamp: newPost.created_at,
        engagementScore: 2,
        circle: {
          id: selectedComposerCircle.id,
          name: selectedComposerCircle.name,
          slug: selectedComposerCircle.slug,
          description: '',
          category: selectedComposerCircle.category,
          location: null,
          avatar_url: selectedComposerCircle.avatar_url,
          cover_url: null,
          visibility: selectedComposerCircle.visibility,
          membership_policy: 'open',
          member_count: 1,
          viewer_role: selectedComposerCircle.role,
          viewer_membership_status: 'active',
          viewer_join_request_status: null,
        },
        authorRole: selectedComposerCircle.role,
        data: newPost,
      };

      setItems((prev) => [newFeedItem, ...prev]);
      setPostTitle('');
      setPostBody('');
      setPollQuestion('');
      setPollOptions(['', '']);
      setResourceTitle('');
      setResourceUrl('');
      setComposerMode('post');
      setComposerExpanded(false);
    } catch {
      setComposerError('Network error while publishing post.');
    } finally {
      setSubmittingPost(false);
    }
  }

  // Toggle Like / Reaction on a Post (Allowed for any logged-in user on Public Circles!)
  async function handleToggleLike(circleId: string, postId: string) {
    if (!currentUser) {
      router.push('/login');
      return;
    }

    // Optimistic update
    setItems((prev) =>
      prev.map((item) => {
        if (item.itemType !== 'post' || item.data.id !== postId) return item;
        const nextLiked = !item.data.viewer_has_liked;
        const nextCount = Math.max(0, item.data.reaction_count + (nextLiked ? 1 : -1));
        return {
          ...item,
          data: {
            ...item.data,
            viewer_has_liked: nextLiked,
            reaction_count: nextCount,
          },
        };
      })
    );

    try {
      const res = await fetch(`/api/circles/${circleId}/posts/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'react', reactionType: 'like' }),
      });
      if (res.ok) {
        const data = await res.json();
        setItems((prev) =>
          prev.map((item) => {
            if (item.itemType !== 'post' || item.data.id !== postId) return item;
            return {
              ...item,
              data: {
                ...item.data,
                viewer_has_liked: Boolean(data.active),
                reaction_count: Number(data.reactionCount ?? item.data.reaction_count),
              },
            };
          })
        );
      }
    } catch {
      // Ignore network error
    }
  }

  // Toggle Save / Bookmark on a Post (Allowed for any logged-in user on Public Circles!)
  async function handleToggleSave(circleId: string, postId: string) {
    if (!currentUser) {
      router.push('/login');
      return;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.itemType !== 'post' || item.data.id !== postId) return item;
        return {
          ...item,
          data: {
            ...item.data,
            viewer_has_saved: !item.data.viewer_has_saved,
          },
        };
      })
    );

    try {
      await fetch(`/api/circles/${circleId}/posts/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save' }),
      });
    } catch {
      // Ignore network error
    }
  }

  // Toggle Inline Expandable Comments & Load Thread
  async function handleToggleComments(circleId: string, postId: string) {
    const isCurrentlyOpen = Boolean(expandedCommentPosts[postId]);
    setExpandedCommentPosts((prev) => ({ ...prev, [postId]: !isCurrentlyOpen }));

    if (!isCurrentlyOpen && !commentsByPost[postId]) {
      setLoadingCommentsByPost((prev) => ({ ...prev, [postId]: true }));
      try {
        const res = await fetch(`/api/circles/${circleId}/posts/${postId}`);
        if (res.ok) {
          const data = await res.json();
          setCommentsByPost((prev) => ({ ...prev, [postId]: data.comments || [] }));
        }
      } finally {
        setLoadingCommentsByPost((prev) => ({ ...prev, [postId]: false }));
      }
    }
  }

  // Submit Inline Comment Reply
  async function handleSubmitComment(e: React.FormEvent, circleId: string, postId: string) {
    e.preventDefault();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    const draft = (commentDraftByPost[postId] || '').trim();
    if (!draft) return;

    setSubmittingCommentByPost((prev) => ({ ...prev, [postId]: true }));
    try {
      const res = await fetch(`/api/circles/${circleId}/posts/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment', body: draft }),
      });
      const data = await res.json();
      if (res.ok && data.comment) {
        const enrichedComment: CommentItem = {
          ...data.comment,
          author: {
            id: currentUser.id,
            username: currentUser.username,
            display_name: currentUser.display_name,
            avatar_url: currentUser.avatar_url,
          },
        };
        setCommentsByPost((prev) => ({
          ...prev,
          [postId]: [...(prev[postId] || []), enrichedComment],
        }));
        setCommentDraftByPost((prev) => ({ ...prev, [postId]: '' }));
        setItems((prev) =>
          prev.map((item) => {
            if (item.itemType !== 'post' || item.data.id !== postId) return item;
            return {
              ...item,
              data: {
                ...item.data,
                comment_count: item.data.comment_count + 1,
              },
            };
          })
        );
      }
    } finally {
      setSubmittingCommentByPost((prev) => ({ ...prev, [postId]: false }));
    }
  }

  // Vote in an Inline Poll
  async function handleVotePoll(circleId: string, postId: string, pollId: string, optionId: string) {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    setVotingOptionId(optionId);
    try {
      const res = await fetch(`/api/circles/${circleId}/polls`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vote', pollId, optionIds: [optionId] }),
      });
      const data = await res.json();
      if (res.ok && data.poll) {
        setItems((prev) =>
          prev.map((item) =>
            item.itemType === 'post' && item.data.id === postId
              ? { ...item, data: { ...item.data, poll: data.poll } }
              : item
          )
        );
      }
    } finally {
      setVotingOptionId(null);
    }
  }

  // 1-Click RSVP to Event from Feed
  async function handleEventRsvp(
    circleId: string,
    eventId: string,
    rsvpAction: 'register' | 'cancel'
  ) {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    setRsvpLoadingByEvent((prev) => ({ ...prev, [eventId]: true }));
    try {
      const res = await fetch(`/api/circles/${circleId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rsvp', rsvpAction, eventId }),
      });
      const data = await res.json();
      if (res.ok && data.event) {
        setItems((prev) =>
          prev.map((item) =>
            item.itemType === 'event' && item.data.id === eventId
              ? { ...item, data: { ...item.data, ...data.event } }
              : item
          )
        );
      }
    } finally {
      setRsvpLoadingByEvent((prev) => ({ ...prev, [eventId]: false }));
    }
  }

  function handleShareUrl(itemId: string, path: string) {
    const url =
      typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
    setCopiedItemId(itemId);
    setTimeout(() => setCopiedItemId(null), 2000);
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] pb-20">
      {/* ===================================================================== */}
      {/* 1. COMPACT LANDING BANNER FOR LOGGED-OUT VISITORS                     */}
      {/* ===================================================================== */}
      {!currentUser && (
        <section className="relative overflow-hidden border-b border-stone-200/80 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black text-white">
          <div className="absolute inset-0 bg-grid-dark opacity-25 pointer-events-none" />
          <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              <div className="max-w-2xl space-y-2.5">
                <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300">
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  <span>Live Public Community Feed</span>
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl text-white">
                  One shared platform. Many types of communities.
                </h1>
                <p className="text-xs sm:text-sm text-stone-200/90 leading-relaxed">
                  Explore real-time discussions, polls, events, and marketplace listings from public
                  Circles across universities, creators, professional guilds, and neighbourhoods.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs sm:text-sm font-bold text-stone-900 shadow-md hover:bg-stone-100 transition-all"
                >
                  <Sparkles className="h-4 w-4 text-stone-700" />
                  <span>Join Circles Free</span>
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-700 bg-stone-900/80 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-stone-800 hover:border-stone-500 transition-all"
                >
                  <span>Sign In</span>
                </Link>
                <Link
                  href="/explore"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 bg-stone-900/80 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-stone-800 hover:border-stone-500 transition-all"
                >
                  <Compass className="h-4 w-4" />
                  <span>Directory</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* 2. THREE-COLUMN SOCIAL COMMUNITY NEWSFEED WORKSPACE                   */}
      {/* ===================================================================== */}
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8 space-y-4">
        {/* Mobile Sidemenu Collapsible Trigger (Visible strictly on mobile screens < lg) */}
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-2xl border border-stone-200/90 bg-white p-3.5 shadow-xs text-xs font-semibold text-stone-800 hover:bg-stone-50 transition-colors"
            aria-expanded={isMobileSidebarOpen}
            aria-label="Toggle Newsfeed Navigation Menu"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white">
                <PanelLeft className="h-4 w-4" />
              </span>
              <div className="text-left">
                <span className="block text-[10px] font-mono uppercase text-stone-400 font-bold">Menu</span>
                <span className="font-bold text-stone-900">
                  {scope === 'public'
                    ? 'Public Live Feed'
                    : scope === 'my_circles'
                    ? `My Circles Feed (${myCircles.length})`
                    : 'Saved Posts'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-700">
              <span>{isMobileSidebarOpen ? 'Close Menu' : 'Open Menu'}</span>
              {isMobileSidebarOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-stone-600" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-stone-600" />
              )}
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ----------------------------------------------------------------- */}
          {/* LEFT SIDEBAR: Feed Switcher & User's Joined Communities           */}
          {/* ----------------------------------------------------------------- */}
          <aside
            className={`space-y-5 transition-all duration-200 ${
              isMobileSidebarOpen ? 'block' : 'hidden'
            } ${
              isDesktopSidebarCollapsed
                ? 'lg:hidden'
                : 'lg:block lg:col-span-3'
            }`}
          >
            {/* Feed Navigation Card */}
            <div className="rounded-2xl border border-stone-200/90 bg-white p-3.5 shadow-xs space-y-1">
              <div className="flex items-center justify-between px-2.5 pb-1.5">
                <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-stone-400">
                  Newsfeed
                </p>
                {/* Desktop collapse button */}
                <button
                  type="button"
                  onClick={toggleDesktopSidebar}
                  className="hidden lg:flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                  title="Collapse sidebar (widen feed view)"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                  <span className="font-medium">Collapse</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setScope('public');
                  setIsMobileSidebarOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  scope === 'public'
                    ? 'bg-black text-white shadow-xs'
                    : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Globe className="h-4 w-4" />
                  <span>Public Feed</span>
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                    scope === 'public'
                      ? 'bg-white/20 text-white'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  Live
                </span>
              </button>

              {currentUser && (
                <button
                  type="button"
                  onClick={() => {
                    setScope('my_circles');
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                    scope === 'my_circles'
                      ? 'bg-black text-white shadow-xs'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Layers className="h-4 w-4" />
                    <span>My Circles Feed</span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${
                      scope === 'my_circles'
                        ? 'bg-white/20 text-white'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {myCircles.length}
                  </span>
                </button>
              )}

              {currentUser && (
                <button
                  type="button"
                  onClick={() => {
                    setScope('saved');
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                    scope === 'saved'
                      ? 'bg-black text-white shadow-xs'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Bookmark className="h-4 w-4" />
                    <span>Saved Posts</span>
                  </span>
                </button>
              )}
            </div>

            {/* My Joined Circles Quick-Jump Rail */}
            {currentUser && (
              <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500">
                    My Communities
                  </h2>
                  <Link
                    href="/circles/new"
                    className="inline-flex items-center gap-1 rounded-lg bg-[#F4F3EE] px-2 py-1 text-[11px] font-semibold text-stone-900 hover:bg-stone-200 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    <span>New</span>
                  </Link>
                </div>

                {myCircles.length === 0 ? (
                  <div className="rounded-xl bg-stone-50 p-3.5 text-center space-y-2">
                    <p className="text-xs text-stone-600">
                      You haven&apos;t joined any Circles yet.
                    </p>
                    <Link
                      href="/explore"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-stone-900 hover:underline"
                    >
                      <span>Browse Public Circles</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {myCircles.slice(0, 8).map((c) => (
                      <Link
                        key={c.id}
                        href={`/circles/${c.slug}`}
                        className="group flex items-center justify-between rounded-xl px-2.5 py-2 text-xs hover:bg-stone-50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black text-[11px] font-bold text-white">
                            {c.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-stone-900 group-hover:text-black">
                              {c.name}
                            </p>
                            <p className="text-[10px] text-stone-400 capitalize">
                              {c.category.replace('_', ' ')}
                            </p>
                          </div>
                        </div>
                        {c.current_user_role && (
                          <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[9px] font-mono uppercase text-stone-600">
                            {c.current_user_role}
                          </span>
                        )}
                      </Link>
                    ))}
                    {myCircles.length > 8 && (
                      <Link
                        href="/circles"
                        className="block pt-1 text-center text-xs font-semibold text-stone-900 hover:underline"
                      >
                        View all {myCircles.length} Circles
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </aside>

          {/* ----------------------------------------------------------------- */}
          {/* CENTER COLUMN: Quick Composer, Filter Bar & Social Feed           */}
          {/* ----------------------------------------------------------------- */}
          <div
            className={`space-y-4 transition-all duration-200 ${
              isDesktopSidebarCollapsed
                ? 'lg:col-span-9'
                : 'lg:col-span-6'
            }`}
          >
            {/* Desktop Expand Sidebar Banner (shown only when collapsed on desktop) */}
            {isDesktopSidebarCollapsed && (
              <div className="hidden lg:flex items-center justify-between rounded-2xl border border-stone-200/90 bg-white px-4 py-2.5 shadow-xs animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={toggleDesktopSidebar}
                  className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-bold text-stone-900 hover:bg-stone-100 hover:border-black transition-all shadow-2xs"
                  title="Expand sidemenu"
                >
                  <PanelLeft className="h-3.5 w-3.5 text-stone-700" />
                  <span>Show Sidemenu</span>
                  <span className="rounded-md bg-white border border-stone-200 px-1.5 py-0.5 text-[10px] font-mono font-bold text-stone-600">
                    {scope === 'public'
                      ? 'Public Feed'
                      : scope === 'my_circles'
                      ? `My Circles (${myCircles.length})`
                      : 'Saved Posts'}
                  </span>
                </button>
                <span className="text-[11px] font-medium text-stone-400">
                  Expanded reading view active · Click to restore side navigation
                </span>
              </div>
            )}
            {/* Quick-Post Composer for Logged-in Users */}
            {currentUser && composerCircles.length > 0 && (
              <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
                {!composerExpanded ? (
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-xs font-bold text-white overflow-hidden border border-stone-200">
                      {currentUser.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={currentUser.avatar_url}
                          alt={currentUser.display_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        currentUser.display_name.slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setComposerExpanded(true)}
                      className="flex-1 rounded-xl border border-stone-200 bg-[#FAF9F6] px-4 py-2.5 text-left text-xs sm:text-sm text-stone-500 hover:border-stone-300 hover:bg-stone-100/70 transition-all"
                    >
                      Share a post, poll, or resource with a community...
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleCreateFeedPost} className="space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-stone-500">Posting in:</span>
                        <select
                          value={selectedCircleId}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            setSelectedCircleId(nextId);
                            const nextCircle = composerCircles.find((c) => c.id === nextId);
                            setSelectedSpaceId(nextCircle?.spaces[0]?.id ?? '');
                          }}
                          className="rounded-xl border border-stone-200 bg-[#FAF9F6] px-3 py-1.5 text-xs font-semibold text-stone-900 focus:border-black focus:outline-none"
                        >
                          {composerCircles.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.visibility === 'public' ? 'Public' : 'Members'})
                            </option>
                          ))}
                        </select>

                        {selectedComposerCircle && selectedComposerCircle.spaces.length > 0 && (
                          <select
                            value={selectedSpaceId}
                            onChange={(e) => setSelectedSpaceId(e.target.value)}
                            className="rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700 focus:border-black focus:outline-none"
                          >
                            {selectedComposerCircle.spaces.map((sp) => (
                              <option key={sp.id} value={sp.id}>
                                #{sp.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setComposerExpanded(false)}
                        className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {composerError && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {composerError}
                      </div>
                    )}

                    <input
                      type="text"
                      value={postTitle}
                      onChange={(e) => setPostTitle(e.target.value)}
                      placeholder="Headline or title (optional)"
                      className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-stone-900 placeholder:font-normal placeholder:text-stone-400 focus:border-black focus:outline-none"
                    />

                    <textarea
                      rows={3}
                      value={postBody}
                      onChange={(e) => setPostBody(e.target.value)}
                      placeholder={`What would you like to share in ${selectedComposerCircle?.name || 'this community'}?`}
                      className="w-full rounded-xl border border-stone-200 bg-white p-3.5 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:border-black focus:outline-none"
                    />

                    {/* Optional Poll Builder */}
                    {composerMode === 'poll' && (
                      <div className="rounded-xl border border-stone-200 bg-[#FAF9F6] p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                            <BarChart2 className="h-3.5 w-3.5" />
                            Attach Community Poll
                          </span>
                          <button
                            type="button"
                            onClick={() => setComposerMode('post')}
                            className="text-xs text-stone-400 hover:text-stone-600"
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          type="text"
                          value={pollQuestion}
                          onChange={(e) => setPollQuestion(e.target.value)}
                          placeholder="Ask a question..."
                          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900"
                        />
                        <div className="space-y-1.5">
                          {pollOptions.map((opt, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const next = [...pollOptions];
                                  next[idx] = e.target.value;
                                  setPollOptions(next);
                                }}
                                placeholder={`Option ${idx + 1}`}
                                className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900"
                              />
                              {pollOptions.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPollOptions(pollOptions.filter((_, i) => i !== idx))
                                  }
                                  className="text-xs text-stone-400 hover:text-rose-600"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                          {pollOptions.length < 5 && (
                            <button
                              type="button"
                              onClick={() => setPollOptions([...pollOptions, ''])}
                              className="text-xs font-semibold text-stone-900 hover:underline"
                            >
                              + Add Option
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Optional Resource Builder */}
                    {composerMode === 'resource' && (
                      <div className="rounded-xl border border-stone-200 bg-[#FAF9F6] p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5" />
                            Attach Shared Resource
                          </span>
                          <button
                            type="button"
                            onClick={() => setComposerMode('post')}
                            className="text-xs text-stone-400 hover:text-stone-600"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <input
                            type="text"
                            value={resourceTitle}
                            onChange={(e) => setResourceTitle(e.target.value)}
                            placeholder="Resource title..."
                            className="sm:col-span-2 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900"
                          />
                          <select
                            value={resourceCategory}
                            onChange={(e) => setResourceCategory(e.target.value)}
                            className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700"
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
                          placeholder="https://... (optional link)"
                          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900"
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5">
                        {selectedComposerCircle?.pollsEnabled && (
                          <button
                            type="button"
                            onClick={() =>
                              setComposerMode(composerMode === 'poll' ? 'post' : 'poll')
                            }
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                              composerMode === 'poll'
                                ? 'bg-black text-white'
                                : 'bg-stone-100 text-stone-700 hover:bg-stone-200/80'
                            }`}
                          >
                            <BarChart2 className="h-3.5 w-3.5" />
                            <span>Poll</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setComposerMode(composerMode === 'resource' ? 'post' : 'resource')
                          }
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                            composerMode === 'resource'
                              ? 'bg-black text-white'
                              : 'bg-stone-100 text-stone-700 hover:bg-stone-200/80'
                          }`}
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>Resource</span>
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={submittingPost}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-zinc-800 disabled:opacity-50 transition-all"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>{submittingPost ? 'Publishing...' : 'Publish to Circle'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Feed Filter Bar: Content Types, Search & Category Pills */}
            <div className="rounded-2xl border border-stone-200/90 bg-white p-3.5 shadow-xs space-y-3">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                {/* Content Type Tabs (Mixed Stream Switcher) */}
                <div className="flex items-center gap-1 rounded-xl bg-stone-100/80 p-1 overflow-x-auto no-scrollbar">
                  {isDesktopSidebarCollapsed && (
                    <button
                      type="button"
                      onClick={toggleDesktopSidebar}
                      className="hidden lg:inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1.5 text-xs font-bold text-stone-900 border border-stone-200 shadow-2xs hover:bg-stone-50 transition-all shrink-0"
                      title="Show Sidemenu"
                    >
                      <PanelLeft className="h-3.5 w-3.5 text-stone-600" />
                      <span>Menu</span>
                    </button>
                  )}
                  {[
                    { key: 'all', label: 'All Activity' },
                    { key: 'posts', label: 'Posts & Polls' },
                    { key: 'courses', label: 'Courses' },
                    { key: 'events', label: 'Events' },
                    { key: 'marketplace', label: 'Marketplace' },
                  ].map((tab) => {
                    const active = contentType === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setContentType(tab.key as ContentTypeFilter)}
                        className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                          active
                            ? 'bg-black text-white shadow-2xs'
                            : 'text-stone-600 hover:bg-stone-200/70 hover:text-stone-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Inline Search */}
                <div className="relative min-w-[180px] flex-1 sm:max-w-[220px]">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-stone-400" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter feed..."
                    className="w-full rounded-xl border border-stone-200 bg-stone-50/70 py-1.5 pl-8 pr-3 text-xs text-stone-900 placeholder:text-stone-400 focus:border-black focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                {CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setSelectedCategory(cat.key)}
                      className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                        active
                          ? 'border border-black bg-black text-white font-semibold shadow-2xs'
                          : 'border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 hover:border-stone-300 hover:text-stone-900'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* =============================================================== */}
            {/* MAIN SOCIAL FEED STREAM                                         */}
            {/* =============================================================== */}
            {filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center shadow-xs space-y-3">
                <MessageSquare className="mx-auto h-9 w-9 text-stone-300" />
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    {scope === 'saved'
                      ? 'No saved posts yet'
                      : scope === 'my_circles'
                        ? 'No activity in your joined Circles yet'
                        : 'No matching community posts found'}
                  </h3>
                  <p className="mt-1 text-xs text-stone-500 max-w-sm mx-auto">
                    {scope === 'saved'
                      ? 'Bookmark public discussions or resources from any Circle to find them easily here.'
                      : 'Explore public communities or start a new discussion to get the conversation going.'}
                  </p>
                </div>
                <div className="flex justify-center gap-2.5 pt-2">
                  {scope !== 'public' && (
                    <button
                      type="button"
                      onClick={() => {
                        setScope('public');
                        setContentType('all');
                        setSelectedCategory('all');
                      }}
                      className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                    >
                      View Public Feed
                    </button>
                  )}
                  <Link
                    href="/explore"
                    className="rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                  >
                    Explore Communities
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredItems.map((item) => {
                  const isMember = isViewerActiveMember(item.circle);
                  const isPending = isViewerPendingMember(item.circle);

                  /* --------------------------------------------------------- */
                  /* A. DISCUSSION POST CARD (WITH POLLS, RESOURCES & REPLIES) */
                  /* --------------------------------------------------------- */
                  if (item.itemType === 'post') {
                    const post = item.data;
                    const { resource, cleanBody } = parsePostContent(post.body);
                    const attachedPoll = post.poll ?? null;
                    const showTitle =
                      !resource &&
                      !attachedPoll &&
                      post.title &&
                      post.title.trim() !== cleanBody.trim().slice(0, post.title.trim().length);

                    const isCommentsOpen = Boolean(expandedCommentPosts[post.id]);
                    const postComments = commentsByPost[post.id] || [];
                    const isLoadingComments = Boolean(loadingCommentsByPost[post.id]);
                    const commentDraft = commentDraftByPost[post.id] || '';
                    const isSubmittingComment = Boolean(submittingCommentByPost[post.id]);

                    return (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-xs transition-all hover:border-stone-300/90"
                      >
                        <div className="p-5 space-y-3.5">
                          {/* Dual-Identity Header: Circle Context + Join Action */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative shrink-0">
                                <Link
                                  href={`/circles/${item.circle.slug}`}
                                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-sm font-bold text-white shadow-2xs hover:bg-zinc-800 transition-colors overflow-hidden"
                                >
                                  {item.circle.avatar_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={item.circle.avatar_url}
                                      alt={item.circle.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    item.circle.name.slice(0, 1).toUpperCase()
                                  )}
                                </Link>
                                {/* Author Avatar Badge */}
                                <div
                                  className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full overflow-hidden border-2 border-white bg-stone-200 flex items-center justify-center shadow-2xs"
                                  title={post.author?.display_name || 'Member'}
                                >
                                  {post.author?.avatar_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={post.author.avatar_url}
                                      alt={post.author.display_name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-[9px] font-bold text-stone-700">
                                      {(post.author?.display_name || 'M').slice(0, 1).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Link
                                    href={`/circles/${item.circle.slug}`}
                                    className="text-sm font-bold text-stone-900 hover:text-black transition-colors truncate"
                                  >
                                    {item.circle.name}
                                  </Link>
                                  <span className="rounded-full bg-[#F4F3EE] px-2 py-0.5 text-[10px] font-medium capitalize text-stone-900">
                                    {item.circle.category.replace('_', ' ')}
                                  </span>
                                  {post.space?.name && (
                                    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-stone-400">
                                      <span>·</span>
                                      <Hash className="h-3 w-3" />
                                      <span>{post.space.name}</span>
                                    </span>
                                  )}
                                </div>

                                {/* Author Sub-line */}
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                                  <span className="inline-flex items-center gap-1.5">
                                    {post.author?.avatar_url ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={post.author.avatar_url}
                                        alt={post.author.display_name}
                                        className="h-3.5 w-3.5 rounded-full object-cover border border-stone-200"
                                      />
                                    ) : null}
                                    <span>
                                      Posted by{' '}
                                      <strong className="font-semibold text-stone-700">
                                        {post.author?.display_name || 'Member'}
                                      </strong>
                                    </span>
                                  </span>
                                  {item.authorRole &&
                                    ['owner', 'admin', 'moderator'].includes(item.authorRole) && (
                                      <span className="rounded bg-stone-100 px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase text-stone-700 border border-stone-200">
                                        {item.authorRole}
                                      </span>
                                    )}
                                  <span>·</span>
                                  <span>{formatRelativeTime(post.created_at)}</span>
                                  {post.is_pinned && (
                                    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-stone-900">
                                      · <Pin className="h-3 w-3" /> Pinned
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Circle Membership Status / 1-Click Join Pill */}
                            <div className="shrink-0">
                              {isMember ? (
                                <Link
                                  href={`/circles/${item.circle.slug}`}
                                  className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-900 border border-stone-200/70 hover:bg-stone-200 transition-colors"
                                >
                                  <Check className="h-3 w-3" />
                                  <span>Joined</span>
                                </Link>
                              ) : isPending ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 border border-amber-200">
                                  <Clock className="h-3 w-3" />
                                  <span>Requested</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={joiningCircleId === item.circle.id}
                                  onClick={() => handleJoinCircle(item.circle)}
                                  className="inline-flex items-center gap-1 rounded-full bg-black px-3 py-1 text-[11px] font-semibold text-white shadow-2xs hover:bg-zinc-800 disabled:opacity-50 transition-all"
                                >
                                  <UserPlus className="h-3 w-3" />
                                  <span>
                                    {joiningCircleId === item.circle.id
                                      ? 'Joining...'
                                      : item.circle.membership_policy === 'approval'
                                        ? 'Request'
                                        : 'Join'}
                                  </span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Post Content Body */}
                          <div className="space-y-2">
                            {showTitle && (
                              <Link
                                href={`/circles/${item.circle.slug}/discussions/${post.id}`}
                                className="block text-base font-bold text-stone-900 hover:text-black transition-colors"
                              >
                                {post.title}
                              </Link>
                            )}

                            {/* Attached Resource Card */}
                            {resource && (
                              <div className="rounded-xl border border-stone-200 bg-[#FAF9F6] p-3.5">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F4F3EE] text-stone-900">
                                      <BookOpen className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-900">
                                        {resource.category}
                                      </span>
                                      <h4 className="text-sm font-bold text-stone-900 truncate">
                                        {resource.title}
                                      </h4>
                                    </div>
                                  </div>
                                  {resource.url && (
                                    <a
                                      href={resource.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
                                    >
                                      <span>Open</span>
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                                {cleanBody && (
                                  <p className="mt-2 whitespace-pre-line text-xs sm:text-sm leading-relaxed text-stone-600">
                                    {cleanBody}
                                  </p>
                                )}
                              </div>
                            )}

                            {!resource && cleanBody && (
                              <p className="whitespace-pre-line text-sm leading-relaxed text-stone-700 break-words">
                                {cleanBody}
                              </p>
                            )}

                            {/* Attached Interactive Poll */}
                            {attachedPoll && (
                              <div className="mt-2 rounded-xl border border-stone-200 bg-[#FAF9F6] p-4 space-y-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-1.5">
                                    <BarChart2 className="h-4 w-4 text-stone-900" />
                                    {attachedPoll.question}
                                  </span>
                                  <span className="text-[11px] font-mono text-stone-500">
                                    {attachedPoll.status === 'closed'
                                      ? 'Closed'
                                      : `${attachedPoll.total_votes || 0} votes`}
                                  </span>
                                </div>

                                <div className="space-y-1.5">
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
                                          !isMember ||
                                          votingOptionId === opt.id
                                        }
                                        onClick={() =>
                                          handleVotePoll(
                                            item.circle.id,
                                            post.id,
                                            attachedPoll.id,
                                            opt.id
                                          )
                                        }
                                        className={`relative w-full overflow-hidden rounded-xl border px-3.5 py-2 text-left text-xs transition-all ${
                                          opt.viewer_voted
                                            ? 'border-stone-900 bg-white font-semibold text-stone-900'
                                            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                                        }`}
                                      >
                                        <div
                                          className="pointer-events-none absolute inset-y-0 left-0 bg-stone-100/60"
                                          style={{ width: `${pct}%` }}
                                        />
                                        <div className="relative flex items-center justify-between gap-2">
                                          <span className="flex items-center gap-1.5">
                                            {opt.viewer_voted && (
                                              <Check className="h-3.5 w-3.5 text-stone-900" />
                                            )}
                                            <span>{opt.label}</span>
                                          </span>
                                          <span className="text-[11px] font-mono text-stone-500">
                                            {pct}%
                                          </span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                                {!isMember && (
                                  <p className="text-[11px] text-stone-400">
                                    Join {item.circle.name} to vote in this poll.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Social Engagement Footer Bar */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
                            <div className="flex items-center gap-1.5">
                              {/* Like Button (Any logged-in user can Like public posts!) */}
                              <button
                                type="button"
                                onClick={() => handleToggleLike(item.circle.id, post.id)}
                                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                                  post.viewer_has_liked
                                    ? 'bg-rose-50 text-rose-600 border-rose-200 shadow-2xs'
                                    : 'border-stone-200 bg-stone-50/80 text-stone-700 shadow-2xs hover:bg-stone-100 hover:border-stone-300 hover:text-stone-900'
                                }`}
                              >
                                <Heart
                                  className={`h-4 w-4 ${
                                    post.viewer_has_liked ? 'fill-rose-500 text-rose-500' : ''
                                  }`}
                                />
                                <span>{post.reaction_count || 0}</span>
                                <span className="hidden sm:inline">Like</span>
                              </button>

                              {/* Inline Expandable Comments Toggle Button */}
                              <button
                                type="button"
                                onClick={() => handleToggleComments(item.circle.id, post.id)}
                                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                                  isCommentsOpen
                                    ? 'border-stone-900 bg-stone-100 text-stone-900 shadow-2xs'
                                    : 'border-stone-200 bg-stone-50/80 text-stone-700 shadow-2xs hover:bg-stone-100 hover:border-stone-300 hover:text-stone-900'
                                }`}
                              >
                                <MessageSquare className="h-4 w-4" />
                                <span>{post.comment_count || 0}</span>
                                <span>
                                  {post.comment_count === 1 ? 'Comment' : 'Comments'}
                                </span>
                              </button>

                              {/* Save / Bookmark Button (Any logged-in user can Save public posts!) */}
                              <button
                                type="button"
                                onClick={() => handleToggleSave(item.circle.id, post.id)}
                                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                                  post.viewer_has_saved
                                    ? 'border-stone-900 bg-stone-100 text-stone-900 shadow-2xs'
                                    : 'border-stone-200 bg-stone-50/80 text-stone-700 shadow-2xs hover:bg-stone-100 hover:border-stone-300 hover:text-stone-900'
                                }`}
                              >
                                <Bookmark
                                  className={`h-4 w-4 ${
                                    post.viewer_has_saved ? 'fill-stone-900 text-stone-900' : ''
                                  }`}
                                />
                                <span className="hidden sm:inline">
                                  {post.viewer_has_saved ? 'Saved' : 'Save'}
                                </span>
                              </button>
                            </div>

                            {/* Share Button */}
                            <button
                              type="button"
                              onClick={() =>
                                handleShareUrl(
                                  item.id,
                                  `/circles/${item.circle.slug}/discussions/${post.id}`
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50/80 px-2.5 py-1.5 text-xs font-medium text-stone-700 shadow-2xs hover:bg-stone-100 hover:border-stone-300 hover:text-stone-900 transition-colors"
                            >
                              {copiedItemId === item.id ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-stone-700" />
                                  <span className="text-stone-900 font-semibold">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Share2 className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Share</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* =================================================== */}
                        {/* INLINE EXPANDABLE COMMENTS SECTION                  */}
                        {/* =================================================== */}
                        {isCommentsOpen && (
                          <div className="border-t border-stone-200/80 bg-[#FAF9F6] px-5 py-4 space-y-3.5">
                            {isLoadingComments ? (
                              <p className="py-3 text-center text-xs text-stone-400">
                                Loading comments...
                              </p>
                            ) : postComments.length === 0 ? (
                              <p className="py-2 text-xs text-stone-500">
                                No comments yet. Be the first to start the conversation!
                              </p>
                            ) : (
                              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                                {postComments.map((comment) => (
                                  <div
                                    key={comment.id}
                                    className="flex items-start gap-2.5 rounded-xl bg-white p-3 border border-stone-200/70"
                                  >
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F4F3EE] text-[11px] font-bold text-stone-900 overflow-hidden border border-stone-200">
                                      {comment.author?.avatar_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={comment.author.avatar_url}
                                          alt={comment.author.display_name}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        (comment.author?.display_name || 'M')
                                          .slice(0, 1)
                                          .toUpperCase()
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-stone-900">
                                          {comment.author?.display_name || 'Member'}
                                        </span>
                                        <span className="text-[10px] text-stone-400">
                                          {formatRelativeTime(comment.created_at)}
                                        </span>
                                      </div>
                                      <p className="mt-1 whitespace-pre-line text-xs text-stone-700 leading-relaxed">
                                        {comment.body}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Inline Reply Input OR Membership Gate Prompt */}
                            {!currentUser ? (
                              <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs">
                                <span className="text-stone-600">
                                  Sign in to join {item.circle.name} and reply to this post.
                                </span>
                                <Link
                                  href="/login"
                                  className="rounded-lg bg-black px-3 py-1.5 font-semibold text-white hover:bg-zinc-800"
                                >
                                  Sign In
                                </Link>
                              </div>
                            ) : isMember ? (
                              <form
                                onSubmit={(e) =>
                                  handleSubmitComment(e, item.circle.id, post.id)
                                }
                                className="flex items-center gap-2"
                              >
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black text-[11px] font-bold text-white overflow-hidden border border-stone-200">
                                  {currentUser.avatar_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={currentUser.avatar_url}
                                      alt={currentUser.display_name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    currentUser.display_name.slice(0, 1).toUpperCase()
                                  )}
                                </div>
                                <input
                                  type="text"
                                  value={commentDraft}
                                  onChange={(e) =>
                                    setCommentDraftByPost((prev) => ({
                                      ...prev,
                                      [post.id]: e.target.value,
                                    }))
                                  }
                                  placeholder={`Write a comment in ${item.circle.name}...`}
                                  className="flex-1 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-black focus:outline-none"
                                />
                                <button
                                  type="submit"
                                  disabled={isSubmittingComment || !commentDraft.trim()}
                                  className="inline-flex items-center gap-1 rounded-xl bg-black px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  <span>Reply</span>
                                </button>
                              </form>
                            ) : (
                              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-100 px-3.5 py-2.5 text-xs">
                                <span className="text-stone-700">
                                  Join <strong>{item.circle.name}</strong> to comment on community
                                  discussions.
                                </span>
                                {isPending ? (
                                  <span className="font-semibold text-amber-800">
                                    Join Request Pending
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={joiningCircleId === item.circle.id}
                                    onClick={() => handleJoinCircle(item.circle)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-black px-3 py-1.5 font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                                  >
                                    <UserPlus className="h-3.5 w-3.5" />
                                    <span>
                                      {item.circle.membership_policy === 'approval'
                                        ? 'Request to Join'
                                        : 'Join & Comment'}
                                    </span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  }

                  /* --------------------------------------------------------- */
                  /* B. COMMUNITY EVENT CARD IN FEED                           */
                  /* --------------------------------------------------------- */
                  if (item.itemType === 'event') {
                    const ev = item.data;
                    const startDate = new Date(ev.starts_at);
                    const isGoing = ev.viewer_rsvp_status === 'going';
                    const channelLabel = getEventChannelLabel(ev);
                    const isRsvpLoading = Boolean(rsvpLoadingByEvent[ev.id]);

                    return (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs transition-all hover:border-stone-300/90 space-y-3.5"
                      >
                        {/* Circle Header */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Link
                              href={`/circles/${item.circle.slug}`}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-xs font-bold text-white shadow-2xs overflow-hidden"
                            >
                              {item.circle.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.circle.avatar_url}
                                  alt={item.circle.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                item.circle.name.slice(0, 1).toUpperCase()
                              )}
                            </Link>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={`/circles/${item.circle.slug}`}
                                  className="text-xs sm:text-sm font-bold text-stone-900 hover:text-black truncate"
                                >
                                  {item.circle.name}
                                </Link>
                                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-bold text-stone-900 border border-stone-200">
                                  EVENT
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                                <span>Hosted by</span>
                                {(ev.host?.avatar_url || ev.organizer?.avatar_url) ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={ev.host?.avatar_url || ev.organizer?.avatar_url || ''}
                                    alt={ev.host?.display_name || ev.organizer?.display_name || 'Host'}
                                    className="h-3.5 w-3.5 rounded-full object-cover border border-stone-200"
                                  />
                                ) : null}
                                <span className="font-semibold text-stone-700">
                                  {ev.host?.display_name || ev.organizer?.display_name || 'Host'}
                                </span>
                                <span>·</span>
                                <span>{formatRelativeTime(ev.created_at)}</span>
                              </div>
                            </div>
                          </div>

                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-sky-800 border border-sky-200">
                            {ev.location_type === 'in_person' ? (
                              <MapPin className="h-3 w-3 text-amber-600" />
                            ) : (
                              <Video className="h-3 w-3 text-sky-600" />
                            )}
                            {channelLabel}
                          </span>
                        </div>

                        {/* Event Cover Image if provided */}
                        {ev.cover_image_url && (
                          <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-100 aspect-[21/9] max-h-56 w-full">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={ev.cover_image_url}
                              alt={ev.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}

                        {/* Event Card Body */}
                        <div className="flex items-start gap-4 rounded-xl border border-stone-200/80 bg-[#FAF9F6] p-4">
                          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xs">
                            <span className="w-full bg-black py-0.5 text-center text-[9px] font-mono font-bold uppercase text-white">
                              {startDate.toLocaleDateString([], { month: 'short' })}
                            </span>
                            <span className="py-1 text-lg font-extrabold text-stone-900 leading-none">
                              {startDate.getDate()}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1 space-y-1">
                            <Link
                              href={`/circles/${item.circle.slug}/events`}
                              className="block text-sm sm:text-base font-bold text-stone-900 hover:text-black"
                            >
                              {ev.title}
                            </Link>
                            <p className="text-xs text-stone-500">
                              {startDate.toLocaleDateString([], {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}{' '}
                              ·{' '}
                              {startDate.toLocaleTimeString([], {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}{' '}
                              ({ev.timezone || 'UTC'})
                            </p>
                            {ev.description && (
                              <p className="line-clamp-2 text-xs text-stone-600 pt-0.5">
                                {ev.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Event Footer */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600">
                            <Users className="h-3.5 w-3.5 text-stone-400" />
                            {ev.going_count || 0} attending
                          </span>

                          <div className="flex items-center gap-2">
                            {isMember ? (
                              <button
                                type="button"
                                disabled={isRsvpLoading}
                                onClick={() =>
                                  handleEventRsvp(
                                    item.circle.id,
                                    ev.id,
                                    isGoing ? 'cancel' : 'register'
                                  )
                                }
                                className={`inline-flex items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                                  isGoing
                                    ? 'bg-stone-100 text-stone-900 border border-stone-300'
                                    : 'bg-black text-white hover:bg-zinc-800'
                                }`}
                              >
                                {isGoing && <CheckCircle2 className="h-3.5 w-3.5" />}
                                <span>{isGoing ? 'Going' : 'RSVP'}</span>
                              </button>
                            ) : (
                              <Link
                                href={`/circles/${item.circle.slug}/events`}
                                className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                              >
                                <span>View Event</span>
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  }

                  /* --------------------------------------------------------- */
                  /* C. MARKETPLACE LISTING CARD IN FEED                       */
                  /* --------------------------------------------------------- */
                  if (item.itemType === 'listing') {
                    const listing = item.data;
                    const priceText = formatListingPrice(listing);

                    return (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs transition-all hover:border-stone-300/90 space-y-3.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Link
                              href={`/circles/${item.circle.slug}`}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-xs font-bold text-white shadow-2xs overflow-hidden"
                            >
                              {item.circle.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.circle.avatar_url}
                                  alt={item.circle.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                item.circle.name.slice(0, 1).toUpperCase()
                              )}
                            </Link>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={`/circles/${item.circle.slug}`}
                                  className="text-xs sm:text-sm font-bold text-stone-900 hover:text-black truncate"
                                >
                                  {item.circle.name}
                                </Link>
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-amber-800 border border-amber-200">
                                  {listing.listing_type || 'Listing'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                                <span>Listed by</span>
                                {listing.seller?.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={listing.seller.avatar_url}
                                    alt={listing.seller.display_name}
                                    className="h-3.5 w-3.5 rounded-full object-cover border border-stone-200"
                                  />
                                ) : null}
                                <span className="font-semibold text-stone-700">
                                  {listing.seller?.display_name || 'Member'}
                                </span>
                                <span>·</span>
                                <span>{formatRelativeTime(listing.created_at)}</span>
                              </div>
                            </div>
                          </div>

                          <span className="rounded-xl bg-[#F4F3EE] px-3 py-1 text-xs sm:text-sm font-extrabold text-stone-900">
                            {priceText}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 rounded-xl border border-stone-200/80 bg-[#FAF9F6] p-3.5">
                          {listing.image_urls && listing.image_urls[0] && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={listing.image_urls[0]}
                              alt={listing.title}
                              className="h-32 sm:h-24 sm:w-32 rounded-lg object-cover shrink-0"
                            />
                          )}
                          <div className="min-w-0 flex-1 space-y-1">
                            <Link
                              href={`/circles/${item.circle.slug}/marketplace/${listing.id}`}
                              className="block text-sm sm:text-base font-bold text-stone-900 hover:text-black"
                            >
                              {listing.title}
                            </Link>
                            {listing.description && (
                              <p className="line-clamp-2 text-xs text-stone-600 leading-relaxed">
                                {listing.description}
                              </p>
                            )}
                            {listing.location && (
                              <p className="inline-flex items-center gap-1 text-[11px] text-stone-500 pt-1">
                                <MapPin className="h-3 w-3" />
                                {listing.location}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="inline-flex items-center gap-1 text-xs text-stone-500 capitalize">
                            <Tag className="h-3.5 w-3.5 text-stone-400" />
                            {listing.category}
                          </span>
                          <Link
                            href={`/circles/${item.circle.slug}/marketplace/${listing.id}`}
                            className="inline-flex items-center gap-1 rounded-xl bg-black px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
                          >
                            <ShoppingBag className="h-3.5 w-3.5" />
                            <span>View Listing</span>
                          </Link>
                        </div>
                      </article>
                    );
                  }

                  /* --------------------------------------------------------- */
                  /* D. COMMUNITY COURSE CARD IN GLOBAL FEED                   */
                  /* --------------------------------------------------------- */
                  if (item.itemType === 'course') {
                    const course = item.data;
                    const isPaid = course.access_rule === 'paywall';
                    const totalLessons = course.total_lessons_count ?? 0;
                    const duration = course.estimated_duration_hours ? `~${course.estimated_duration_hours}h` : null;
                    const difficulty = course.difficulty_level ? course.difficulty_level.replace('_', ' ') : 'All levels';

                    return (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs transition-all hover:border-stone-300/90 space-y-3.5"
                      >
                        {/* Circle Header */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Link
                              href={`/circles/${item.circle.slug}`}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-xs font-bold text-white shadow-2xs overflow-hidden"
                            >
                              {item.circle.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.circle.avatar_url}
                                  alt={item.circle.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                item.circle.name.slice(0, 1).toUpperCase()
                              )}
                            </Link>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={`/circles/${item.circle.slug}`}
                                  className="text-xs sm:text-sm font-bold text-stone-900 hover:text-black truncate"
                                >
                                  {item.circle.name}
                                </Link>
                                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-stone-900 border border-stone-200">
                                  Course
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                                <span>By</span>
                                {course.instructor?.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={course.instructor.avatar_url}
                                    alt={course.instructor.display_name}
                                    className="h-3.5 w-3.5 rounded-full object-cover border border-stone-200"
                                  />
                                ) : null}
                                <span className="font-semibold text-stone-700">
                                  {course.instructor?.display_name || 'Instructor'}
                                </span>
                                <span>·</span>
                                <span>{formatRelativeTime(item.timestamp)}</span>
                              </div>
                            </div>
                          </div>

                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-mono font-semibold border ${
                            isPaid
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-stone-50 text-stone-700 border-stone-200'
                          }`}>
                            {isPaid ? 'PAID ACCESS' : 'OPEN ENROLLMENT'}
                          </span>
                        </div>

                        {/* Course Body */}
                        <div className="flex flex-col sm:flex-row gap-4 rounded-xl border border-stone-200/80 bg-[#FAF9F6] p-3.5">
                          {course.thumbnail_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={course.thumbnail_url}
                              alt={course.title}
                              className="h-32 sm:h-24 sm:w-36 rounded-lg object-cover shrink-0 border border-stone-200"
                            />
                          )}
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <Link
                              href={`/circles/${item.circle.slug}/courses/${course.id}`}
                              className="block text-sm sm:text-base font-bold text-stone-900 hover:text-black"
                            >
                              {course.title}
                            </Link>
                            {course.description && (
                              <p className="line-clamp-2 text-xs text-stone-600 leading-relaxed">
                                {course.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-stone-500 font-medium">
                              <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 border border-stone-200">
                                <BookOpen className="h-3 w-3 text-stone-600" />
                                {totalLessons} {totalLessons === 1 ? 'lesson' : 'lessons'}
                              </span>
                              {duration && (
                                <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 border border-stone-200">
                                  <Clock className="h-3 w-3 text-stone-600" />
                                  {duration}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 border border-stone-200 capitalize">
                                <GraduationCap className="h-3 w-3 text-stone-600" />
                                {difficulty}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
                          <Link
                            href={`/circles/${item.circle.slug}/courses`}
                            className="text-xs text-stone-500 hover:text-stone-900 font-medium flex items-center gap-1"
                          >
                            <span>More courses in {item.circle.name}</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                          <Link
                            href={`/circles/${item.circle.slug}/courses/${course.id}`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-stone-800 transition-colors"
                          >
                            <Play className="h-3.5 w-3.5 fill-current" />
                            <span>View Curriculum</span>
                          </Link>
                        </div>
                      </article>
                    );
                  }

                  /* --------------------------------------------------------- */
                  /* E. LEARNING RESOURCE & GUIDE CARD IN GLOBAL FEED          */
                  /* --------------------------------------------------------- */
                  if (item.itemType === 'resource') {
                    const res = item.data;
                    return (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs transition-all hover:border-stone-300/90 space-y-3.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Link
                              href={`/circles/${item.circle.slug}`}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-xs font-bold text-white shadow-2xs overflow-hidden"
                            >
                              {item.circle.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.circle.avatar_url}
                                  alt={item.circle.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                item.circle.name.slice(0, 1).toUpperCase()
                              )}
                            </Link>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={`/circles/${item.circle.slug}`}
                                  className="text-xs sm:text-sm font-bold text-stone-900 hover:text-black truncate"
                                >
                                  {item.circle.name}
                                </Link>
                                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-stone-900 border border-stone-200">
                                  {res.category || 'Guide'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                                <span>Published by</span>
                                {res.author?.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={res.author.avatar_url}
                                    alt={res.author.display_name}
                                    className="h-3.5 w-3.5 rounded-full object-cover border border-stone-200"
                                  />
                                ) : null}
                                <span className="font-semibold text-stone-700">
                                  {res.author?.display_name || 'Member'}
                                </span>
                                <span>·</span>
                                <span>{formatRelativeTime(item.timestamp)}</span>
                              </div>
                            </div>
                          </div>

                          {res.difficulty_level && (
                            <span className="rounded-full bg-stone-50 px-2 py-0.5 text-[10px] font-mono font-bold capitalize text-stone-700 border border-stone-200">
                              {res.difficulty_level}
                            </span>
                          )}
                        </div>

                        <div className="rounded-xl border border-stone-200/80 bg-[#FAF9F6] p-3.5 space-y-1.5">
                          <Link
                            href={`/circles/${item.circle.slug}/resources`}
                            className="block text-sm sm:text-base font-bold text-stone-900 hover:text-black"
                          >
                            {res.title}
                          </Link>
                          {res.summary && (
                            <p className="line-clamp-2 text-xs text-stone-600 leading-relaxed">
                              {res.summary}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <Link
                            href={`/circles/${item.circle.slug}/resources`}
                            className="text-xs text-stone-500 hover:text-stone-900 font-medium flex items-center gap-1"
                          >
                            <span>Browse resources</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                          <Link
                            href={`/circles/${item.circle.slug}/resources`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-stone-800 transition-colors"
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>Read Guide</span>
                          </Link>
                        </div>
                      </article>
                    );
                  }

                  /* --------------------------------------------------------- */
                  /* F. COMMUNITY CAUSE / FUNDRAISER CARD IN GLOBAL FEED       */
                  /* --------------------------------------------------------- */
                  if (item.itemType === 'cause') {
                    const cause = item.data;
                    const pledgedTotal = cause.pledged_total ?? 0;
                    const pledgeCount = cause.pledge_count ?? 0;
                    const pct =
                      cause.goal_amount > 0
                        ? Math.min(100, Math.round((pledgedTotal / cause.goal_amount) * 100))
                        : 0;

                    return (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs transition-all hover:border-stone-300/90 space-y-3.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Link
                              href={`/circles/${item.circle.slug}`}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-xs font-bold text-white shadow-2xs overflow-hidden"
                            >
                              {item.circle.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.circle.avatar_url}
                                  alt={item.circle.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                item.circle.name.slice(0, 1).toUpperCase()
                              )}
                            </Link>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={`/circles/${item.circle.slug}`}
                                  className="text-xs sm:text-sm font-bold text-stone-900 hover:text-black truncate"
                                >
                                  {item.circle.name}
                                </Link>
                                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-stone-900 border border-stone-200">
                                  Cause
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-500">
                                Community Campaign · {formatRelativeTime(item.timestamp)}
                              </p>
                            </div>
                          </div>

                          <span className="rounded-xl bg-[#F4F3EE] px-3 py-1 text-xs sm:text-sm font-extrabold text-stone-900">
                            {cause.currency} {pledgedTotal.toLocaleString()}
                          </span>
                        </div>

                        <div className="rounded-xl border border-stone-200/80 bg-[#FAF9F6] p-3.5 space-y-2">
                          <Link
                            href={`/circles/${item.circle.slug}/community`}
                            className="block text-sm sm:text-base font-bold text-stone-900 hover:text-black"
                          >
                            {cause.title}
                          </Link>
                          {cause.description && (
                            <p className="line-clamp-2 text-xs text-stone-600 leading-relaxed">
                              {cause.description}
                            </p>
                          )}
                          <div className="space-y-1 pt-1">
                            <div className="flex justify-between text-[11px] text-stone-500 font-mono">
                              <span>Goal: {cause.currency} {cause.goal_amount.toLocaleString()}</span>
                              <span>{pct}% funded</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-stone-200 overflow-hidden">
                              <div className="h-full bg-black rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-stone-500 font-medium">
                            {pledgeCount} {pledgeCount === 1 ? 'supporter' : 'supporters'}
                          </span>
                          <Link
                            href={`/circles/${item.circle.slug}/community`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-stone-800 transition-colors"
                          >
                            <HeartHandshake className="h-3.5 w-3.5" />
                            <span>Support Cause</span>
                          </Link>
                        </div>
                      </article>
                    );
                  }

                  return null;
                })}
              </div>
            )}
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* RIGHT SIDEBAR: Trending Public Circles & Upcoming Events (3 cols) */}
          {/* ----------------------------------------------------------------- */}
          <aside className="space-y-5 lg:col-span-3">
            {/* Trending Public Communities to Join */}
            <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500">
                  Discover Public Circles
                </h2>
                <Link
                  href="/explore"
                  className="text-xs font-semibold text-stone-900 hover:underline"
                >
                  See all
                </Link>
              </div>

              <div className="space-y-3">
                {trendingCircles.slice(0, 5).map((circle) => {
                  const isMember =
                    joinedCircleMap[circle.id] === 'active' ||
                    circle.current_user_membership_status === 'active' ||
                    Boolean(circle.current_user_role);
                  const isPending =
                    joinedCircleMap[circle.id] === 'pending' ||
                    circle.current_user_join_request_status === 'pending';

                  return (
                    <div
                      key={circle.id}
                      className="flex items-start justify-between gap-2.5 rounded-xl border border-stone-100 bg-[#FAF9F6] p-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <Link
                          href={`/circles/${circle.slug}`}
                          className="block text-xs font-bold text-stone-900 hover:text-black truncate"
                        >
                          {circle.name}
                        </Link>
                        <p className="line-clamp-1 text-[11px] text-stone-500">
                          {circle.description}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-stone-400">
                          <span className="inline-flex items-center gap-1 font-medium text-stone-600">
                            <Users className="h-3 w-3" />
                            {circle.member_count ?? 1}
                          </span>
                          <span>·</span>
                          <span className="capitalize">{circle.category.replace('_', ' ')}</span>
                        </div>
                      </div>

                      {isMember ? (
                        <Link
                          href={`/circles/${circle.slug}`}
                          className="shrink-0 rounded-lg bg-stone-200/70 px-2.5 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-200"
                        >
                          Open
                        </Link>
                      ) : isPending ? (
                        <span className="shrink-0 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800 border border-amber-200">
                          Pending
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={joiningCircleId === circle.id}
                          onClick={() => handleJoinCircle(circle)}
                          className="shrink-0 rounded-lg bg-black px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                        >
                          {circle.membership_policy === 'approval' ? (
                            <span className="inline-flex items-center gap-1">
                              <Lock className="h-2.5 w-2.5" />
                              Apply
                            </span>
                          ) : (
                            'Join'
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upcoming Public Events Rail */}
            {upcomingEvents.length > 0 && (
              <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-stone-900" />
                    Upcoming Events
                  </h2>
                </div>

                <div className="space-y-2.5">
                  {upcomingEvents.slice(0, 4).map((ev) => {
                    const d = new Date(ev.starts_at);
                    return (
                      <Link
                        key={ev.id}
                        href={`/circles/${ev.circle.slug}/events`}
                        className="group flex items-start gap-3 rounded-xl p-2 hover:bg-stone-50 transition-colors"
                      >
                        {ev.cover_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ev.cover_image_url}
                            alt={ev.title}
                            className="h-10 w-10 shrink-0 rounded-lg object-cover border border-stone-200"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-[#F4F3EE] text-stone-900">
                            <span className="text-[9px] font-mono font-bold uppercase leading-none">
                              {d.toLocaleDateString([], { month: 'short' })}
                            </span>
                            <span className="mt-0.5 text-sm font-extrabold leading-none">
                              {d.getDate()}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-stone-900 group-hover:text-black">
                            {ev.title}
                          </p>
                          <p className="truncate text-[11px] text-stone-500">
                            {ev.circle.name}
                          </p>
                          <p className="text-[10px] text-stone-400">
                            {d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} ·{' '}
                            {getEventChannelLabel(ev)}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Start Your Own Circle CTA Card */}
            <div className="rounded-2xl border border-stone-200/90 bg-gradient-to-br from-zinc-900 to-black p-5 text-white shadow-xs space-y-3">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
                <PlusCircle className="h-4 w-4 text-zinc-300" />
              </div>
              <h3 className="text-sm font-bold">Launch Your Own Circle</h3>
              <p className="text-xs text-stone-200/90 leading-relaxed">
                Create a public or private community with customizable discussions, events, courses,
                and marketplace spaces.
              </p>
              <Link
                href={currentUser ? '/circles/new' : '/register'}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-white py-2 text-xs font-bold text-stone-900 hover:bg-stone-100 transition-colors"
              >
                <span>{currentUser ? 'Create a Circle' : 'Get Started Free'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
