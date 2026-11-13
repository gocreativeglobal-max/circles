'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
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
  CourseItem,
  FundraisingCampaignItem,
  MarketplaceListingItem,
  UserProfile,
} from '@/types/domain';
import { ActivityStreamItem } from '@/features/circles/activity-stream';
import { DirectMessageDrawer } from '@/components/messages/direct-message-drawer';
import { getEffectiveBannerUrl } from '@/lib/theme/utils';

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

function extractMediaUrl(body: string): string | null {
  const mdMatch = body.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
  if (mdMatch) return mdMatch[1];
  const urlMatch = body.match(/https?:\/\/[^\s]+\.(png|jpe?g|webp|gif|svg)/i);
  if (urlMatch) return urlMatch[0];
  return null;
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
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [dmDrawerOpen, setDmDrawerOpen] = useState(false);
  const [activeDmConvoId, setActiveDmConvoId] = useState<string | null>(null);
  const [votedPolls, setVotedPolls] = useState<Record<string, string>>({});
  const [votingLoading, setVotingLoading] = useState<Record<string, boolean>>({});
  const [rsvpStatuses, setRsvpStatuses] = useState<Record<string, string>>({});
  const [rsvpLoading, setRsvpLoading] = useState<Record<string, boolean>>({});
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
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
    if (!composerText.trim() || isSubmittingPost || !isMember) return;
    setIsSubmittingPost(true);
    try {
      const res = await fetch(`/api/circles/${circle.id}/discussions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: composerText.trim().split('\n')[0].slice(0, 100),
          body: composerText.trim(),
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
        }
      }
    } catch (err) {
      console.error('Failed to create quick post:', err);
    } finally {
      setIsSubmittingPost(false);
    }
  }

  function handleToggleLike(postId: string, initialCount: number) {
    const isLiked = likedPosts[postId] ?? false;
    const current = likeCounts[postId] ?? initialCount;
    setLikedPosts((prev) => ({ ...prev, [postId]: !isLiked }));
    setLikeCounts((prev) => ({ ...prev, [postId]: isLiked ? Math.max(0, current - 1) : current + 1 }));
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
  const isFrosted = circle.theme_settings?.cardStyle === 'frosted';
  const cardBgClass = isFrosted
    ? 'border border-white/60 bg-white/80 backdrop-blur-md shadow-sm'
    : 'border border-stone-200 bg-white shadow-sm';

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
                className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/20 bg-stone-900 shadow-2xl backdrop-blur-md sm:h-24 sm:w-24"
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

                {/* Real Action Buttons for Enabled Capabilities */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => setComposerText((prev) => (prev ? prev : 'Check out this photo: '))}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors"
                    >
                      <Camera className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Photo</span>
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
                    disabled={!composerText.trim() || isSubmittingPost}
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
              {visibleItems.map((item) => (
                <ActivityFeedCard
                  key={item.id}
                  item={item}
                  circle={circle}
                  currentUserId={currentUserId}
                  isMember={isMember}
                  isLiked={likedPosts[item.id] ?? (item.itemType === 'post' ? Boolean(item.data.viewer_has_liked) : false)}
                  likeCount={
                    likeCounts[item.id] ?? (item.itemType === 'post' ? item.data.reaction_count ?? 0 : 0)
                  }
                  onToggleLike={() =>
                    handleToggleLike(
                      item.id,
                      item.itemType === 'post' ? item.data.reaction_count ?? 0 : 0
                    )
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
              ))}
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
  isMember: boolean;
  isLiked: boolean;
  likeCount: number;
  onToggleLike: () => void;
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
  isMember,
  isLiked,
  likeCount,
  onToggleLike,
  onInquire,
  onVote,
  votedOption,
  votingLoading,
  onRsvp,
  rsvpStatus,
  rsvpLoading,
  cardBgClass = 'border border-stone-200 bg-white shadow-sm',
}: ActivityFeedCardProps) {
  const time = new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });

  // 1. Discussion Posts
  if (item.itemType === 'post') {
    const post = item.data;
    const href = `/circles/${circle.slug}/discussions/${post.id}`;
    const mediaUrl = extractMediaUrl(post.body);
    const authorName = post.author?.display_name || 'Member';
    const authorUsername = post.author?.username ? `@${post.author.username}` : null;

    return (
      <article className={`space-y-3 rounded-2xl ${cardBgClass} p-4 transition-all hover:border-stone-300`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar url={post.author?.avatar_url} name={authorName} />
            <div className="min-w-0 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-stone-900 truncate">{authorName}</span>
                {post.space?.name && (
                  <span className="text-xs text-stone-400">in #{post.space.name}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-stone-400">
                {authorUsername && <span>{authorUsername}</span>}
                {authorUsername && <span>•</span>}
                <span>{time}</span>
              </div>
            </div>
          </div>
          <button type="button" className="text-stone-400 hover:text-stone-600">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Post Content */}
        <Link href={href} className="block group">
          {post.title && <h3 className="font-bold text-stone-900 group-hover:underline text-sm">{post.title}</h3>}
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-stone-700">{post.body}</p>
        </Link>

        {/* Only show image container if the post actually contains a media image */}
        {mediaUrl && (
          <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-100 max-h-80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl} alt="Post attachment" className="h-full w-full object-cover" />
          </div>
        )}

        {/* Real Engagement Bar */}
        <div className="flex items-center justify-between border-t border-stone-100 pt-2 text-stone-500">
          <button
            type="button"
            onClick={onToggleLike}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${
              isLiked ? 'text-rose-500' : 'hover:text-rose-500'
            }`}
          >
            <Heart className={`h-4 w-4 ${isLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span>{likeCount}</span>
          </button>

          <Link
            href={href}
            className="inline-flex items-center gap-1.5 text-xs font-semibold hover:text-indigo-600 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            <span>{post.comment_count ?? 0}</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                navigator.clipboard.writeText(`${window.location.origin}${href}`);
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold hover:text-stone-900 transition-colors"
          >
            <Share2 className="h-4 w-4" />
            <span>Share</span>
          </button>
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
    return (
      <article className={`space-y-3 rounded-2xl ${cardBgClass} p-4`}>
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
        {event.description && <p className="line-clamp-2 text-xs text-stone-600">{event.description}</p>}
      </article>
    );
  }

  // 4. Marketplace
  if (item.itemType === 'listing') {
    const listing = item.data;
    const canMessage = isMember && listing.seller_id !== currentUserId;
    return (
      <article className={`space-y-3 rounded-2xl ${cardBgClass} p-4`}>
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            Marketplace
          </span>
          <span className="text-sm font-bold text-stone-900">{formatPrice(listing)}</span>
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

function Avatar({ url, name }: { url?: string | null; name?: string | null }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 border border-stone-200">
      {url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={url} alt={name ?? ''} className="h-full w-full object-cover" />
      ) : (
        <User className="h-4 w-4 text-stone-400" />
      )}
    </div>
  );
}
