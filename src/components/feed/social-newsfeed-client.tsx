'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BarChart2,
  Bell,
  Bookmark,
  BookOpen,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Compass,
  ExternalLink,
  FileText,
  Flame,
  Heart,
  HeartHandshake,
  Home,
  Image as ImageIcon,
  LogOut,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  PanelLeft,
  Pin,
  Play,
  Plus,
  Search,
  Send,
  Settings,
  Share2,
  ShoppingBag,
  Sparkles,
  Sun,
  Tag,
  ThumbsUp,
  User,
  UserPlus,
  Users,
  Video,
  X,
  Globe,
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
  unreadNotificationsCount?: number;
  unreadMessagesCount?: number;
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

const CAPABILITY_TILES = [
  {
    key: 'communities',
    label: 'Communities',
    subtitle: 'Join & belong',
    icon: Users,
    href: '/explore',
  },
  {
    key: 'events',
    label: 'Events',
    subtitle: 'Discover activities',
    icon: Calendar,
    filter: 'events' as const,
  },
  {
    key: 'marketplace',
    label: 'Marketplace',
    subtitle: 'Buy, sell & more',
    icon: ShoppingBag,
    filter: 'marketplace' as const,
  },
  {
    key: 'learning',
    label: 'Learning',
    subtitle: 'Grow your skills',
    icon: BookOpen,
    filter: 'courses' as const,
  },
  {
    key: 'jobs',
    label: 'Jobs',
    subtitle: 'Find opportunities',
    icon: Briefcase,
    href: '/explore?category=professional',
  },
];

function renderTextWithHashtags(
  text: string,
  onHashtagClick?: (tag: string) => void
): React.ReactNode {
  if (!text) return null;
  const parts = text.split(/(#[a-zA-Z0-9_]+)/g);
  return parts.map((part, index) => {
    if (part.startsWith('#')) {
      return (
        <span
          key={index}
          onClick={(e) => {
            if (onHashtagClick) {
              e.stopPropagation();
              onHashtagClick(part.slice(1));
            }
          }}
          className="text-purple-600 font-semibold hover:underline cursor-pointer transition-colors"
        >
          {part}
        </span>
      );
    }
    return part;
  });
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

function extractMediaUrls(body: string): string[] {
  if (!body) return [];
  const urls: string[] = [];
  const mdRegex = /!\[.*?\]\(((\/api\/uploads\/[^\s)]+)|(https?:\/\/[^\s)]+))\)/g;
  let match: RegExpExecArray | null;
  while ((match = mdRegex.exec(body)) !== null) {
    const url = match[1];
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

function stripImageMarkdown(text: string): string {
  if (!text) return '';
  return text.replace(/!\[.*?\]\(((\/api\/uploads\/[^\s)]+)|(https?:\/\/[^\s)]+))\)/g, '').trim();
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
  unreadNotificationsCount = 0,
  unreadMessagesCount = 0,
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

  // Extract real trending hashtags dynamically from active posts or real categories
  const trendingHashtags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (item.itemType === 'post') {
        const text = `${item.data.title || ''} ${item.data.body || ''}`;
        const found = text.match(/#[a-zA-Z0-9_]+/g);
        if (found) {
          for (const t of found) {
            const clean = t.toLowerCase();
            counts.set(t, (counts.get(clean) || 0) + 1);
          }
        }
      }
    }
    const realTags = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);

    if (realTags.length > 0) {
      return realTags.slice(0, 6);
    }
    return CATEGORIES.filter((c) => c.key !== 'all')
      .map((c) => `#${c.label.replace(/\s+/g, '')}`)
      .slice(0, 6);
  }, [items]);

  // Hero Welcome Banner & User Menu
  const [showHeroBanner, setShowHeroBanner] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('circles_hero_banner_dismissed') === 'true') {
        setShowHeroBanner(false);
      }
    } catch {
      // Ignore
    }
  }, []);

  function dismissHeroBanner() {
    setShowHeroBanner(false);
    try {
      localStorage.setItem('circles_hero_banner_dismissed', 'true');
    } catch {
      // Ignore
    }
  }

  async function handleSignOut() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      // Ignore
    }
  }

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
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);

  useEffect(() => {
    function handleGlobalClick() {
      if (activeMenuPostId) setActiveMenuPostId(null);
    }
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [activeMenuPostId]);

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
    <div className="min-h-screen bg-[#F8F9FA] text-stone-900 flex">
      {/* ------------------------------------------------------------- */}
      {/* MOBILE DRAWER BACKDROP                                        */}
      {/* ------------------------------------------------------------- */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. DOCKED LEFT SIDEBAR NAVIGATION (Fixed/Sticky on Desktop)   */}
      {/* ------------------------------------------------------------- */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col justify-between border-r border-stone-200/90 bg-white transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 w-64 shrink-0 shadow-sm lg:shadow-none ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white shadow-2xs group-hover:scale-105 transition-transform">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white">
                  <span className="h-2 w-2 rounded-full bg-white" />
                </span>
              </div>
              <span className="text-xl font-extrabold tracking-tight text-stone-900">
                Circles
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="lg:hidden rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <div className="flex-1 overflow-y-auto px-3.5 py-2 space-y-6 no-scrollbar">
          {/* Main Navigation List */}
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => {
                setScope('public');
                setContentType('all');
                setSelectedCategory('all');
                setSearchQuery('');
                setIsMobileSidebarOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${
                scope === 'public' && contentType === 'all' && selectedCategory === 'all' && !searchQuery
                  ? 'bg-black text-white shadow-xs'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Home className="h-4 w-4" />
                <span>Home</span>
              </div>
            </button>

            <Link
              href="/explore"
              className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Compass className="h-4 w-4 text-stone-500" />
                <span>Explore</span>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => {
                setScope('my_circles');
                setContentType('all');
                setIsMobileSidebarOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                scope === 'my_circles'
                  ? 'bg-black text-white shadow-xs font-bold'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-stone-500" />
                <span>Communities</span>
              </div>
              {myCircles.length > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                    scope === 'my_circles'
                      ? 'bg-white/20 text-white'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {myCircles.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setContentType(contentType === 'events' ? 'all' : 'events');
                setIsMobileSidebarOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                contentType === 'events'
                  ? 'bg-stone-100 text-stone-900 font-bold'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-stone-500" />
                <span>Events</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setContentType(contentType === 'marketplace' ? 'all' : 'marketplace');
                setIsMobileSidebarOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                contentType === 'marketplace'
                  ? 'bg-stone-100 text-stone-900 font-bold'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShoppingBag className="h-4 w-4 text-stone-500" />
                <span>Marketplace</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setContentType(contentType === 'courses' ? 'all' : 'courses');
                setIsMobileSidebarOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                contentType === 'courses'
                  ? 'bg-stone-100 text-stone-900 font-bold'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <BookOpen className="h-4 w-4 text-stone-500" />
                <span>Learning</span>
              </div>
            </button>

            <Link
              href="/explore?category=professional"
              className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Briefcase className="h-4 w-4 text-stone-500" />
                <span>Jobs</span>
              </div>
            </Link>

            {currentUser && (
              <Link
                href="/notifications"
                className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-stone-500" />
                  <span>Notifications</span>
                </div>
                {unreadNotificationsCount > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-2xs">
                    {unreadNotificationsCount}
                  </span>
                )}
              </Link>
            )}

            {currentUser && (
              <Link
                href="/circles"
                className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-4 w-4 text-stone-500" />
                  <span>Messages</span>
                </div>
                {unreadMessagesCount > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-2xs">
                    {unreadMessagesCount}
                  </span>
                )}
              </Link>
            )}
          </nav>

          {/* Action: + Create a Circle */}
          <div className="pt-1">
            <Link
              href={currentUser ? '/circles/new' : '/register'}
              className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 py-2.5 text-xs font-bold text-stone-900 shadow-2xs transition-all hover:border-black"
            >
              <Plus className="h-4 w-4" />
              <span>Create a Circle</span>
            </Link>
          </div>

          {/* Sidebar Promo Box (Matching Reference Layout) */}
          <div className="rounded-2xl border border-stone-200/90 bg-[#F4F3EE] p-4 text-stone-900 space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <h4 className="text-xs font-bold leading-snug">
              Build your own community!
            </h4>
            <p className="text-[11px] text-stone-600 leading-tight">
              Create, customise and grow your circle.
            </p>
            <Link
              href={currentUser ? '/circles/new' : '/register'}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-900 hover:underline pt-1"
            >
              <span>Get Started</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Sidebar Footer: User Account Switcher */}
        <div className="border-t border-stone-200/90 p-3">
          {currentUser ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-xl p-2 text-left hover:bg-stone-100 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white overflow-hidden border border-stone-200">
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
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-xs font-bold text-stone-900">
                      {currentUser.display_name}
                    </p>
                    <p className="truncate text-[11px] text-stone-400">
                      @{currentUser.username}
                    </p>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-stone-400 shrink-0" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-full rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 space-y-0.5">
                  <Link
                    href="/settings"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>My Profile</span>
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span>Account Settings</span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Link
                href="/login"
                className="flex w-full items-center justify-center rounded-xl bg-black py-2 text-xs font-bold text-white hover:bg-zinc-800 transition-colors shadow-2xs"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="flex w-full items-center justify-center rounded-xl border border-stone-200 bg-stone-50 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100 transition-colors"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* 2. MAIN DASHBOARD CONTENT AREA                                */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Search & Actions Header */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-6 lg:px-8 py-3">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            {/* Mobile Hamburger Drawer Trigger */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden rounded-xl p-2 text-stone-600 hover:bg-stone-100"
              aria-label="Open navigation menu"
            >
              <PanelLeft className="h-5 w-5" />
            </button>

            {/* Global Search Pill Bar (Matching Reference Layout) */}
            <div className="relative flex-1 max-w-2xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for people, communities and more..."
                className="w-full rounded-full border border-stone-200 bg-stone-50/90 py-2.5 pl-11 pr-4 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:bg-white focus:outline-none transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-stone-400 hover:text-stone-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              {currentUser && (
                <Link
                  href="/notifications"
                  className="relative flex h-10 w-10 items-center justify-center rounded-full bg-stone-50 border border-stone-200 text-stone-700 hover:bg-stone-100 transition-colors shadow-2xs"
                  title="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-2xs">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </Link>
              )}

              {/* Theme Sun Indicator */}
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-50 border border-stone-200 text-stone-600 shadow-2xs"
                title="Theme: Clean Light"
              >
                <Sun className="h-4 w-4" />
              </div>

              {/* Profile Avatar Trigger */}
              {currentUser ? (
                <Link
                  href="/settings"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white border-2 border-white shadow-2xs overflow-hidden"
                  title={currentUser.display_name}
                >
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
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="rounded-full bg-black px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800 transition-colors shadow-2xs"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Main Dashboard Space */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-7xl mx-auto w-full">
          {/* A. HERO WELCOME BANNER ("Bring Your People Together.") */}
          {showHeroBanner && (
            <section className="relative overflow-hidden rounded-3xl border border-stone-200/90 bg-gradient-to-r from-stone-50 via-white to-stone-50/80 shadow-xs">
              <button
                type="button"
                onClick={dismissHeroBanner}
                className="absolute top-4 right-4 z-10 rounded-full p-1.5 text-stone-400 hover:bg-stone-200/60 hover:text-stone-700 transition-colors"
                title="Dismiss banner"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
                {/* Banner Left: Typography & CTAs */}
                <div className="p-6 sm:p-8 lg:p-10 lg:col-span-7 space-y-4">
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-stone-950 leading-[1.1]">
                    Bring Your People <br className="hidden sm:inline" />
                    Together<span className="text-stone-400">.</span>
                  </h1>
                  <p className="text-xs sm:text-sm text-stone-600 max-w-lg leading-relaxed">
                    Discover, join and build communities around the things that matter to you.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Link
                      href="/explore"
                      className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-zinc-800 transition-all"
                    >
                      <span>Explore Communities</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href={currentUser ? '/circles/new' : '/register'}
                      className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-stone-900 shadow-2xs hover:bg-stone-50 hover:border-black transition-all"
                    >
                      <span>Create Your Circle</span>
                    </Link>
                  </div>
                </div>

                {/* Banner Right: Community Collaboration Graphic */}
                <div className="relative lg:col-span-5 h-56 sm:h-72 lg:h-full flex items-center justify-end overflow-hidden pr-0 lg:pr-6">
                  <div className="relative w-full h-full max-h-72 rounded-2xl overflow-hidden shadow-2xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=900&q=80"
                      alt="Community collaboration"
                      className="h-full w-full object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-stone-50/70 via-transparent to-transparent lg:block hidden" />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* B. FIVE HORIZONTAL QUICK-JUMP CAPABILITY TILES */}
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {CAPABILITY_TILES.map((tile) => {
              const Icon = tile.icon;
              const isFiltered = 'filter' in tile && contentType === tile.filter;

              if ('href' in tile && tile.href) {
                return (
                  <Link
                    key={tile.key}
                    href={tile.href}
                    className="flex items-center justify-between rounded-2xl border border-stone-200/90 bg-white p-3.5 shadow-2xs hover:border-stone-400 hover:shadow-xs transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-900 border border-stone-200 group-hover:scale-105 transition-transform">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 leading-tight">
                        <h4 className="text-xs font-bold text-stone-900 truncate">
                          {tile.label}
                        </h4>
                        <p className="text-[11px] text-stone-400 truncate">
                          {tile.subtitle}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </Link>
                );
              }

              return (
                <button
                  key={tile.key}
                  type="button"
                  onClick={() => {
                    if ('filter' in tile && tile.filter) {
                      setContentType(tile.filter);
                    }
                  }}
                  className={`flex items-center justify-between rounded-2xl border p-3.5 shadow-2xs text-left transition-all group ${
                    isFiltered
                      ? 'border-black bg-stone-900 text-white shadow-xs'
                      : 'border-stone-200/90 bg-white hover:border-stone-400 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border group-hover:scale-105 transition-transform ${
                        isFiltered
                          ? 'bg-stone-800 text-white border-stone-700'
                          : 'bg-stone-100 text-stone-900 border border-stone-200'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 leading-tight">
                      <h4
                        className={`text-xs font-bold truncate ${
                          isFiltered ? 'text-white' : 'text-stone-900'
                        }`}
                      >
                        {tile.label}
                      </h4>
                      <p
                        className={`text-[11px] truncate ${
                          isFiltered ? 'text-stone-300' : 'text-stone-400'
                        }`}
                      >
                        {tile.subtitle}
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    className={`h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform shrink-0 ${
                      isFiltered ? 'text-stone-300' : 'text-stone-400'
                    }`}
                  />
                </button>
              );
            })}
          </section>

          {/* C. THREE-COLUMN FEED AREA */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* SUB-COLUMN 1: Top Communities & 10X Faster Promo */}
            <div className="lg:col-span-3 space-y-5 order-2 lg:order-1">
              {/* Top Communities Card */}
              <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-stone-900">
                    Top Communities
                  </h2>
                  <Link
                    href="/explore"
                    className="text-xs font-semibold text-purple-600 hover:underline flex items-center gap-0.5"
                  >
                    <span>See all</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="space-y-3">
                  {trendingCircles.length === 0 ? (
                    <p className="text-xs text-stone-500 py-3 text-center">No public communities yet.</p>
                  ) : (
                    trendingCircles.slice(0, 5).map((circle) => {
                      const isMember = isViewerActiveMember(circle as unknown as FeedCircleContext);
                      const isPending = isViewerPendingMember(circle as unknown as FeedCircleContext);
                      const count = circle.member_count ?? 0;

                      return (
                        <div key={circle.id} className="flex items-center justify-between gap-2.5">
                          <Link
                            href={`/circles/${circle.slug}`}
                            className="flex items-center gap-2.5 min-w-0 flex-1 group"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-900 border border-stone-200 overflow-hidden shadow-2xs">
                              {circle.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={circle.avatar_url}
                                  alt={circle.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                circle.name.slice(0, 1).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-stone-900 group-hover:underline leading-tight">
                                {circle.name}
                              </p>
                              <p className="text-[11px] text-stone-400 leading-tight">
                                {count >= 1000
                                  ? `${(count / 1000).toFixed(1)}k members`
                                  : `${count} members`}
                              </p>
                            </div>
                          </Link>

                        {isMember ? (
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-stone-600 text-xs font-bold">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        ) : isPending ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                            Pending
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={joiningCircleId === circle.id}
                            onClick={() => handleJoinCircle(circle)}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 hover:bg-stone-900 hover:text-white hover:border-black transition-colors shadow-2xs text-xs font-bold"
                            title={`Join ${circle.name}`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              </div>

              {/* 10X Faster Promo Card (Matching Reference Layout) */}
              <div className="relative overflow-hidden rounded-2xl border border-zinc-900 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-5 text-white shadow-xs">
                <div className="absolute right-0 top-0 -mr-6 -mt-6 h-24 w-24 rounded-full bg-purple-600/20 blur-xl pointer-events-none" />
                <div className="relative space-y-1">
                  <h3 className="text-base font-extrabold tracking-tight text-white leading-snug">
                    10X Faster <br />
                    with Circles
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Connect. Collaborate. Grow.
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-end">
                  <Link
                    href={currentUser ? '/circles/new' : '/register'}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-md transition-all hover:scale-105"
                    title="Create a Circle"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>

            {/* SUB-COLUMN 2: Center Feed Stream + Quick Composer */}
            <div className="lg:col-span-6 space-y-4 order-1 lg:order-2">
              {/* Quick-Post Composer ("What's on your mind?") */}
              {currentUser && composerCircles.length > 0 && (
                <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs">
                  {!composerExpanded ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white overflow-hidden border border-stone-200 shadow-2xs">
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
                          className="flex-1 rounded-full border border-stone-200 bg-stone-50/80 px-4 py-2.5 text-left text-xs sm:text-sm text-stone-500 hover:border-stone-300 hover:bg-stone-100 transition-all"
                        >
                          What&apos;s on your mind?
                        </button>
                      </div>

                      <div className="flex items-center justify-between border-t border-stone-100 pt-3">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <button
                            type="button"
                            onClick={() => setComposerExpanded(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
                          >
                            <ImageIcon className="h-4 w-4 text-emerald-500" />
                            <span>Photo</span>
                          </button>
                          <Link
                            href="/explore?tab=events"
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
                          >
                            <Calendar className="h-4 w-4 text-rose-500" />
                            <span>Event</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => setComposerExpanded(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
                          >
                            <Video className="h-4 w-4 text-sky-500" />
                            <span>Video</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setComposerMode('resource');
                              setComposerExpanded(true);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
                          >
                            <FileText className="h-4 w-4 text-amber-500" />
                            <span>Document</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setComposerExpanded(true)}
                          className="rounded-full bg-purple-600 hover:bg-purple-700 px-5 py-1.5 text-xs font-bold text-white shadow-2xs transition-colors"
                        >
                          Post
                        </button>
                      </div>
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
                    const { resource, cleanBody: rawCleanBody } = parsePostContent(post.body);
                    const mediaUrls = extractMediaUrls(rawCleanBody);
                    const cleanBody = stripImageMarkdown(rawCleanBody);
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
                        {/* 1. Facebook-style Clean Header matching reference */}
                        <div className="p-4 sm:p-5 pb-3 flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Author Avatar */}
                            <div className="relative shrink-0">
                              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-900 text-white font-bold border border-stone-200 overflow-hidden shadow-2xs">
                                {post.author?.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={post.author.avatar_url}
                                    alt={post.author.display_name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span>{(post.author?.display_name || 'M').slice(0, 1).toUpperCase()}</span>
                                )}
                              </div>
                              {/* Circle Mini Badge */}
                              <Link
                                href={`/circles/${item.circle.slug}`}
                                title={`Posted in ${item.circle.name}`}
                                className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[8px] font-bold text-white border-2 border-white overflow-hidden shadow-2xs hover:scale-110 transition-transform"
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
                            </div>

                            {/* Author & Circle Context Lines (Matching Reference Header) */}
                            <div className="min-w-0 leading-tight">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-base font-bold text-stone-900 hover:underline cursor-pointer">
                                  {post.author?.display_name || 'Member'}
                                </span>
                                {item.authorRole && ['owner', 'admin'].includes(item.authorRole) && (
                                  <CheckCircle2 className="h-4 w-4 fill-[#1877F2] text-white shrink-0" />
                                )}
                                {item.authorRole && ['owner', 'admin', 'moderator'].includes(item.authorRole) && (
                                  <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase text-stone-700 border border-stone-200">
                                    {item.authorRole}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 text-xs text-stone-500">
                                <span>{formatRelativeTime(post.created_at)}</span>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1">
                                  <Globe className="h-3 w-3 text-stone-400" />
                                  <span>{item.circle.visibility === 'public' ? 'Public' : 'Members'}</span>
                                </span>
                                <span>·</span>
                                <Link
                                  href={`/circles/${item.circle.slug}`}
                                  className="text-stone-500 hover:text-stone-900 hover:underline truncate"
                                >
                                  {item.circle.name}
                                </Link>
                                {post.space?.name && (
                                  <span className="text-stone-400">
                                    › #{post.space.name}
                                  </span>
                                )}
                                {post.is_pinned && (
                                  <span className="inline-flex items-center gap-0.5 text-stone-900 font-semibold ml-0.5">
                                    · <Pin className="h-3 w-3" /> Pinned
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Header Right: Join Button (if not member) + 3-Dots Menu */}
                          <div className="relative shrink-0 flex items-center gap-2">
                            {!isMember && item.circle.name !== 'Circles' && (
                              isPending ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800 border border-amber-200">
                                  <Clock className="h-2.5 w-2.5" />
                                  <span>Pending</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={joiningCircleId === item.circle.id}
                                  onClick={() => handleJoinCircle(item.circle)}
                                  className="inline-flex items-center gap-1 rounded-full bg-stone-100 hover:bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-900 transition-colors"
                                >
                                  <UserPlus className="h-3.5 w-3.5" />
                                  <span>Join</span>
                                </button>
                              )
                            )}

                            {/* 3-Dots Dropdown Trigger */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuPostId(activeMenuPostId === item.id ? null : item.id);
                                }}
                                className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
                                aria-label="More post options"
                              >
                                <MoreHorizontal className="h-5 w-5" />
                              </button>

                              {activeMenuPostId === item.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg z-20 animate-in fade-in zoom-in-95 duration-100 space-y-0.5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleToggleSave(item.circle.id, post.id);
                                      setActiveMenuPostId(null);
                                    }}
                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-50 font-medium transition-colors"
                                  >
                                    <Bookmark className={`h-3.5 w-3.5 ${post.viewer_has_saved ? 'fill-purple-600 text-purple-600' : ''}`} />
                                    <span>{post.viewer_has_saved ? 'Remove from Saved' : 'Save Post'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleShareUrl(item.id, `/circles/${item.circle.slug}/discussions/${post.id}`);
                                      setActiveMenuPostId(null);
                                    }}
                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-50 font-medium transition-colors"
                                  >
                                    <Share2 className="h-3.5 w-3.5" />
                                    <span>{copiedItemId === item.id ? 'Copied Link' : 'Copy link to post'}</span>
                                  </button>
                                  <Link
                                    href={`/circles/${item.circle.slug}`}
                                    onClick={() => setActiveMenuPostId(null)}
                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-50 font-medium transition-colors"
                                  >
                                    <ArrowRight className="h-3.5 w-3.5" />
                                    <span>Visit Circle</span>
                                  </Link>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 2. Post Content Body */}
                        <div className="px-4 sm:px-5 pb-3.5 space-y-2">
                          {showTitle && (
                            <Link
                              href={`/circles/${item.circle.slug}/discussions/${post.id}`}
                              className="block text-base sm:text-lg font-bold text-stone-900 hover:text-black tracking-tight leading-snug transition-colors"
                            >
                              {post.title}
                            </Link>
                          )}

                          {cleanBody && (
                            <p className="whitespace-pre-line text-sm sm:text-base leading-relaxed text-stone-700 break-words">
                              {renderTextWithHashtags(cleanBody, (tag) => {
                                setSearchQuery(tag);
                                window.scrollTo({ top: 350, behavior: 'smooth' });
                              })}
                            </p>
                          )}

                          {/* Attached Images Gallery (Full-bleed / Collage like Facebook) */}
                          {mediaUrls.length > 0 && (
                            <div className="w-full overflow-hidden rounded-xl border border-stone-200 mt-2">
                              {mediaUrls.length === 1 && (
                                <div
                                  className="relative w-full bg-stone-100 cursor-pointer overflow-hidden"
                                  onClick={() => window.open(mediaUrls[0], '_blank')}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={mediaUrls[0]}
                                    alt="Post photo"
                                    className="w-full object-cover hover:brightness-95 transition-all max-h-[500px]"
                                  />
                                </div>
                              )}
                              {mediaUrls.length === 2 && (
                                <div className="grid grid-cols-2 gap-1 max-h-[380px]">
                                  {mediaUrls.map((url, idx) => (
                                    <div
                                      key={idx}
                                      className="relative bg-stone-100 overflow-hidden cursor-pointer h-64"
                                      onClick={() => window.open(url, '_blank')}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover hover:brightness-95" />
                                    </div>
                                  ))}
                                </div>
                              )}
                              {mediaUrls.length >= 3 && (
                                <div className="grid grid-cols-2 gap-1 max-h-[380px]">
                                  <div
                                    className="relative bg-stone-100 overflow-hidden cursor-pointer h-72"
                                    onClick={() => window.open(mediaUrls[0], '_blank')}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={mediaUrls[0]} alt="Photo 1" className="w-full h-full object-cover hover:brightness-95" />
                                  </div>
                                  <div className="flex flex-col gap-1 h-72">
                                    <div
                                      className="relative bg-stone-100 overflow-hidden cursor-pointer flex-1"
                                      onClick={() => window.open(mediaUrls[1], '_blank')}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={mediaUrls[1]} alt="Photo 2" className="w-full h-full object-cover hover:brightness-95" />
                                    </div>
                                    <div
                                      className="relative bg-stone-100 overflow-hidden cursor-pointer flex-1"
                                      onClick={() => window.open(mediaUrls[2], '_blank')}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={mediaUrls[2]} alt="Photo 3" className="w-full h-full object-cover hover:brightness-95" />
                                      {mediaUrls.length > 3 && (
                                        <div className="absolute inset-0 bg-black/55 flex items-center justify-center pointer-events-none">
                                          <span className="text-white font-bold text-lg">+{mediaUrls.length - 3}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Attached Resource Card */}
                          {resource && (
                            <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3.5">
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
                            </div>
                          )}

                          {/* Attached Interactive Poll */}
                          {attachedPoll && (
                            <div className="mt-2 rounded-xl border border-stone-200 bg-stone-50/80 p-4 space-y-2.5">
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

                        {/* 3. Social Engagement Stats Row (Only shown when there are real reactions or comments) */}
                        {(post.reaction_count > 0 || post.comment_count > 0) && (
                          <div className="flex items-center justify-between px-4 sm:px-5 py-2 text-xs text-stone-500 border-t border-stone-100">
                            {/* Real Reactions: 👍 ❤️ */}
                            <div className="flex items-center gap-1.5">
                              {post.reaction_count > 0 && (
                                <>
                                  <div className="flex -space-x-1 items-center">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1877F2] text-white shadow-2xs z-20">
                                      <ThumbsUp className="h-2.5 w-2.5 fill-white text-white" />
                                    </span>
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FA383E] text-white shadow-2xs z-10">
                                      <Heart className="h-2.5 w-2.5 fill-white text-white" />
                                    </span>
                                  </div>
                                  <span className="font-semibold text-stone-700 text-xs">
                                    {post.reaction_count >= 1000
                                      ? `${(post.reaction_count / 1000).toFixed(1)}K`
                                      : post.reaction_count}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Real Comments Counter */}
                            {post.comment_count > 0 && (
                              <button
                                type="button"
                                onClick={() => handleToggleComments(item.circle.id, post.id)}
                                className="hover:underline text-xs text-stone-500 font-medium"
                              >
                                {post.comment_count} {post.comment_count === 1 ? 'comment' : 'comments'}
                              </button>
                            )}
                          </div>
                        )}

                        {/* 4. Facebook-style 4-Button Action Bar matching reference image */}
                        <div className="grid grid-cols-4 border-t border-stone-100 px-2 py-1 text-xs sm:text-sm font-semibold text-stone-600">
                          {/* Like Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleLike(item.circle.id, post.id)}
                            className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl py-2 sm:py-2.5 hover:bg-stone-50 transition-colors ${
                              post.viewer_has_liked ? 'text-[#1877F2] font-bold' : 'text-stone-600 hover:text-stone-900'
                            }`}
                          >
                            <ThumbsUp className={`h-4 w-4 ${post.viewer_has_liked ? 'fill-[#1877F2] text-[#1877F2]' : 'text-stone-500'}`} />
                            <span>Like</span>
                          </button>

                          {/* Comment Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleComments(item.circle.id, post.id)}
                            className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl py-2 sm:py-2.5 hover:bg-stone-50 transition-colors ${
                              isCommentsOpen ? 'text-stone-900 bg-stone-100 font-bold' : 'text-stone-600 hover:text-stone-900'
                            }`}
                          >
                            <MessageSquare className="h-4 w-4 text-stone-500" />
                            <span>Comment</span>
                          </button>

                          {/* Share Button */}
                          <button
                            type="button"
                            onClick={() => handleShareUrl(item.id, `/circles/${item.circle.slug}/discussions/${post.id}`)}
                            className="inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl py-2 sm:py-2.5 hover:bg-stone-50 text-stone-600 hover:text-stone-900 transition-colors"
                          >
                            {copiedItemId === item.id ? (
                              <>
                                <Check className="h-4 w-4 text-emerald-600" />
                                <span className="text-emerald-700">Copied</span>
                              </>
                            ) : (
                              <>
                                <Share2 className="h-4 w-4 text-stone-500" />
                                <span>Share</span>
                              </>
                            )}
                          </button>

                          {/* Save Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleSave(item.circle.id, post.id)}
                            className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl py-2 sm:py-2.5 hover:bg-stone-50 transition-colors ${
                              post.viewer_has_saved ? 'text-purple-600 font-bold' : 'text-stone-600 hover:text-stone-900'
                            }`}
                          >
                            <Bookmark className={`h-4 w-4 ${post.viewer_has_saved ? 'fill-purple-600 text-purple-600' : 'text-stone-500'}`} />
                            <span>{post.viewer_has_saved ? 'Saved' : 'Save'}</span>
                          </button>
                        </div>

                        {/* 5. Facebook-style Inline Comments Section */}
                        {isCommentsOpen && (
                          <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-3.5 space-y-3">
                            {isLoadingComments ? (
                              <p className="py-3 text-center text-xs text-stone-400">
                                Loading comments...
                              </p>
                            ) : postComments.length === 0 ? (
                              <p className="py-2 text-center text-xs text-stone-500">
                                No comments yet. Be the first to start the conversation!
                              </p>
                            ) : (
                              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                                {postComments.map((comment) => (
                                  <div
                                    key={comment.id}
                                    className="flex items-start gap-2.5"
                                  >
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-bold text-stone-800 overflow-hidden border border-stone-200">
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
                                    <div className="min-w-0 max-w-[85%]">
                                      <div className="rounded-2xl bg-white px-3.5 py-2 border border-stone-200/80 shadow-2xs">
                                        <span className="text-xs font-bold text-stone-900 block leading-tight">
                                          {comment.author?.display_name || 'Member'}
                                        </span>
                                        <p className="mt-0.5 whitespace-pre-line text-xs text-stone-800 leading-relaxed">
                                          {comment.body}
                                        </p>
                                      </div>
                                      <span className="text-[10px] text-stone-400 pl-2 mt-0.5 block">
                                        {formatRelativeTime(comment.created_at)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Inline Comment Input Box */}
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
                                className="flex items-center gap-2 pt-1"
                              >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-xs font-bold text-white overflow-hidden border border-stone-200">
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
                                  className="flex-1 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-black focus:outline-none shadow-2xs"
                                />
                                <button
                                  type="submit"
                                  disabled={isSubmittingComment || !commentDraft.trim()}
                                  className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-black text-white hover:bg-stone-800 disabled:opacity-40 transition-colors shrink-0 shadow-2xs"
                                  title="Send comment"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </button>
                              </form>
                            ) : (
                              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-100 px-3.5 py-2.5 text-xs">
                                <span className="text-stone-700">
                                  Join <strong>{item.circle.name}</strong> to comment on community discussions.
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
                        {/* Facebook-style Clean Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-sm font-bold text-stone-800 border border-stone-200 overflow-hidden shadow-2xs">
                                {(ev.host?.avatar_url || ev.organizer?.avatar_url) ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={ev.host?.avatar_url || ev.organizer?.avatar_url || ''}
                                    alt={ev.host?.display_name || ev.organizer?.display_name || 'Host'}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span>{((ev.host?.display_name || ev.organizer?.display_name || item.circle.name).slice(0, 1)).toUpperCase()}</span>
                                )}
                              </div>
                              <Link
                                href={`/circles/${item.circle.slug}`}
                                title={item.circle.name}
                                className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[8px] font-bold text-white border-2 border-white overflow-hidden shadow-2xs"
                              >
                                {item.circle.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.circle.avatar_url} alt={item.circle.name} className="h-full w-full object-cover" />
                                ) : (
                                  item.circle.name.slice(0, 1).toUpperCase()
                                )}
                              </Link>
                            </div>

                            <div className="min-w-0 leading-tight">
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span className="text-sm font-bold text-stone-900 hover:underline">
                                  {ev.host?.display_name || ev.organizer?.display_name || 'Host'}
                                </span>
                                <span className="text-xs text-stone-400 font-normal">created an event in</span>
                                <Link
                                  href={`/circles/${item.circle.slug}`}
                                  className="text-sm font-semibold text-stone-900 hover:underline truncate"
                                >
                                  {item.circle.name}
                                </Link>
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-stone-400">
                                <span>{formatRelativeTime(ev.created_at)}</span>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1">
                                  {ev.location_type === 'in_person' ? (
                                    <MapPin className="h-2.5 w-2.5 text-amber-600" />
                                  ) : (
                                    <Video className="h-2.5 w-2.5 text-sky-600" />
                                  )}
                                  <span>{channelLabel}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-mono font-semibold text-sky-800 border border-sky-200">
                              EVENT
                            </span>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuPostId(activeMenuPostId === item.id ? null : item.id);
                                }}
                                className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
                                aria-label="More options"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              {activeMenuPostId === item.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg z-20 animate-in fade-in zoom-in-95 duration-100 space-y-0.5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleShareUrl(item.id, `/circles/${item.circle.slug}/events`);
                                      setActiveMenuPostId(null);
                                    }}
                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-50 font-medium transition-colors"
                                  >
                                    <Share2 className="h-3.5 w-3.5" />
                                    <span>{copiedItemId === item.id ? 'Copied Link' : 'Copy event link'}</span>
                                  </button>
                                  <Link
                                    href={`/circles/${item.circle.slug}`}
                                    onClick={() => setActiveMenuPostId(null)}
                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-50 font-medium transition-colors"
                                  >
                                    <ArrowRight className="h-3.5 w-3.5" />
                                    <span>Visit Circle</span>
                                  </Link>
                                </div>
                              )}
                            </div>
                          </div>
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
                        className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-4 sm:p-5 shadow-xs transition-all hover:border-stone-300/90 space-y-3"
                      >
                        {/* Facebook-style Clean Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-sm font-bold text-stone-800 border border-stone-200 overflow-hidden shadow-2xs">
                                {listing.seller?.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={listing.seller.avatar_url}
                                    alt={listing.seller.display_name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span>{((listing.seller?.display_name || item.circle.name).slice(0, 1)).toUpperCase()}</span>
                                )}
                              </div>
                              <Link
                                href={`/circles/${item.circle.slug}`}
                                title={item.circle.name}
                                className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[8px] font-bold text-white border-2 border-white overflow-hidden shadow-2xs hover:scale-110 transition-transform"
                              >
                                {item.circle.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.circle.avatar_url} alt={item.circle.name} className="h-full w-full object-cover" />
                                ) : (
                                  item.circle.name.slice(0, 1).toUpperCase()
                                )}
                              </Link>
                            </div>

                            <div className="min-w-0 leading-tight">
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span className="text-sm font-bold text-stone-900 hover:underline">
                                  {listing.seller?.display_name || 'Member'}
                                </span>
                                <span className="text-xs text-stone-400 font-normal">listed an item in</span>
                                <Link
                                  href={`/circles/${item.circle.slug}`}
                                  className="text-sm font-semibold text-stone-900 hover:underline truncate"
                                >
                                  {item.circle.name}
                                </Link>
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-stone-400">
                                <span>{formatRelativeTime(listing.created_at)}</span>
                                <span>·</span>
                                <span className="capitalize">{listing.category || 'Marketplace'}</span>
                                {listing.location && (
                                  <>
                                    <span>·</span>
                                    <span className="inline-flex items-center gap-0.5">
                                      <MapPin className="h-2.5 w-2.5 text-stone-400" />
                                      {listing.location}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-mono font-bold text-stone-900 border border-stone-200">
                              {priceText}
                            </span>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuPostId(activeMenuPostId === item.id ? null : item.id);
                                }}
                                className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
                                aria-label="More options"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              {activeMenuPostId === item.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg z-20 animate-in fade-in zoom-in-95 duration-100 space-y-0.5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleShareUrl(item.id, `/circles/${item.circle.slug}/marketplace/${listing.id}`);
                                      setActiveMenuPostId(null);
                                    }}
                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-50 font-medium transition-colors"
                                  >
                                    <Share2 className="h-3.5 w-3.5" />
                                    <span>{copiedItemId === item.id ? 'Copied Link' : 'Copy listing link'}</span>
                                  </button>
                                  <Link
                                    href={`/circles/${item.circle.slug}`}
                                    onClick={() => setActiveMenuPostId(null)}
                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-50 font-medium transition-colors"
                                  >
                                    <ArrowRight className="h-3.5 w-3.5" />
                                    <span>Visit Circle</span>
                                  </Link>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Listing Content Body */}
                        <div className="flex flex-col sm:flex-row gap-3.5 rounded-xl border border-stone-200/80 bg-stone-50/50 p-3">
                          {listing.image_urls && listing.image_urls[0] && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={listing.image_urls[0]}
                              alt={listing.title}
                              className="h-36 sm:h-24 sm:w-32 rounded-lg object-cover shrink-0 border border-stone-200"
                            />
                          )}
                          <div className="min-w-0 flex-1 space-y-1">
                            <Link
                              href={`/circles/${item.circle.slug}/marketplace/${listing.id}`}
                              className="block text-sm sm:text-base font-bold text-stone-900 hover:underline"
                            >
                              {listing.title}
                            </Link>
                            {listing.description && (
                              <p className="line-clamp-2 text-xs text-stone-600 leading-relaxed">
                                {listing.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Footer Action */}
                        <div className="flex items-center justify-between pt-0.5">
                          <span className="inline-flex items-center gap-1 text-xs text-stone-500 capitalize">
                            <Tag className="h-3.5 w-3.5 text-stone-400" />
                            {listing.listing_type || 'Listing'}
                          </span>
                          <Link
                            href={`/circles/${item.circle.slug}/marketplace/${listing.id}`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
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
                        className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-4 sm:p-5 shadow-xs transition-all hover:border-stone-300/90 space-y-3"
                      >
                        {/* Facebook-style Clean Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-sm font-bold text-stone-800 border border-stone-200 overflow-hidden shadow-2xs">
                                {course.instructor?.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={course.instructor.avatar_url}
                                    alt={course.instructor.display_name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span>{((course.instructor?.display_name || item.circle.name).slice(0, 1)).toUpperCase()}</span>
                                )}
                              </div>
                              <Link
                                href={`/circles/${item.circle.slug}`}
                                title={item.circle.name}
                                className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[8px] font-bold text-white border-2 border-white overflow-hidden shadow-2xs hover:scale-110 transition-transform"
                              >
                                {item.circle.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.circle.avatar_url} alt={item.circle.name} className="h-full w-full object-cover" />
                                ) : (
                                  item.circle.name.slice(0, 1).toUpperCase()
                                )}
                              </Link>
                            </div>

                            <div className="min-w-0 leading-tight">
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span className="text-sm font-bold text-stone-900 hover:underline">
                                  {course.instructor?.display_name || 'Instructor'}
                                </span>
                                <span className="text-xs text-stone-400 font-normal">published a course in</span>
                                <Link
                                  href={`/circles/${item.circle.slug}`}
                                  className="text-sm font-semibold text-stone-900 hover:underline truncate"
                                >
                                  {item.circle.name}
                                </Link>
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-stone-400">
                                <span>{formatRelativeTime(item.timestamp)}</span>
                                <span>·</span>
                                <span className="capitalize">{difficulty}</span>
                                <span>·</span>
                                <span>{totalLessons} {totalLessons === 1 ? 'lesson' : 'lessons'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold border ${
                              isPaid
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              {isPaid ? 'PAID' : 'FREE'}
                            </span>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuPostId(activeMenuPostId === item.id ? null : item.id);
                                }}
                                className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
                                aria-label="More options"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              {activeMenuPostId === item.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg z-20 animate-in fade-in zoom-in-95 duration-100 space-y-0.5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleShareUrl(item.id, `/circles/${item.circle.slug}/courses/${course.id}`);
                                      setActiveMenuPostId(null);
                                    }}
                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-50 font-medium transition-colors"
                                  >
                                    <Share2 className="h-3.5 w-3.5" />
                                    <span>{copiedItemId === item.id ? 'Copied Link' : 'Copy course link'}</span>
                                  </button>
                                  <Link
                                    href={`/circles/${item.circle.slug}`}
                                    onClick={() => setActiveMenuPostId(null)}
                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-50 font-medium transition-colors"
                                  >
                                    <ArrowRight className="h-3.5 w-3.5" />
                                    <span>Visit Circle</span>
                                  </Link>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Course Body */}
                        <div className="flex flex-col sm:flex-row gap-3.5 rounded-xl border border-stone-200/80 bg-stone-50/50 p-3">
                          {course.thumbnail_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={course.thumbnail_url}
                              alt={course.title}
                              className="h-36 sm:h-24 sm:w-36 rounded-lg object-cover shrink-0 border border-stone-200"
                            />
                          )}
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <Link
                              href={`/circles/${item.circle.slug}/courses/${course.id}`}
                              className="block text-sm sm:text-base font-bold text-stone-900 hover:underline"
                            >
                              {course.title}
                            </Link>
                            {course.description && (
                              <p className="line-clamp-2 text-xs text-stone-600 leading-relaxed">
                                {course.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-stone-500 font-medium">
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
                            </div>
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="flex items-center justify-between gap-3 pt-0.5">
                          <Link
                            href={`/circles/${item.circle.slug}/courses`}
                            className="text-xs text-stone-500 hover:text-stone-900 font-medium flex items-center gap-1"
                          >
                            <span>More in {item.circle.name}</span>
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
                        className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-4 sm:p-5 shadow-xs transition-all hover:border-stone-300/90 space-y-3"
                      >
                        {/* Facebook-style Clean Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-sm font-bold text-stone-800 border border-stone-200 overflow-hidden shadow-2xs">
                                {res.author?.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={res.author.avatar_url}
                                    alt={res.author.display_name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span>{((res.author?.display_name || item.circle.name).slice(0, 1)).toUpperCase()}</span>
                                )}
                              </div>
                              <Link
                                href={`/circles/${item.circle.slug}`}
                                title={item.circle.name}
                                className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[8px] font-bold text-white border-2 border-white overflow-hidden shadow-2xs hover:scale-110 transition-transform"
                              >
                                {item.circle.avatar_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.circle.avatar_url} alt={item.circle.name} className="h-full w-full object-cover" />
                                ) : (
                                  item.circle.name.slice(0, 1).toUpperCase()
                                )}
                              </Link>
                            </div>

                            <div className="min-w-0 leading-tight">
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span className="text-sm font-bold text-stone-900 hover:underline">
                                  {res.author?.display_name || 'Member'}
                                </span>
                                <span className="text-xs text-stone-400 font-normal">shared a guide in</span>
                                <Link
                                  href={`/circles/${item.circle.slug}`}
                                  className="text-sm font-semibold text-stone-900 hover:underline truncate"
                                >
                                  {item.circle.name}
                                </Link>
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-stone-400">
                                <span>{formatRelativeTime(item.timestamp)}</span>
                                <span>·</span>
                                <span className="capitalize">{res.category || 'Guide'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {res.difficulty_level && (
                              <span className="rounded-full bg-stone-50 px-2 py-0.5 text-[10px] font-mono font-bold capitalize text-stone-700 border border-stone-200">
                                {res.difficulty_level}
                              </span>
                            )}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuPostId(activeMenuPostId === item.id ? null : item.id);
                                }}
                                className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
                                aria-label="More options"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              {activeMenuPostId === item.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg z-20 animate-in fade-in zoom-in-95 duration-100 space-y-0.5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleShareUrl(item.id, `/circles/${item.circle.slug}/resources`);
                                      setActiveMenuPostId(null);
                                    }}
                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-50 font-medium transition-colors"
                                  >
                                    <Share2 className="h-3.5 w-3.5" />
                                    <span>{copiedItemId === item.id ? 'Copied Link' : 'Copy resource link'}</span>
                                  </button>
                                  <Link
                                    href={`/circles/${item.circle.slug}`}
                                    onClick={() => setActiveMenuPostId(null)}
                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-50 font-medium transition-colors"
                                  >
                                    <ArrowRight className="h-3.5 w-3.5" />
                                    <span>Visit Circle</span>
                                  </Link>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-stone-200/80 bg-stone-50/50 p-3.5 space-y-1.5">
                          <Link
                            href={`/circles/${item.circle.slug}/resources`}
                            className="block text-sm sm:text-base font-bold text-stone-900 hover:underline"
                          >
                            {res.title}
                          </Link>
                          {res.summary && (
                            <p className="line-clamp-2 text-xs text-stone-600 leading-relaxed">
                              {res.summary}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-0.5">
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
                        className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-4 sm:p-5 shadow-xs transition-all hover:border-stone-300/90 space-y-3"
                      >
                        {/* Facebook-style Clean Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <Link
                                href={`/circles/${item.circle.slug}`}
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-sm font-bold text-stone-800 border border-stone-200 overflow-hidden shadow-2xs"
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
                            </div>

                            <div className="min-w-0 leading-tight">
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <Link
                                  href={`/circles/${item.circle.slug}`}
                                  className="text-sm font-bold text-stone-900 hover:underline truncate"
                                >
                                  {item.circle.name}
                                </Link>
                                <span className="text-xs text-stone-400 font-normal">started a fundraiser</span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-stone-400">
                                <span>{formatRelativeTime(item.timestamp)}</span>
                                <span>·</span>
                                <span>Community Campaign</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-mono font-bold text-stone-900 border border-stone-200">
                              {cause.currency} {pledgedTotal.toLocaleString()}
                            </span>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuPostId(activeMenuPostId === item.id ? null : item.id);
                                }}
                                className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
                                aria-label="More options"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              {activeMenuPostId === item.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg z-20 animate-in fade-in zoom-in-95 duration-100 space-y-0.5"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleShareUrl(item.id, `/circles/${item.circle.slug}/community`);
                                      setActiveMenuPostId(null);
                                    }}
                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-50 font-medium transition-colors"
                                  >
                                    <Share2 className="h-3.5 w-3.5" />
                                    <span>{copiedItemId === item.id ? 'Copied Link' : 'Copy cause link'}</span>
                                  </button>
                                  <Link
                                    href={`/circles/${item.circle.slug}`}
                                    onClick={() => setActiveMenuPostId(null)}
                                    className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-stone-700 hover:bg-stone-50 font-medium transition-colors"
                                  >
                                    <ArrowRight className="h-3.5 w-3.5" />
                                    <span>Visit Circle</span>
                                  </Link>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-stone-200/80 bg-stone-50/50 p-3.5 space-y-2">
                          <Link
                            href={`/circles/${item.circle.slug}/community`}
                            className="block text-sm sm:text-base font-bold text-stone-900 hover:underline"
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

                        <div className="flex items-center justify-between pt-0.5">
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
          {/* SUB-COLUMN 3: Trending Topics & Upcoming Events (Matching Layout) */}
          {/* ----------------------------------------------------------------- */}
          <aside className="space-y-5 lg:col-span-3 order-3">
            {/* 1. Trending Topics Card */}
            <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <h2 className="text-xs font-bold text-stone-900">
                    Trending Topics
                  </h2>
                </div>
                <Link
                  href="/explore"
                  className="text-xs font-semibold text-purple-600 hover:underline flex items-center gap-0.5"
                >
                  <span>See all</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Hashtag Cloud */}
              <div className="flex flex-wrap gap-2 pt-0.5">
                {trendingHashtags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setSearchQuery(tag.replace('#', ''));
                      window.scrollTo({ top: 350, behavior: 'smooth' });
                    }}
                    className="rounded-xl bg-[#FAF9F6] border border-stone-200/90 px-3 py-1.5 text-xs font-bold text-stone-800 hover:border-black hover:bg-white hover:text-black transition-all shadow-2xs"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Upcoming Events Card */}
            <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-stone-900" />
                  <h2 className="text-xs font-bold text-stone-900">
                    Upcoming Events
                  </h2>
                </div>
                <Link
                  href="/explore?tab=events"
                  className="text-xs font-semibold text-purple-600 hover:underline flex items-center gap-0.5"
                >
                  <span>See all</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="space-y-3 pt-1">
                {upcomingEvents.length > 0 ? (
                  upcomingEvents.slice(0, 3).map((ev) => {
                    const d = new Date(ev.starts_at);
                    const dayOfWeek = d.toLocaleDateString([], { weekday: 'short' }).toUpperCase();
                    const dayNum = String(d.getDate()).padStart(2, '0');
                    const month = d.toLocaleDateString([], { month: 'short' }).toUpperCase();
                    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

                    return (
                      <Link
                        key={ev.id}
                        href={`/circles/${ev.circle.slug}/events`}
                        className="group flex items-center justify-between gap-3 rounded-xl p-1.5 hover:bg-stone-50 transition-colors"
                      >
                        {/* Date Badge */}
                        <div className="flex flex-col items-center justify-center rounded-xl bg-stone-100 border border-stone-200/90 py-1.5 px-2 min-w-[46px] shrink-0 text-center leading-tight">
                          <span className="text-[9px] font-mono font-bold uppercase text-stone-500">
                            {dayOfWeek}
                          </span>
                          <span className="text-base font-extrabold text-stone-900">
                            {dayNum}
                          </span>
                          <span className="text-[9px] font-mono font-bold uppercase text-stone-600">
                            {month}
                          </span>
                        </div>

                        {/* Event Details */}
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="truncate text-xs font-bold text-stone-900 group-hover:underline">
                            {ev.title}
                          </p>
                          <p className="text-[11px] text-stone-400">
                            {time}
                          </p>
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="text-[10px] font-semibold text-stone-500">
                              {ev.going_count || 0} attending
                            </span>
                          </div>
                        </div>

                        {/* Thumbnail */}
                        {ev.cover_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ev.cover_image_url}
                            alt={ev.title}
                            className="h-12 w-12 shrink-0 rounded-xl object-cover border border-stone-200"
                          />
                        ) : (
                          <div className="h-12 w-12 shrink-0 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400">
                            <Calendar className="h-5 w-5" />
                          </div>
                        )}
                      </Link>
                    );
                  })
                ) : (
                  <div className="py-4 text-center">
                    <p className="text-xs text-stone-500">No upcoming events scheduled yet.</p>
                    <Link
                      href="/explore?tab=events"
                      className="mt-1.5 inline-block text-xs font-semibold text-purple-600 hover:underline"
                    >
                      Explore events →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
        </main>
      </div>
    </div>
  );
}
