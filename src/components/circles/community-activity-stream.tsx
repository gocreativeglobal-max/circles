'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, MapPin, MessageSquare, Pin, Plus, User, Users } from 'lucide-react';
import { Circle, CircleEventItem, MarketplaceListingItem } from '@/types/domain';
import { ActivityStreamItem } from '@/features/circles/activity-stream';
import { DirectMessageDrawer } from '@/components/messages/direct-message-drawer';

export interface CommunityActivityStreamProps {
  circle: Circle;
  initialItems: ActivityStreamItem[];
  upcomingEvents: CircleEventItem[];
  featuredListings: MarketplaceListingItem[];
  enabledCapabilityKeys: string[];
  currentUserId?: string | null;
  isMember: boolean;
}

type StreamFilter = 'all' | 'posts' | 'marketplace' | 'events' | 'polls';

const FILTERS: Array<{ key: StreamFilter; label: string; capability?: string }> = [
  { key: 'all', label: 'All' },
  { key: 'posts', label: 'Posts', capability: 'discussions' },
  { key: 'marketplace', label: 'Listings', capability: 'marketplace' },
  { key: 'events', label: 'Events', capability: 'events' },
  { key: 'polls', label: 'Polls', capability: 'polls_decisions' },
];

const ITEM_TYPE_BY_FILTER: Record<Exclude<StreamFilter, 'all'>, ActivityStreamItem['itemType']> = {
  posts: 'post',
  marketplace: 'listing',
  events: 'event',
  polls: 'poll',
};

function formatPrice(listing: MarketplaceListingItem): string {
  if (listing.price_amount === null || listing.price_amount === undefined) return 'Free';
  const amount = Number(listing.price_amount);
  const text = `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
  return listing.pricing_unit && listing.pricing_unit !== 'fixed' ? `${text}/${listing.pricing_unit}` : text;
}

export function CommunityActivityStream({
  circle,
  initialItems,
  upcomingEvents,
  featuredListings,
  enabledCapabilityKeys,
  currentUserId,
  isMember,
}: CommunityActivityStreamProps) {
  const [items] = useState<ActivityStreamItem[]>(initialItems);
  const [activeFilter, setActiveFilter] = useState<StreamFilter>('all');
  const [dmDrawerOpen, setDmDrawerOpen] = useState(false);
  const [activeDmConvoId, setActiveDmConvoId] = useState<string | null>(null);
  const [votedPolls, setVotedPolls] = useState<Record<string, string>>({});
  const [votingLoading, setVotingLoading] = useState<Record<string, boolean>>({});
  const [rsvpStatuses, setRsvpStatuses] = useState<Record<string, string>>({});
  const [rsvpLoading, setRsvpLoading] = useState<Record<string, boolean>>({});

  const visibleFilters = FILTERS.filter(
    (f) =>
      !f.capability ||
      enabledCapabilityKeys.includes(f.capability) ||
      (f.capability === 'marketplace' && enabledCapabilityKeys.includes('listings_discovery'))
  );

  const visibleItems = useMemo(() => {
    if (activeFilter === 'all') return items;
    return items.filter((i) => i.itemType === ITEM_TYPE_BY_FILTER[activeFilter]);
  }, [items, activeFilter]);

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
      if (res.ok) setVotedPolls((prev) => ({ ...prev, [pollId]: optionId }));
    } catch (err) {
      console.error('Failed to vote in poll:', err);
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
      if (res.ok) setRsvpStatuses((prev) => ({ ...prev, [eventId]: status }));
    } catch (err) {
      console.error('Failed to RSVP:', err);
    } finally {
      setRsvpLoading((prev) => ({ ...prev, [eventId]: false }));
    }
  }

  const showEvents = enabledCapabilityKeys.includes('events');
  const showListings =
    enabledCapabilityKeys.includes('marketplace') || enabledCapabilityKeys.includes('listings_discovery');

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* Feed */}
      <div className="space-y-4 lg:col-span-8">
        <div className="flex items-center justify-between gap-4 border-b border-stone-200">
          <div className="-mb-px flex gap-5 overflow-x-auto">
            {visibleFilters.map((tab) => {
              const active = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key)}
                  className={`whitespace-nowrap border-b-2 pb-2.5 text-sm transition-colors ${
                    active
                      ? 'border-[#1B4332] font-medium text-stone-900'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {isMember && (
            <Link
              href={`/circles/${circle.slug}/discussions`}
              className="mb-2 inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#1B4332] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#2D6A4F]"
            >
              <Plus className="h-4 w-4" />
              New post
            </Link>
          )}
        </div>

        {visibleItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-200 bg-white py-16 text-center text-sm text-stone-500">
            Nothing here yet.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleItems.map((item) => (
              <StreamCard
                key={item.id}
                item={item}
                circle={circle}
                currentUserId={currentUserId}
                isMember={isMember}
                onInquire={handleInquireListing}
                onVote={handleVotePoll}
                votedOption={votedPolls[item.data.id]}
                votingLoading={votingLoading[item.data.id]}
                onRsvp={handleRsvp}
                rsvpStatus={rsvpStatuses[item.data.id]}
                rsvpLoading={rsvpLoading[item.data.id]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right rail */}
      <aside className="space-y-4 lg:col-span-4">
        {circle.description && (
          <RailCard title="About">
            <p className="text-sm leading-relaxed text-stone-600">{circle.description}</p>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-stone-500">
              <Users className="h-3.5 w-3.5" />
              {circle.member_count ?? 1} members
            </p>
          </RailCard>
        )}

        {showEvents && upcomingEvents.length > 0 && (
          <RailCard title="Upcoming" href={`/circles/${circle.slug}/events`}>
            <ul className="space-y-3">
              {upcomingEvents.map((evt) => {
                const date = new Date(evt.starts_at);
                return (
                  <li key={evt.id} className="flex items-center gap-3">
                    <DateBadge date={date} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-stone-900">{evt.title}</p>
                      <p className="text-xs text-stone-500">
                        {date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </RailCard>
        )}

        {showListings && featuredListings.length > 0 && (
          <RailCard title="Listings" href={`/circles/${circle.slug}/marketplace`}>
            <ul className="space-y-2.5">
              {featuredListings.map((listing) => (
                <li key={listing.id}>
                  <Link
                    href={`/circles/${circle.slug}/marketplace/${listing.id}`}
                    className="flex items-center justify-between gap-3 text-sm hover:text-stone-900"
                  >
                    <span className="truncate text-stone-700">{listing.title}</span>
                    <span className="shrink-0 font-medium text-stone-900">{formatPrice(listing)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </RailCard>
        )}
      </aside>

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

function RailCard({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
        {href && (
          <Link href={href} className="text-xs text-stone-500 hover:text-stone-900">
            See all
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function DateBadge({ date }: { date: Date }) {
  return (
    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-[#F4F3EE] text-[#1B4332]">
      <span className="text-[9px] font-semibold uppercase leading-none">
        {date.toLocaleString('en-US', { month: 'short' })}
      </span>
      <span className="mt-0.5 text-sm font-semibold leading-none">{date.getDate()}</span>
    </div>
  );
}

function Avatar({ url, name }: { url?: string | null; name?: string | null }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100">
      {url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={url} alt={name ?? ''} className="h-full w-full object-cover" />
      ) : (
        <User className="h-4 w-4 text-stone-400" />
      )}
    </div>
  );
}

function CardHeader({
  avatarUrl,
  name,
  meta,
  right,
}: {
  avatarUrl?: string | null;
  name: string;
  meta: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar url={avatarUrl} name={name} />
        <div className="min-w-0 text-sm">
          <span className="font-medium text-stone-900">{name}</span>
          <span className="ml-1.5 text-xs text-stone-400">{meta}</span>
        </div>
      </div>
      {right}
    </div>
  );
}

interface StreamCardProps {
  item: ActivityStreamItem;
  circle: Circle;
  currentUserId?: string | null;
  isMember: boolean;
  onInquire: (listing: MarketplaceListingItem) => void;
  onVote: (pollId: string, optionId: string) => void;
  votedOption?: string;
  votingLoading?: boolean;
  onRsvp: (eventId: string, status: 'going' | 'interested' | 'declined') => void;
  rsvpStatus?: string;
  rsvpLoading?: boolean;
}

const cardClass = 'space-y-3 rounded-xl border border-stone-200 bg-white p-4 transition-colors hover:border-stone-300';
const ghostBtn =
  'rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50';

function StreamCard({
  item,
  circle,
  currentUserId,
  isMember,
  onInquire,
  onVote,
  votedOption,
  votingLoading,
  onRsvp,
  rsvpStatus,
  rsvpLoading,
}: StreamCardProps) {
  const time = new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });

  if (item.itemType === 'post') {
    const post = item.data;
    const href = `/circles/${circle.slug}/discussions/${post.id}`;
    return (
      <article className={cardClass}>
        <CardHeader
          avatarUrl={post.author?.avatar_url}
          name={post.author?.display_name || 'Member'}
          meta={`${post.space?.name ? `in ${post.space.name} · ` : ''}${time}`}
          right={post.is_pinned ? <Pin className="h-3.5 w-3.5 text-stone-400" aria-label="Pinned" /> : undefined}
        />
        <Link href={href} className="block">
          <h3 className="font-semibold text-stone-900">{post.title}</h3>
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">{post.body}</p>
        </Link>
        <Link href={href} className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900">
          <MessageSquare className="h-3.5 w-3.5" />
          {post.comment_count ?? 0}
        </Link>
      </article>
    );
  }

  if (item.itemType === 'listing') {
    const listing = item.data;
    const canMessage = isMember && listing.seller_id !== currentUserId;
    return (
      <article className={cardClass}>
        <CardHeader
          avatarUrl={listing.seller?.avatar_url}
          name={listing.seller?.display_name || 'Member'}
          meta={`listed · ${time}`}
          right={<span className="text-sm font-semibold text-stone-900">{formatPrice(listing)}</span>}
        />
        <Link href={`/circles/${circle.slug}/marketplace/${listing.id}`} className="block">
          <h3 className="font-semibold text-stone-900">{listing.title}</h3>
          {listing.description && (
            <p className="mt-1 line-clamp-2 text-sm text-stone-600">{listing.description}</p>
          )}
        </Link>
        <div className="flex items-center justify-between">
          {listing.location ? (
            <span className="inline-flex items-center gap-1 text-xs text-stone-500">
              <MapPin className="h-3 w-3" />
              {listing.location}
            </span>
          ) : (
            <span />
          )}
          {canMessage && (
            <button type="button" onClick={() => onInquire(listing)} className={ghostBtn}>
              Message
            </button>
          )}
        </div>
      </article>
    );
  }

  if (item.itemType === 'event') {
    const event = item.data;
    const date = new Date(event.starts_at);
    const isGoing = rsvpStatus === 'going';
    return (
      <article className={cardClass}>
        <div className="flex items-start gap-3">
          <DateBadge date={date} />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-stone-900">{event.title}</h3>
            <p className="text-xs text-stone-500">
              {date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {event.going_count ?? 0} going
            </p>
          </div>
          {isMember && (
            <button
              type="button"
              disabled={rsvpLoading}
              onClick={() => onRsvp(event.id, isGoing ? 'declined' : 'going')}
              className={
                isGoing
                  ? 'inline-flex items-center gap-1 rounded-lg bg-[#F4F3EE] px-3 py-1.5 text-xs font-medium text-[#1B4332]'
                  : ghostBtn
              }
            >
              {isGoing && <CheckCircle2 className="h-3.5 w-3.5" />}
              {isGoing ? 'Going' : 'RSVP'}
            </button>
          )}
        </div>
        {event.description && <p className="line-clamp-2 text-sm text-stone-600">{event.description}</p>}
      </article>
    );
  }

  if (item.itemType === 'poll') {
    const poll = item.data;
    const hasVoted = Boolean(votedOption);
    return (
      <article className={cardClass}>
        <h3 className="font-semibold text-stone-900">{poll.question}</h3>
        <div className="space-y-1.5">
          {poll.options.map((opt) => {
            const isSelected = votedOption === opt.id || opt.viewer_voted;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={hasVoted || votingLoading || !isMember}
                onClick={() => onVote(poll.id, opt.id)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  isSelected
                    ? 'border-[#2D6A4F] bg-[#F4F3EE] font-medium text-[#1B4332]'
                    : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                {opt.label}
                {isSelected && <CheckCircle2 className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-stone-400">
          {poll.total_votes ?? 0} votes · {time}
        </p>
      </article>
    );
  }

  return null;
}
