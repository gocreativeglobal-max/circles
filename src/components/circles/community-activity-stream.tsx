'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUp,
  BadgeCheck,
  BarChart2,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  FolderGit2,
  Globe,
  Heart,
  HeartHandshake,
  Lock,
  MapPin,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Quote,
  Share2,
  User,
  Users,
} from 'lucide-react';
import {
  Circle,
  CircleEventItem,
  CircleProjectItem,
  CommentItem,
  CourseItem,
  FundraisingCampaignItem,
  MarketplaceListingItem,
  UserProfile,
} from '@/types/domain';
import { ActivityStreamItem } from '@/features/circles/activity-stream';
import { DirectMessageDrawer } from '@/components/messages/direct-message-drawer';
import { getEffectiveBannerUrl } from '@/lib/theme/utils';
import { ImageUploader } from '@/components/ui/image-uploader';

export interface CommunityActivityStreamProps {
  circle: Circle;
  initialItems: ActivityStreamItem[];
  upcomingEvents: CircleEventItem[];
  featuredListings?: MarketplaceListingItem[];
  featuredCourses?: CourseItem[];
  featuredCauses?: FundraisingCampaignItem[];
  featuredProjects?: CircleProjectItem[];
  enabledCapabilityKeys: string[];
  currentUserId?: string | null;
  currentUser?: UserProfile | null;
  isMember: boolean;
}

type StreamFilter = 'all' | 'posts' | 'courses' | 'events' | 'marketplace' | 'polls' | 'resources';

const FILTERS: Array<{ key: StreamFilter; label: string; capability?: string }> = [
  { key: 'all', label: 'All Updates' },
  { key: 'posts', label: 'Feed', capability: 'discussions' },
  { key: 'events', label: 'Events', capability: 'events' },
  { key: 'courses', label: 'Courses', capability: 'learning_resources' },
  { key: 'marketplace', label: 'Marketplace', capability: 'marketplace' },
  { key: 'polls', label: 'Polls', capability: 'polls_decisions' },
  { key: 'resources', label: 'Resources', capability: 'learning_resources' },
];

const ITEM_TYPE_BY_FILTER: Record<Exclude<StreamFilter, 'all'>, ActivityStreamItem['itemType']> = {
  posts: 'post',
  courses: 'course',
  events: 'event',
  marketplace: 'listing',
  polls: 'poll',
  resources: 'resource',
};

function formatPrice(listing: MarketplaceListingItem): string {
  if (listing.price_amount === null || listing.price_amount === undefined) return 'Free';
  const amount = Number(listing.price_amount);
  const text = `${listing.price_currency || '$'}${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
  return listing.pricing_unit && listing.pricing_unit !== 'fixed' ? `${text}/${listing.pricing_unit}` : text;
}

function extractMediaUrls(body: string): string[] {
  if (!body) return [];
  const urls: string[] = [];

  // 1. Match markdown image links ![alt](url)
  const mdRegex = /!\[.*?\]\(((\/api\/uploads\/[^\s)]+)|(https?:\/\/[^\s)]+))\)/g;
  let match: RegExpExecArray | null;
  while ((match = mdRegex.exec(body)) !== null) {
    const url = match[1];
    if (url && !urls.includes(url)) urls.push(url);
  }

  // 2. Match standalone /api/uploads/[id]
  const uploadRegex = /(\/api\/uploads\/[0-9a-fA-F-]+)/g;
  while ((match = uploadRegex.exec(body)) !== null) {
    const url = match[1];
    if (url && !urls.includes(url)) urls.push(url);
  }

  // 3. Match standard image URLs with extensions
  const extRegex = /(https?:\/\/[^\s<>]+\.(png|jpe?g|webp|gif|svg))/gi;
  while ((match = extRegex.exec(body)) !== null) {
    const url = match[1];
    if (url && !urls.includes(url)) urls.push(url);
  }

  return urls;
}

function extractMediaUrl(body: string): string | null {
  const all = extractMediaUrls(body);
  return all.length > 0 ? all[0] : null;
}

function stripImageMarkdown(text: string): string {
  if (!text) return '';
  return text.replace(/!\[.*?\]\(((\/api\/uploads\/[^\s)]+)|(https?:\/\/[^\s)]+))\)/g, '').trim();
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Just now';
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return dateString;
  }
}

export function CommunityActivityStream({
  circle,
  initialItems,
  upcomingEvents,
  featuredListings = [],
  featuredCourses = [],
  featuredCauses = [],
  featuredProjects = [],
  enabledCapabilityKeys,
  currentUserId,
  currentUser,
  isMember,
}: CommunityActivityStreamProps) {
  const [items, setItems] = useState<ActivityStreamItem[]>(initialItems);
  const [activeFilter, setActiveFilter] = useState<StreamFilter>('all');
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [composerText, setComposerText] = useState('');
  const [postImages, setPostImages] = useState<string[]>([]);
  const [showPhotoUploader, setShowPhotoUploader] = useState(false);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [dmDrawerOpen, setDmDrawerOpen] = useState(false);
  const [activeDmConvoId, setActiveDmConvoId] = useState<string | null>(null);
  const [votedPolls, setVotedPolls] = useState<Record<string, string>>({});
  const [votingLoading, setVotingLoading] = useState<Record<string, boolean>>({});
  const [rsvpStatuses, setRsvpStatuses] = useState<Record<string, string>>({});
  const [rsvpLoading, setRsvpLoading] = useState<Record<string, boolean>>({});
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [inlineComments, setInlineComments] = useState<Record<string, CommentItem[]>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});
  const [copiedShare, setCopiedShare] = useState(false);
  const [moreNavOpen, setMoreNavOpen] = useState(false);

  // Extract hashtags dynamically from real posts only
  const trendingTopics = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.itemType === 'post') {
        const matches = (item.data.body + ' ' + (item.data.title || '')).match(/#[a-zA-Z0-9_]+/g);
        if (matches) {
          matches.forEach((t) => set.add(t));
        }
      }
    });
    return Array.from(set).slice(0, 8);
  }, [items]);

  const visibleFilters = FILTERS.filter(
    (f) =>
      !f.capability ||
      enabledCapabilityKeys.includes(f.capability) ||
      (f.capability === 'marketplace' && enabledCapabilityKeys.includes('listings_discovery')) ||
      (f.capability === 'courses' &&
        (enabledCapabilityKeys.includes('learning_resources') ||
          enabledCapabilityKeys.includes('courses_learning') ||
          items.some((i) => i.itemType === 'course')))
  );

  const visibleItems = useMemo(() => {
    let filtered = items;
    if (activeFilter !== 'all') {
      filtered = filtered.filter((i) => i.itemType === ITEM_TYPE_BY_FILTER[activeFilter]);
    }
    if (selectedTopic) {
      filtered = filtered.filter((item) => {
        if (item.itemType === 'post') {
          const body = (item.data.body || '').toLowerCase();
          const title = (item.data.title || '').toLowerCase();
          return body.includes(selectedTopic.toLowerCase()) || title.includes(selectedTopic.toLowerCase());
        }
        return true;
      });
    }
    return filtered;
  }, [items, activeFilter, selectedTopic]);

  async function handleCreateQuickPost(e: React.FormEvent) {
    e.preventDefault();
    const hasContent = composerText.trim() || postImages.length > 0;
    if (!hasContent || isSubmittingPost || !isMember) return;
    setIsSubmittingPost(true);
    try {
      const imageMarkdown = postImages.map((url) => `\n![attachment](${url})`).join('');
      const fullBody = `${composerText.trim()}${imageMarkdown}`.trim();
      const firstLine = composerText.trim().split('\n')[0];
      const title = firstLine ? firstLine.slice(0, 100) : 'Photo Post';

      const res = await fetch(`/api/circles/${circle.id}/discussions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body: fullBody,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.post) {
          const newItem: ActivityStreamItem = {
            id: `post-${data.post.id}`,
            itemType: 'post',
            timestamp: new Date().toISOString(),
            data: data.post,
          };
          setItems((prev) => [newItem, ...prev]);
          setComposerText('');
          setPostImages([]);
          setShowPhotoUploader(false);
        }
      }
    } catch (err) {
      console.error('Failed to create quick post:', err);
    } finally {
      setIsSubmittingPost(false);
    }
  }

  async function handleToggleLike(postId: string, initialCount: number, viewerHasLiked: boolean) {
    if (!currentUserId || !isMember) return;
    const currentlyLiked = likedPosts[postId] ?? viewerHasLiked;
    const currentCount = likeCounts[postId] ?? initialCount;
    const nextLiked = !currentlyLiked;
    const nextCount = nextLiked ? currentCount + 1 : Math.max(0, currentCount - 1);

    // Optimistic UI update
    setLikedPosts((prev) => ({ ...prev, [postId]: nextLiked }));
    setLikeCounts((prev) => ({ ...prev, [postId]: nextCount }));

    try {
      const res = await fetch(`/api/circles/${circle.id}/posts/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'react', reactionType: 'like' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.reactionCount === 'number') {
          setLikeCounts((prev) => ({ ...prev, [postId]: data.reactionCount }));
        }
        if (typeof data.active === 'boolean') {
          setLikedPosts((prev) => ({ ...prev, [postId]: data.active }));
        }
      } else {
        // Rollback on non-200
        setLikedPosts((prev) => ({ ...prev, [postId]: currentlyLiked }));
        setLikeCounts((prev) => ({ ...prev, [postId]: currentCount }));
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
      // Rollback on error
      setLikedPosts((prev) => ({ ...prev, [postId]: currentlyLiked }));
      setLikeCounts((prev) => ({ ...prev, [postId]: currentCount }));
    }
  }

  async function handleFetchComments(postId: string) {
    if (loadingComments[postId]) return;
    setLoadingComments((prev) => ({ ...prev, [postId]: true }));
    try {
      const res = await fetch(`/api/circles/${circle.id}/posts/${postId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.comments)) {
          setInlineComments((prev) => ({ ...prev, [postId]: data.comments }));
          setCommentCounts((prev) => ({ ...prev, [postId]: data.comments.length }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch post comments:', err);
    } finally {
      setLoadingComments((prev) => ({ ...prev, [postId]: false }));
    }
  }

  async function handleAddInlineComment(postId: string, text: string) {
    if (!currentUserId || !isMember || !text.trim() || submittingComment[postId]) return;
    setSubmittingComment((prev) => ({ ...prev, [postId]: true }));
    try {
      const res = await fetch(`/api/circles/${circle.id}/posts/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment', body: text.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.comment) {
          setInlineComments((prev) => ({
            ...prev,
            [postId]: [...(prev[postId] || []), data.comment],
          }));
          setCommentCounts((prev) => {
            const current = prev[postId] ?? 0;
            return { ...prev, [postId]: current + 1 };
          });
        }
      }
    } catch (err) {
      console.error('Failed to add inline comment:', err);
    } finally {
      setSubmittingComment((prev) => ({ ...prev, [postId]: false }));
    }
  }

  function handleShareCommunity() {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  }

  async function handleInquireListing(listing: MarketplaceListingItem) {
    if (!currentUserId || !isMember || listing.seller_id === currentUserId) return;
    try {
      const res = await fetch(`/api/circles/${circle.id}/messages/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: listing.seller_id, listingId: listing.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveDmConvoId(data.conversation.id);
        setDmDrawerOpen(true);
      }
    } catch (err) {
      console.error('Failed to start listing inquiry conversation:', err);
    }
  }

  async function handleVotePoll(pollId: string, optionId: string) {
    if (!currentUserId || !isMember) return;
    setVotingLoading((prev) => ({ ...prev, [pollId]: true }));
    try {
      const res = await fetch(`/api/circles/${circle.id}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vote', pollId, optionId }),
      });
      if (res.ok) {
        setVotedPolls((prev) => ({ ...prev, [pollId]: optionId }));
      }
    } catch (err) {
      console.error('Failed to vote on poll:', err);
    } finally {
      setVotingLoading((prev) => ({ ...prev, [pollId]: false }));
    }
  }

  async function handleRsvp(eventId: string, status: 'going' | 'interested' | 'declined') {
    if (!currentUserId || !isMember) return;
    setRsvpLoading((prev) => ({ ...prev, [eventId]: true }));
    try {
      const res = await fetch(`/api/circles/${circle.id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rsvp', eventId, status }),
      });
      if (res.ok) {
        setRsvpStatuses((prev) => ({ ...prev, [eventId]: status }));
      }
    } catch (err) {
      console.error('Failed to update event RSVP:', err);
    } finally {
      setRsvpLoading((prev) => ({ ...prev, [eventId]: false }));
    }
  }

  const spotlightEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null;
  const eventDate = spotlightEvent ? new Date(spotlightEvent.starts_at) : null;

  const featuredCause = featuredCauses.length > 0 ? featuredCauses[0] : null;
  const causeGoal = featuredCause?.goal_amount ?? 0;
  const causePledged = featuredCause?.pledged_total ?? 0;
  const causeCurrency = featuredCause?.currency ?? '$';
  const causePct = causeGoal > 0 ? Math.min(100, Math.round((causePledged / causeGoal) * 100)) : 0;

  const featuredProject = featuredProjects.length > 0 ? featuredProjects[0] : null;
  const isVerified = Boolean(circle.settings?.verified);
  const customTagline = circle.settings?.tagline ? String(circle.settings.tagline) : null;
  const customMotto = circle.settings?.motto ? String(circle.settings.motto) : null;
  const memberCount = circle.member_count ?? 1;
  const postCount = items.filter((i) => i.itemType === 'post').length;

  const effectiveBanner = getEffectiveBannerUrl(circle.theme_settings, circle.cover_url);
  const coverOverlayOpacity = circle.theme_settings?.coverOverlayOpacity ?? 0.6;
  const cardBgClass = 'border border-stone-200 bg-white shadow-sm';

  return (
    <div className="space-y-6">
      {/* 1. TOP HERO BANNER CARD (CUSTOMIZABLE ARTWORK & OVERLAY) */}
      <section className="relative overflow-hidden rounded-3xl border border-stone-200/80 bg-stone-900 text-white shadow-xl">
        {/* Cover Art / Gradient Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-700"
          style={{
            backgroundImage: effectiveBanner
              ? `url(${effectiveBanner})`
              : 'linear-gradient(135deg, rgba(24,24,27,0.95) 0%, rgba(9,9,11,0.98) 100%)',
          }}
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/60 to-transparent transition-opacity duration-300"
          style={{ opacity: coverOverlayOpacity }}
        />
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ backgroundColor: 'var(--circle-primary, #6366f1)' }}
        />

        {/* Hero Content */}
        <div className="relative z-10 flex flex-col justify-between gap-6 p-6 sm:p-8 md:flex-row md:items-end">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {/* Real Avatar */}
            <div className="relative shrink-0">
              <div
                className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white/80 bg-stone-900 shadow-2xl backdrop-blur-md sm:h-24 sm:w-24"
                style={{
                  boxShadow: '0 10px 25px -5px var(--circle-primary, rgba(99,102,241,0.4))',
                }}
              >
                {circle.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={circle.avatar_url} alt={circle.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl font-black tracking-tight text-white">
                    {circle.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {/* Title, Tagline, Description & Real Member Count */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{circle.name}</h1>
                {isVerified && (
                  <BadgeCheck className="h-6 w-6 text-indigo-400" aria-label="Verified Community" />
                )}
              </div>

              {customTagline && (
                <p className="text-sm font-semibold tracking-wide text-stone-200">{customTagline}</p>
              )}

              {circle.description && (
                <p className="max-w-xl text-xs leading-relaxed text-stone-300 sm:text-sm">{circle.description}</p>
              )}

              {/* Real Member Count */}
              <div className="flex items-center gap-2 pt-1 text-xs font-semibold text-stone-200">
                <Users className="h-4 w-4 text-stone-400" />
                <span>
                  {memberCount.toLocaleString()} {memberCount === 1 ? 'Member' : 'Members'}
                </span>
                {circle.location && (
                  <>
                    <span className="text-stone-500">•</span>
                    <span className="flex items-center gap-1 text-stone-300">
                      <MapPin className="h-3.5 w-3.5 text-stone-400" />
                      {circle.location}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons: Joined / Join & Share */}
          <div className="flex items-center gap-2.5">
            {isMember ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-xs font-bold text-stone-900 shadow-md">
                <Check className="h-4 w-4 text-stone-900 stroke-[2.5]" />
                <span>Joined</span>
              </span>
            ) : (
              <Link
                href={`/circles/${circle.slug}/join`}
                className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all active:scale-95"
                style={{ backgroundColor: 'var(--circle-primary, #000000)' }}
              >
                <Plus className="h-4 w-4" />
                <span>Join Circle</span>
              </Link>
            )}

            <button
              type="button"
              onClick={handleShareCommunity}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20 transition-colors"
              title="Share Community Link"
            >
              {copiedShare ? <Check className="h-4 w-4 text-emerald-400" /> : <Share2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </section>

      {/* 2. SUB-NAVIGATION PILL BAR */}
      <nav className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Link
          href={`/circles/${circle.slug}`}
          className="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-xs transition-all"
          style={{
            backgroundColor: 'var(--circle-primary-subtle, #f3f4f6)',
            color: 'var(--circle-primary, #111827)',
          }}
        >
          <span className="text-sm">🏠</span>
          <span>Home</span>
        </Link>

        {enabledCapabilityKeys.includes('discussions') && (
          <Link
            href={`/circles/${circle.slug}/discussions`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors shadow-2xs"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Feed</span>
          </Link>
        )}

        {(enabledCapabilityKeys.includes('events') || enabledCapabilityKeys.includes('events_activities')) && (
          <Link
            href={`/circles/${circle.slug}/events`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors shadow-2xs"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Events</span>
          </Link>
        )}

        {enabledCapabilityKeys.includes('learning_resources') && (
          <Link
            href={`/circles/${circle.slug}/projects`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors shadow-2xs"
          >
            <FolderGit2 className="h-3.5 w-3.5" />
            <span>Projects</span>
          </Link>
        )}

        {enabledCapabilityKeys.includes('fundraising_campaigns') && (
          <Link
            href={`/circles/${circle.slug}/causes`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors shadow-2xs"
          >
            <HeartHandshake className="h-3.5 w-3.5" />
            <span>Causes</span>
          </Link>
        )}

        {enabledCapabilityKeys.includes('learning_resources') && (
          <Link
            href={`/circles/${circle.slug}/resources`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors shadow-2xs"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Resources</span>
          </Link>
        )}

        <Link
          href={`/circles/${circle.slug}/members`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors shadow-2xs"
        >
          <Users className="h-3.5 w-3.5" />
          <span>Members</span>
        </Link>

        {/* Dropdown for More */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMoreNavOpen(!moreNavOpen)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors shadow-2xs"
          >
            <span>More</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {moreNavOpen && (
            <div className="absolute left-0 mt-2 w-48 rounded-xl border border-stone-200 bg-white py-1 shadow-lg z-20">
              <Link
                href={`/circles/${circle.slug}/courses`}
                onClick={() => setMoreNavOpen(false)}
                className="block px-4 py-2 text-xs text-stone-700 hover:bg-stone-50"
              >
                Courses & Learning
              </Link>
              <Link
                href={`/circles/${circle.slug}/marketplace`}
                onClick={() => setMoreNavOpen(false)}
                className="block px-4 py-2 text-xs text-stone-700 hover:bg-stone-50"
              >
                Marketplace
              </Link>
              <Link
                href={`/circles/${circle.slug}/studio`}
                onClick={() => setMoreNavOpen(false)}
                className="block px-4 py-2 text-xs text-stone-700 hover:bg-stone-50 font-semibold"
              >
                Circle Studio
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* 3. 3-COLUMN COMMUNITY FEED LAYOUT */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ================= LEFT COLUMN (lg:col-span-3) ================= */}
        <aside className="space-y-5 lg:col-span-3">
          {/* Real Upcoming Events Card (only if upcomingEvents exist) */}
          {spotlightEvent && eventDate && (
            <section className={`rounded-2xl ${cardBgClass} p-4`}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">Upcoming Events</h3>
                <Link
                  href={`/circles/${circle.slug}/events`}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors"
                >
                  See all →
                </Link>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-stone-100 text-stone-900 border border-stone-200 shadow-2xs">
                  <span className="text-[9px] font-bold uppercase text-stone-500 leading-none">
                    {eventDate.toLocaleString('en-US', { weekday: 'short' })}
                  </span>
                  <span className="my-0.5 text-base font-extrabold leading-none">{eventDate.getDate()}</span>
                  <span className="text-[9px] font-bold uppercase text-stone-500 leading-none">
                    {eventDate.toLocaleString('en-US', { month: 'short' })}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-stone-900">{spotlightEvent.title}</p>
                  <p className="mt-0.5 text-[11px] text-stone-500 truncate">
                    {new Date(spotlightEvent.starts_at).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {spotlightEvent.venue_text ? ` • ${spotlightEvent.venue_text}` : ''}
                  </p>

                  <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-stone-500">
                    <Users className="h-3 w-3 text-stone-400" />
                    <span>{spotlightEvent.going_count ?? 0} attending</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Real Trending Topics Card (only if hashtags exist in discussions) */}
          {trendingTopics.length > 0 && (
            <section className={`rounded-2xl ${cardBgClass} p-4`}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">Topics</h3>
                {selectedTopic && (
                  <button
                    type="button"
                    onClick={() => setSelectedTopic(null)}
                    className="text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {trendingTopics.map((topic) => {
                  const isSelected = selectedTopic === topic;
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => setSelectedTopic(isSelected ? null : topic)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-stone-900 text-white shadow-xs'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      {topic}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Real Causes / Crowdfunding Card (only if a real campaign exists) */}
          {featuredCause && (
            <section className={`relative overflow-hidden rounded-2xl ${cardBgClass} p-4`}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Fundraising Campaign
              </span>
              <h3 className="mt-1 text-sm font-bold text-stone-900">{featuredCause.title}</h3>

              {featuredCause.description && (
                <p className="mt-1.5 text-xs text-stone-600 line-clamp-2">{featuredCause.description}</p>
              )}

              {causeGoal > 0 && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
                    <span>{causePct}% funded</span>
                    <span>
                      {causeCurrency}
                      {causePledged.toLocaleString()} / {causeCurrency}
                      {causeGoal.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${causePct}%`,
                        backgroundColor: 'var(--circle-primary, #111827)',
                      }}
                    />
                  </div>
                </div>
              )}

              <Link
                href={`/circles/${circle.slug}/causes`}
                className="mt-3 block w-full rounded-xl border border-stone-200 bg-stone-50 py-1.5 text-center text-xs font-semibold text-stone-900 hover:bg-stone-100 transition-colors"
              >
                View Campaign →
              </Link>
            </section>
          )}

          {/* About & Community Metadata Card */}
          <section className={`rounded-2xl ${cardBgClass} p-4 space-y-3`}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">About</h3>
            <div className="space-y-2 text-xs text-stone-600">
              <div className="flex items-center justify-between">
                <span className="text-stone-400">Category</span>
                <span className="font-semibold text-stone-800 capitalize">{circle.category.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-400">Access</span>
                <span className="flex items-center gap-1 font-semibold text-stone-800 capitalize">
                  {circle.visibility === 'public' ? (
                    <Globe className="h-3.5 w-3.5 text-stone-500" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-stone-500" />
                  )}
                  {circle.visibility.replace('_', ' ')}
                </span>
              </div>
              {circle.location && (
                <div className="flex items-center justify-between">
                  <span className="text-stone-400">Location</span>
                  <span className="font-semibold text-stone-800">{circle.location}</span>
                </div>
              )}
            </div>
          </section>
        </aside>

        {/* ================= CENTER COLUMN (lg:col-span-6) ================= */}
        <main className="space-y-4 lg:col-span-6">
          {/* Multi-Action Quick Composer Box */}
          {isMember && (
            <section className={`rounded-2xl ${cardBgClass} p-4`}>
              <form onSubmit={handleCreateQuickPost} className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar url={currentUser?.avatar_url} name={currentUser?.display_name || 'You'} />
                  <input
                    type="text"
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    placeholder={`Share something with ${circle.name}...`}
                    className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs text-stone-900 placeholder-stone-400 focus:border-stone-400 focus:bg-white focus:outline-hidden transition-all"
                  />
                </div>

                {/* Photo Upload Area */}
                {showPhotoUploader && (
                  <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3">
                    <ImageUploader
                      circleId={circle.id}
                      value={postImages}
                      onChange={(val) => setPostImages(Array.isArray(val) ? val : val ? [val] : [])}
                      multiple={true}
                      maxFiles={4}
                      aspectRatio="video"
                      label="Attach Photos (PNG, JPG, WebP)"
                      helperText="Attach up to 4 photos. Automatically optimized client-side."
                    />
                  </div>
                )}

                {/* Real Action Buttons for Enabled Capabilities */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPhotoUploader((prev) => !prev)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                        showPhotoUploader || postImages.length > 0
                          ? 'bg-emerald-50 text-emerald-700 font-semibold'
                          : 'text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      <Camera className="h-3.5 w-3.5 text-emerald-500" />
                      <span>{postImages.length > 0 ? `${postImages.length} Photo${postImages.length > 1 ? 's' : ''}` : 'Photo'}</span>
                    </button>

                    {(enabledCapabilityKeys.includes('events') ||
                      enabledCapabilityKeys.includes('events_activities')) && (
                      <Link
                        href={`/circles/${circle.slug}/events?create=true`}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors"
                      >
                        <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                        <span>Event</span>
                      </Link>
                    )}

                    {enabledCapabilityKeys.includes('learning_resources') && (
                      <Link
                        href={`/circles/${circle.slug}/projects?create=true`}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors"
                      >
                        <FolderGit2 className="h-3.5 w-3.5 text-amber-500" />
                        <span>Project</span>
                      </Link>
                    )}

                    {enabledCapabilityKeys.includes('polls_decisions') && (
                      <Link
                        href={`/circles/${circle.slug}/polls?create=true`}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors"
                      >
                        <BarChart2 className="h-3.5 w-3.5 text-purple-500" />
                        <span>Poll</span>
                      </Link>
                    )}

                    {enabledCapabilityKeys.includes('fundraising_campaigns') && (
                      <Link
                        href={`/circles/${circle.slug}/causes?create=true`}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors"
                      >
                        <Heart className="h-3.5 w-3.5 text-rose-500" />
                        <span>Cause</span>
                      </Link>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={(!composerText.trim() && postImages.length === 0) || isSubmittingPost}
                    className="inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-40"
                    style={{
                      backgroundColor: 'var(--circle-primary, #000000)',
                      color: 'var(--circle-primary-fg, #ffffff)',
                    }}
                  >
                    <span>{isSubmittingPost ? 'Posting...' : 'Post'}</span>
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1 border-b border-stone-200 pb-2">
            {visibleFilters.map((f) => {
              const active = activeFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setActiveFilter(f.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-stone-900 text-white shadow-2xs'
                      : 'bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-stone-900 border border-stone-200'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Activity Feed Items */}
          {visibleItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-white py-16 text-center text-sm text-stone-500">
              No updates yet in this section.
            </div>
          ) : (
            <div className="space-y-4">
              {visibleItems.map((item) => {
                const isPost = item.itemType === 'post';
                const postId = isPost ? item.data.id : item.id;
                const postData = isPost ? item.data : null;
                const isLiked = isPost
                  ? (likedPosts[postId] ?? Boolean(postData?.viewer_has_liked))
                  : false;
                const likeCount = isPost
                  ? (likeCounts[postId] ?? (postData?.reaction_count ?? 0))
                  : 0;
                const commentCount = isPost
                  ? (commentCounts[postId] ?? (postData?.comment_count ?? 0))
                  : 0;

                return (
                  <ActivityFeedCard
                    key={item.id}
                    item={item}
                    circle={circle}
                    currentUserId={currentUserId}
                    currentUser={currentUser}
                    isMember={isMember}
                    isLiked={isLiked}
                    likeCount={likeCount}
                    commentCount={commentCount}
                    comments={isPost ? inlineComments[postId] : undefined}
                    isLoadingComments={isPost ? Boolean(loadingComments[postId]) : false}
                    isSubmittingComment={isPost ? Boolean(submittingComment[postId]) : false}
                    onToggleLike={() => {
                      if (isPost && postData) {
                        handleToggleLike(
                          postId,
                          postData.reaction_count ?? 0,
                          Boolean(postData?.viewer_has_liked)
                        );
                      }
                    }}
                    onFetchComments={() => {
                      if (isPost) {
                        handleFetchComments(postId);
                      }
                    }}
                    onSubmitComment={
                      isPost
                        ? (text: string) => handleAddInlineComment(postId, text)
                        : undefined
                    }
                    onInquire={handleInquireListing}
                    onVote={handleVotePoll}
                    votedOption={votedPolls[item.data.id]}
                    votingLoading={votingLoading[item.data.id]}
                    onRsvp={handleRsvp}
                    rsvpStatus={rsvpStatuses[item.data.id]}
                    rsvpLoading={rsvpLoading[item.data.id]}
                    cardBgClass={cardBgClass}
                  />
                );
              })}
            </div>
          )}
        </main>

        {/* ================= RIGHT COLUMN (lg:col-span-3) ================= */}
        <aside className="space-y-5 lg:col-span-3">
          {/* Real Community Stats Card */}
          <section className={`rounded-2xl ${cardBgClass} p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BarChart2 className="h-4 w-4 text-stone-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">Community Stats</h3>
              </div>
            </div>

            {/* Real Metrics Only */}
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-stone-50 p-2.5 border border-stone-100">
                <p className="text-base font-extrabold text-stone-900">{memberCount.toLocaleString()}</p>
                <p className="text-[10px] text-stone-500 font-medium">Members</p>
              </div>
              <div className="rounded-xl bg-stone-50 p-2.5 border border-stone-100">
                <p className="text-base font-extrabold text-stone-900">{postCount}</p>
                <p className="text-[10px] text-stone-500 font-medium">Discussions</p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-stone-100 text-[11px] text-stone-500 flex justify-between">
              <span>Created</span>
              <span className="font-medium text-stone-700">
                {new Date(circle.created_at).toLocaleDateString([], { month: 'short', year: 'numeric' })}
              </span>
            </div>
          </section>

          {/* Real Featured Projects Card (only if projects exist) */}
          {featuredProject && (
            <section className={`rounded-2xl ${cardBgClass} p-4`}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <FolderGit2 className="h-4 w-4 text-amber-500" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">Featured Project</h3>
                </div>
                <Link
                  href={`/circles/${circle.slug}/projects`}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors"
                >
                  See all →
                </Link>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-stone-900 truncate">{featuredProject.name}</h4>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-700 capitalize">
                    {featuredProject.status}
                  </span>
                </div>
                {featuredProject.description && (
                  <p className="text-xs text-stone-600 line-clamp-2">{featuredProject.description}</p>
                )}
              </div>
            </section>
          )}

          {/* Real Featured Courses (only if courses exist) */}
          {featuredCourses.length > 0 && (
            <section className={`rounded-2xl ${cardBgClass} p-4`}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">Courses</h3>
                <Link
                  href={`/circles/${circle.slug}/courses`}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors"
                >
                  See all →
                </Link>
              </div>
              <ul className="space-y-2">
                {featuredCourses.slice(0, 3).map((crs) => (
                  <li key={crs.id}>
                    <Link
                      href={`/circles/${circle.slug}/courses/${crs.id}`}
                      className="block text-xs font-semibold text-stone-900 hover:underline truncate"
                    >
                      {crs.title}
                    </Link>
                    <span className="text-[10px] text-stone-400">
                      {crs.total_lessons_count || 0} lessons
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Real Featured Marketplace Listings (only if listings exist) */}
          {featuredListings.length > 0 && (
            <section className={`rounded-2xl ${cardBgClass} p-4`}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">Marketplace</h3>
                <Link
                  href={`/circles/${circle.slug}/marketplace`}
                  className="text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors"
                >
                  See all →
                </Link>
              </div>
              <ul className="space-y-2">
                {featuredListings.slice(0, 3).map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-xs">
                    <Link
                      href={`/circles/${circle.slug}/marketplace/${item.id}`}
                      className="truncate font-medium text-stone-800 hover:underline"
                    >
                      {item.title}
                    </Link>
                    <span className="shrink-0 font-bold text-stone-900">{formatPrice(item)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Community Motto / Mission (only if real custom motto is configured) */}
          {customMotto && (
            <section className="relative overflow-hidden rounded-2xl border border-stone-800 bg-stone-900 p-5 text-white shadow-md">
              <Quote className="h-5 w-5 text-stone-400 mb-2" />
              <p className="text-xs italic leading-relaxed text-stone-200 font-serif">
                &ldquo;{customMotto}&rdquo;
              </p>
            </section>
          )}
        </aside>
      </div>

      {/* Direct Message Drawer */}
      <DirectMessageDrawer
        circleId={circle.id}
        isOpen={dmDrawerOpen}
        onClose={() => setDmDrawerOpen(false)}
        currentUserId={currentUserId}
        activeConversationId={activeDmConvoId}
        onSelectConversation={(id) => setActiveDmConvoId(id)}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// FEED CARDS (REAL DATA ONLY)
// -----------------------------------------------------------------------------

interface ActivityFeedCardProps {
  item: ActivityStreamItem;
  circle: Circle;
  currentUserId?: string | null;
  currentUser?: UserProfile | null;
  isMember: boolean;
  isLiked: boolean;
  likeCount: number;
  commentCount: number;
  comments?: CommentItem[];
  isLoadingComments?: boolean;
  isSubmittingComment?: boolean;
  onToggleLike: () => void;
  onFetchComments?: () => void;
  onSubmitComment?: (text: string) => Promise<void>;
  onInquire: (listing: MarketplaceListingItem) => void;
  onVote: (pollId: string, optionId: string) => void;
  votedOption?: string;
  votingLoading?: boolean;
  onRsvp: (eventId: string, status: 'going' | 'interested' | 'declined') => void;
  rsvpStatus?: string;
  rsvpLoading?: boolean;
  cardBgClass?: string;
}

function ActivityFeedCard({
  item,
  circle,
  currentUserId,
  currentUser,
  isMember,
  isLiked,
  likeCount,
  commentCount,
  comments,
  isLoadingComments,
  isSubmittingComment,
  onToggleLike,
  onFetchComments,
  onSubmitComment,
  onInquire,
  onVote,
  votedOption,
  votingLoading,
  onRsvp,
  rsvpStatus,
  rsvpLoading,
  cardBgClass = 'border border-stone-200 bg-white shadow-xs',
}: ActivityFeedCardProps) {
  const time = formatRelativeTime(item.timestamp);
  const [isExpandedText, setIsExpandedText] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [copiedPost, setCopiedPost] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // 1. Discussion Posts (Facebook/Instagram Hybrid)
  if (item.itemType === 'post') {
    const post = item.data;
    const href = `/circles/${circle.slug}/discussions/${post.id}`;
    const mediaUrls = extractMediaUrls(post.body);
    const cleanBody = stripImageMarkdown(post.body);
    const authorName = post.author?.display_name || 'Member';
    const isLongText = cleanBody.length > 220;
    const showTitle = Boolean(
      post.title &&
      post.title.trim() &&
      post.title.trim().toLowerCase() !== cleanBody.slice(0, 60).toLowerCase() &&
      !cleanBody.startsWith(post.title.trim())
    );

    function handleCopyPost() {
      if (typeof window !== 'undefined') {
        const url = `${window.location.origin}${href}`;
        navigator.clipboard.writeText(url);
        setCopiedPost(true);
        setTimeout(() => setCopiedPost(false), 2000);
      }
    }

    async function handleInlineCommentSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (!commentText.trim() || isSubmittingComment || !onSubmitComment) return;
      const text = commentText.trim();
      setCommentText('');
      await onSubmitComment(text);
    }

    return (
      <article className={`overflow-hidden rounded-2xl ${cardBgClass} transition-all hover:border-stone-300`}>
        {/* Compact Header */}
        <div className="flex items-start justify-between px-4 pt-4 pb-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/circles/${circle.slug}/members/${post.author?.id || post.author_id}`}
              className="shrink-0"
            >
              <Avatar url={post.author?.avatar_url} name={authorName} size="lg" />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-1.5 leading-snug">
                <Link
                  href={`/circles/${circle.slug}/members/${post.author?.id || post.author_id}`}
                  className="text-sm font-bold text-stone-900 hover:underline"
                >
                  {authorName}
                </Link>
                {post.space?.name && (
                  <Link
                    href={`/circles/${circle.slug}/spaces/${post.space.slug}`}
                    className="text-xs font-medium text-stone-400 hover:text-stone-700 transition-colors"
                  >
                    &#8250; #{post.space.name}
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-stone-400 mt-0.5">
                <span title={new Date(item.timestamp).toLocaleString()}>{time}</span>
                <span>·</span>
                <Globe className="h-2.5 w-2.5" />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyPost}
            title="Copy link to post"
            className="shrink-0 rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors ml-2"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Caption Text — above the image, Facebook style */}
        {(showTitle || cleanBody) && (
          <div className="px-4 pb-2.5">
            {showTitle && (
              <p className="font-bold text-stone-900 text-[14px] leading-snug mb-0.5">{post.title}</p>
            )}
            {cleanBody && (
              <div className="text-[13.5px] text-stone-800 leading-relaxed whitespace-pre-wrap break-words">
                {isLongText && !isExpandedText ? (
                  <>
                    {cleanBody.slice(0, 240)}
                    {'... '}
                    <button
                      type="button"
                      onClick={() => setIsExpandedText(true)}
                      className="font-semibold text-stone-500 hover:text-stone-900 text-[13px]"
                    >
                      See more
                    </button>
                  </>
                ) : (
                  cleanBody
                )}
              </div>
            )}
          </div>
        )}

        {/* Full-Bleed Media — edge-to-edge, no side padding */}
        {mediaUrls.length > 0 && (
          <div className="w-full overflow-hidden">
            {/* 1 photo — full-width hero up to 560px tall */}
            {mediaUrls.length === 1 && (
              <div
                className="relative w-full bg-stone-100 cursor-pointer overflow-hidden"
                onClick={() => window.open(mediaUrls[0], '_blank')}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaUrls[0]}
                  alt="Post photo"
                  className="w-full object-cover hover:brightness-95 transition-all"
                  style={{ maxHeight: 560, display: 'block' }}
                />
              </div>
            )}

            {/* 2 photos — 50/50 side-by-side */}
            {mediaUrls.length === 2 && (
              <div className="flex gap-px" style={{ maxHeight: 420 }}>
                {mediaUrls.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative flex-1 bg-stone-100 overflow-hidden cursor-pointer"
                    onClick={() => window.open(url, '_blank')}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Photo ${idx + 1}`}
                      className="w-full h-full object-cover hover:brightness-95 transition-all"
                      style={{ minHeight: 260, maxHeight: 420 }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* 3 photos — Facebook collage: large hero left (60%) + 2 stacked right */}
            {mediaUrls.length === 3 && (
              <div className="flex gap-px" style={{ maxHeight: 460 }}>
                <div
                  className="relative bg-stone-100 overflow-hidden cursor-pointer"
                  style={{ flex: '0 0 60%' }}
                  onClick={() => window.open(mediaUrls[0], '_blank')}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaUrls[0]}
                    alt="Photo 1"
                    className="w-full h-full object-cover hover:brightness-95 transition-all"
                    style={{ minHeight: 300, maxHeight: 460 }}
                  />
                </div>
                <div className="flex flex-col gap-px flex-1">
                  {mediaUrls.slice(1, 3).map((url, idx) => (
                    <div
                      key={idx}
                      className="relative flex-1 bg-stone-100 overflow-hidden cursor-pointer"
                      onClick={() => window.open(url, '_blank')}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Photo ${idx + 2}`}
                        className="w-full h-full object-cover hover:brightness-95 transition-all"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4+ photos — full-width hero + 3-column thumbnail strip */}
            {mediaUrls.length >= 4 && (
              <div className="flex flex-col gap-px">
                <div
                  className="relative w-full bg-stone-100 overflow-hidden cursor-pointer"
                  onClick={() => window.open(mediaUrls[0], '_blank')}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaUrls[0]}
                    alt="Photo 1"
                    className="w-full object-cover hover:brightness-95 transition-all"
                    style={{ maxHeight: 360, display: 'block' }}
                  />
                </div>
                <div className="flex gap-px" style={{ height: 150 }}>
                  {mediaUrls.slice(1, 4).map((url, idx) => (
                    <div
                      key={idx}
                      className="relative flex-1 bg-stone-100 overflow-hidden cursor-pointer"
                      onClick={() => window.open(url, '_blank')}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Photo ${idx + 2}`}
                        className="w-full h-full object-cover hover:brightness-95 transition-all"
                      />
                      {idx === 2 && mediaUrls.length > 4 && (
                        <div className="absolute inset-0 bg-black/55 flex items-center justify-center pointer-events-none">
                          <span className="text-white font-bold text-xl">+{mediaUrls.length - 4}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Engagement Stats Row (Only shown if likeCount > 0 or commentCount > 0) */}
        {(likeCount > 0 || commentCount > 0) && (
          <div className="flex items-center justify-between px-4 py-2 text-xs text-stone-500 border-t border-stone-100">
            <div className="flex items-center gap-1.5">
              {likeCount > 0 && (
                <span className="inline-flex items-center gap-1 font-medium text-stone-700">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white">
                    <Heart className="h-2.5 w-2.5 fill-white text-white" />
                  </span>
                  <span>{likeCount}</span>
                </span>
              )}
            </div>
            <div>
              {commentCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (!comments && onFetchComments) onFetchComments();
                  }}
                  className="hover:underline text-stone-500"
                >
                  {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3-Column Action Buttons: Like, Comment, Share */}
        <div className="grid grid-cols-3 border-t border-stone-100 px-2 py-1 text-xs">
          {/* Like */}
          <button
            type="button"
            onClick={onToggleLike}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 font-semibold transition-colors ${
              isLiked
                ? 'text-rose-600 bg-rose-50/50'
                : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
            }`}
          >
            <Heart className={`h-4 w-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span>Like</span>
          </button>

          {/* Comment */}
          <button
            type="button"
            onClick={() => {
              if (!comments && onFetchComments) onFetchComments();
              setTimeout(() => commentInputRef.current?.focus(), 50);
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg py-2 font-semibold text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Comment</span>
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={handleCopyPost}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg py-2 font-semibold text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors"
          >
            <Share2 className="h-4 w-4" />
            <span>{copiedPost ? 'Copied!' : 'Share'}</span>
          </button>
        </div>

        {/* Inline Comments Section */}
        <div className="border-t border-stone-100 bg-stone-50/40 px-4 py-3 space-y-2.5">
          {/* View all comments button */}
          {commentCount > (comments?.length ?? 0) && (
            <button
              type="button"
              onClick={() => {
                if (onFetchComments) onFetchComments();
              }}
              disabled={isLoadingComments}
              className="text-xs font-semibold text-stone-500 hover:text-stone-900 hover:underline block"
            >
              {isLoadingComments
                ? 'Loading comments...'
                : `View all ${commentCount} comments`}
            </button>
          )}

          {/* Render Loaded Comments */}
          {comments && comments.length > 0 && (
            <div className="space-y-2">
              {comments.map((comment) => {
                const commentAuthor = comment.author?.display_name || 'Member';
                const commentTime = formatRelativeTime(comment.created_at);
                return (
                  <div key={comment.id} className="flex items-start gap-2 text-xs">
                    <Avatar url={comment.author?.avatar_url} name={commentAuthor} size="sm" />
                    <div className="max-w-[88%] rounded-2xl bg-stone-100/90 px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-stone-900">{commentAuthor}</span>
                        <span className="text-[10px] text-stone-400">{commentTime}</span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-stone-800 text-xs leading-relaxed">
                        {comment.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Inline Comment Input Box */}
          {isMember ? (
            <form onSubmit={handleInlineCommentSubmit} className="flex items-center gap-2 pt-0.5">
              <Avatar
                url={currentUser?.avatar_url}
                name={currentUser?.display_name || 'You'}
                size="sm"
              />
              <div className="relative flex-1 flex items-center bg-stone-100 rounded-full px-3 py-1.5 focus-within:ring-2 focus-within:ring-stone-400 focus-within:bg-white border border-transparent focus-within:border-stone-300 transition-all">
                <input
                  ref={commentInputRef}
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  disabled={isSubmittingComment}
                  className="w-full bg-transparent text-xs text-stone-950 placeholder-stone-400 focus:outline-none pr-6"
                />
                {commentText.trim() && (
                  <button
                    type="submit"
                    disabled={isSubmittingComment}
                    className="absolute right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-stone-900 text-white hover:bg-black transition-colors disabled:opacity-50"
                    title="Post comment"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                )}
              </div>
            </form>
          ) : (
            <p className="text-xs text-stone-400 italic pt-0.5">
              Join this community to leave a comment.
            </p>
          )}
        </div>
      </article>
    );
  }

  // 2. Polls
  if (item.itemType === 'poll') {
    const poll = item.data;
    const hasVoted = Boolean(votedOption);
    return (
      <article className={`space-y-3 rounded-2xl ${cardBgClass} p-4`}>
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
            Poll
          </span>
          <span className="text-xs text-stone-400">{time}</span>
        </div>
        <h3 className="font-bold text-stone-900 text-sm">{poll.question}</h3>
        <div className="space-y-1.5">
          {poll.options.map((opt) => {
            const isSelected = votedOption === opt.id || opt.viewer_voted;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={hasVoted || votingLoading || !isMember}
                onClick={() => onVote(poll.id, opt.id)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-medium transition-all ${
                  isSelected
                    ? 'border-stone-900 bg-stone-100 font-bold text-stone-900 shadow-2xs'
                    : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <CheckCircle2 className="h-4 w-4 text-stone-900" />}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-stone-400">{poll.total_votes ?? 0} votes recorded</p>
      </article>
    );
  }

  // 3. Events
  if (item.itemType === 'event') {
    const event = item.data;
    const date = new Date(event.starts_at);
    const isGoing = rsvpStatus === 'going';
    const eventCover = event.cover_image_url || extractMediaUrl(event.description || '');

    return (
      <article className={`space-y-3 rounded-2xl ${cardBgClass} p-4`}>
        {eventCover && (
          <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-100 aspect-[21/9] max-h-48">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={eventCover} alt={event.title} className="h-full w-full object-cover" />
          </div>
        )}
        <div className="flex items-start gap-3">
          <DateBadge date={date} />
          <div className="min-w-0 flex-1">
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
              Event
            </span>
            <h3 className="font-bold text-stone-900 text-sm mt-1">{event.title}</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {event.going_count ?? 0} attending
            </p>
          </div>
          {isMember && (
            <button
              type="button"
              disabled={rsvpLoading}
              onClick={() => onRsvp(event.id, isGoing ? 'declined' : 'going')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                isGoing
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              {isGoing ? '✓ Going' : 'RSVP'}
            </button>
          )}
        </div>
        {event.description && <p className="line-clamp-2 text-xs text-stone-600">{stripImageMarkdown(event.description)}</p>}
      </article>
    );
  }

  // 4. Marketplace
  if (item.itemType === 'listing') {
    const listing = item.data;
    const canMessage = isMember && listing.seller_id !== currentUserId;
    const listingImage = listing.image_urls?.[0];

    return (
      <article className={`space-y-3 rounded-2xl ${cardBgClass} p-4`}>
        {listingImage && (
          <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-100 aspect-video max-h-60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={listingImage} alt={listing.title} className="h-full w-full object-cover" />
            <span className="absolute top-2.5 right-2.5 rounded-lg bg-black/80 px-2.5 py-1 text-xs font-bold text-white shadow-xs backdrop-blur-xs">
              {formatPrice(listing)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            Marketplace
          </span>
          {!listingImage && (
            <span className="text-sm font-bold text-stone-900">{formatPrice(listing)}</span>
          )}
        </div>
        <Link href={`/circles/${circle.slug}/marketplace/${listing.id}`} className="block group">
          <h3 className="font-bold text-stone-900 group-hover:underline text-sm">{listing.title}</h3>
          {listing.description && (
            <p className="mt-1 line-clamp-2 text-xs text-stone-600">{listing.description}</p>
          )}
        </Link>
        <div className="flex items-center justify-between border-t border-stone-100 pt-2">
          {listing.location ? (
            <span className="inline-flex items-center gap-1 text-xs text-stone-500">
              <MapPin className="h-3.5 w-3.5" />
              {listing.location}
            </span>
          ) : (
            <span />
          )}
          {canMessage && (
            <button
              type="button"
              onClick={() => onInquire(listing)}
              className="rounded-lg border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              Message Seller
            </button>
          )}
        </div>
      </article>
    );
  }

  // 5. Courses
  if (item.itemType === 'course') {
    const course = item.data;
    const href = `/circles/${circle.slug}/courses/${course.id}`;
    return (
      <article className={`space-y-3 rounded-2xl ${cardBgClass} p-4`}>
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
            Course
          </span>
          <span className="text-xs text-stone-400">{time}</span>
        </div>
        <Link href={href} className="block group">
          <h3 className="font-bold text-stone-900 group-hover:underline text-sm">{course.title}</h3>
          {course.description && (
            <p className="mt-1 line-clamp-2 text-xs text-stone-600">{course.description}</p>
          )}
        </Link>
      </article>
    );
  }

  // 6. Projects, Causes, and Resources
  if (item.itemType === 'project' || item.itemType === 'cause' || item.itemType === 'resource') {
    return (
      <article className={`space-y-2 rounded-2xl ${cardBgClass} p-4`}>
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-700 uppercase">
            {item.itemType}
          </span>
          <span className="text-xs text-stone-400">{time}</span>
        </div>
        <h3 className="font-bold text-stone-900 text-sm">
          {'title' in item.data ? item.data.title : 'name' in item.data ? item.data.name : 'Update'}
        </h3>
      </article>
    );
  }

  return null;
}

function DateBadge({ date }: { date: Date }) {
  return (
    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-stone-100 text-stone-900 border border-stone-200">
      <span className="text-[9px] font-bold uppercase leading-none text-stone-500">
        {date.toLocaleString('en-US', { month: 'short' })}
      </span>
      <span className="mt-0.5 text-sm font-extrabold leading-none">{date.getDate()}</span>
    </div>
  );
}

function Avatar({
  url,
  name,
  size = 'md',
}: {
  url?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'h-7 w-7 text-[10px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-10 w-10 text-xs',
  }[size];

  const initials = (name || 'Member')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`flex ${sizeClasses} shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 border border-stone-200/80 font-bold text-stone-600`}
    >
      {url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={url} alt={name ?? ''} className="h-full w-full object-cover" />
      ) : initials ? (
        <span>{initials}</span>
      ) : (
        <User className="h-4 w-4 text-stone-400" />
      )}
    </div>
  );
}
