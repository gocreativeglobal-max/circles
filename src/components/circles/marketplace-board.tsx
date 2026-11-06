'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  Calendar,
  Check,
  Download,
  Edit3,
  ExternalLink,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Send,
  User,
  X,
  Zap,
} from 'lucide-react';
import {
  CircleRole,
  ListingInquiryItem,
  MarketplaceListingItem,
  ServiceBookingItem,
} from '@/types/domain';
import { DirectMessageDrawer } from '@/components/messages/direct-message-drawer';
import {
  generateAvailableSlots,
  generateBookingIcs,
} from '@/features/marketplace/calendar-utils';
import { formatListingPrice } from '@/features/marketplace/listing-helpers';
import { UniversalListingWizardModal } from '@/components/circles/universal-listing-wizard-modal';

export interface MarketplaceBoardProps {
  circleId: string;
  circleSlug?: string;
  initialListings: MarketplaceListingItem[];
  initialInquiries: ListingInquiryItem[];
  initialBookings: ServiceBookingItem[];
  isMember: boolean;
  currentUserId?: string | null;
  currentUserRole?: CircleRole | null;
}

const TYPE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'product', label: 'Goods' },
  { key: 'service', label: 'Services' },
  { key: 'rental', label: 'Rentals' },
  { key: 'housing', label: 'Housing' },
  { key: 'job', label: 'Jobs' },
];

export function MarketplaceBoard({
  circleId,
  circleSlug,
  initialListings,
  initialInquiries,
  initialBookings,
  isMember,
  currentUserId,
  currentUserRole,
}: MarketplaceBoardProps) {
  const [listings, setListings] = useState<MarketplaceListingItem[]>(initialListings);
  const [inquiries, setInquiries] = useState<ListingInquiryItem[]>(initialInquiries);
  const [bookings, setBookings] = useState<ServiceBookingItem[]>(initialBookings);

  const [activeTab, setActiveTab] = useState<'browse' | 'saved' | 'activity'>('browse');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');

  const [wizardModalOpen, setWizardModalOpen] = useState(false);
  const [editingListingItem, setEditingListingItem] = useState<MarketplaceListingItem | null>(null);
  const [selectedListing, setSelectedListing] = useState<MarketplaceListingItem | null>(null);

  const [inquiryListing, setInquiryListing] = useState<MarketplaceListingItem | null>(null);
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [sendingInquiry, setSendingInquiry] = useState(false);

  const [bookingListing, setBookingListing] = useState<MarketplaceListingItem | null>(null);
  const [bookingType, setBookingType] = useState<'service' | 'rental'>('service');
  const [bookingStartsAt, setBookingStartsAt] = useState('');
  const [bookingEndsAt, setBookingEndsAt] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [selectedBookingDate, setSelectedBookingDate] = useState('');
  const [manualTimeOverride, setManualTimeOverride] = useState(false);

  const [activityRoleFilter, setActivityRoleFilter] = useState<'all' | 'received' | 'sent'>('all');
  const [inquiryReplyText, setInquiryReplyText] = useState<Record<string, string>>({});

  const [dmDrawerOpen, setDmDrawerOpen] = useState(false);
  const [activeDmConvoId, setActiveDmConvoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isStaff = currentUserRole ? ['owner', 'admin', 'moderator'].includes(currentUserRole) : false;

  function handleOpenCreate() {
    setEditingListingItem(null);
    setWizardModalOpen(true);
  }

  function handleOpenEdit(item: MarketplaceListingItem) {
    setEditingListingItem(item);
    setWizardModalOpen(true);
  }

  function handleListingSaved(savedListing: MarketplaceListingItem, isEdit: boolean) {
    if (isEdit) {
      setListings((prev) => prev.map((l) => (l.id === savedListing.id ? savedListing : l)));
      if (selectedListing?.id === savedListing.id) setSelectedListing(savedListing);
    } else {
      setListings((prev) => [savedListing, ...prev]);
    }
  }

  async function handleQuickStatusUpdate(
    listingId: string,
    newStatus: 'published' | 'reserved' | 'sold' | 'archived'
  ) {
    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status.');
      setListings((prev) => prev.map((l) => (l.id === listingId ? data.listing : l)));
      if (selectedListing?.id === listingId) setSelectedListing(data.listing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status.');
    }
  }

  async function handleToggleSave(listingId: string) {
    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_save', listingId }),
      });
      const data = await res.json();
      if (res.ok) {
        setListings((prev) =>
          prev.map((l) => (l.id === listingId ? { ...l, viewer_has_saved: data.saved } : l))
        );
        if (selectedListing?.id === listingId) {
          setSelectedListing((prev) => (prev ? { ...prev, viewer_has_saved: data.saved } : null));
        }
      }
    } catch {
      // Ignore
    }
  }

  async function handleOpenInquiry(item: MarketplaceListingItem) {
    if (item.seller_id && item.seller_id !== currentUserId) {
      try {
        const res = await fetch(`/api/circles/${circleId}/messages/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUserId: item.seller_id, listingId: item.id }),
        });
        if (res.ok) {
          const data = await res.json();
          setActiveDmConvoId(data.conversation.id);
          setDmDrawerOpen(true);
          return;
        }
      } catch {
        // Fall back to inquiry modal
      }
    }
    setInquiryListing(item);
    setInquiryMessage('');
  }

  async function handleSendInquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!inquiryListing || !inquiryMessage.trim()) return;
    setSendingInquiry(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'inquiry',
          listingId: inquiryListing.id,
          message: inquiryMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send inquiry.');
      setInquiries((prev) => [data.inquiry, ...prev]);
      setInquiryListing(null);
      setInquiryMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send inquiry.');
    } finally {
      setSendingInquiry(false);
    }
  }

  const availableBookingDates = useMemo(() => {
    if (!bookingListing) return [];
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const opDays =
      bookingListing.availability_schedule?.days &&
      bookingListing.availability_schedule.days.length > 0
        ? bookingListing.availability_schedule.days
        : [1, 2, 3, 4, 5];

    const dates: { dateStr: string; label: string; weekday: string; isOperating: boolean }[] = [];
    for (let i = 1; i <= 14; i++) {
      const d = new Date(Date.now() + i * 86400_000);
      const dateStr = d.toISOString().slice(0, 10);
      const dayOfWeek = d.getDay();
      dates.push({
        dateStr,
        weekday: daysOfWeek[dayOfWeek],
        label: `${months[d.getMonth()]} ${d.getDate()}`,
        isOperating: opDays.includes(dayOfWeek),
      });
    }
    return dates;
  }, [bookingListing]);

  const computedBookingSlots = useMemo(() => {
    if (!bookingListing || !selectedBookingDate) return [];
    const sched = bookingListing.availability_schedule || {
      days: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '17:00',
      slotDurationMinutes: bookingListing.service_duration_minutes || 60,
      bufferMinutes: 0,
    };
    const listingBookings = bookings.filter((b) => b.listing_id === bookingListing.id);
    return generateAvailableSlots(sched, selectedBookingDate, listingBookings);
  }, [bookingListing, selectedBookingDate, bookings]);

  function handleDownloadIcs(booking: ServiceBookingItem) {
    const icsContent = generateBookingIcs(
      booking,
      booking.listing_title || 'Booking',
      circleSlug || 'Circle'
    );
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking-${booking.id.slice(0, 8)}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleOpenBooking(item: MarketplaceListingItem) {
    setBookingListing(item);
    setBookingType(item.listing_type === 'rental' ? 'rental' : 'service');
    const tomorrow = new Date(Date.now() + 86400_000);
    const dateStr = tomorrow.toISOString().slice(0, 10);
    setSelectedBookingDate(dateStr);
    setManualTimeOverride(false);

    const sched = item.availability_schedule || {
      days: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '17:00',
      slotDurationMinutes: item.service_duration_minutes || 60,
      bufferMinutes: 0,
    };
    const listingBookings = bookings.filter((b) => b.listing_id === item.id);
    const slots = generateAvailableSlots(sched, dateStr, listingBookings);
    const firstAvail = slots.find((s) => s.available);
    if (firstAvail) {
      setBookingStartsAt(firstAvail.startsAt.slice(0, 16));
      setBookingEndsAt(firstAvail.endsAt.slice(0, 16));
    } else {
      const now = Date.now();
      setBookingStartsAt(new Date(now + 86400_000).toISOString().slice(0, 16));
      setBookingEndsAt(new Date(now + 90000_000).toISOString().slice(0, 16));
    }
    setBookingNotes('');
  }

  async function handleSendBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingListing) return;
    setSubmittingBooking(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'booking',
          listingId: bookingListing.id,
          bookingType,
          startsAt: new Date(bookingStartsAt).toISOString(),
          endsAt: new Date(bookingEndsAt).toISOString(),
          notes: bookingNotes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit booking.');
      setBookings((prev) => [data.booking, ...prev]);
      setBookingListing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule booking.');
    } finally {
      setSubmittingBooking(false);
    }
  }

  async function handleRespondInquiry(
    inquiryId: string,
    nextStatus: 'responded' | 'accepted' | 'declined' | 'closed'
  ) {
    const responseText = inquiryReplyText[inquiryId]?.trim() || '';
    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond_inquiry',
          inquiryId,
          status: nextStatus,
          sellerResponse: responseText || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update inquiry.');
      setInquiries((prev) => prev.map((inq) => (inq.id === inquiryId ? data.inquiry : inq)));
      setInquiryReplyText((prev) => {
        const next = { ...prev };
        delete next[inquiryId];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond.');
    }
  }

  async function handleUpdateBookingStatus(
    bookingId: string,
    nextStatus: 'approved' | 'rejected' | 'cancelled' | 'completed' | 'returned',
    providerNote?: string
  ) {
    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_booking',
          bookingId,
          status: nextStatus,
          providerNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update booking.');
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? data.booking : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    }
  }

  const visibleListings = useMemo(() => {
    let list = [...listings];
    if (activeTab === 'saved') list = list.filter((l) => l.viewer_has_saved);
    if (filterType !== 'all') list = list.filter((l) => l.listing_type === filterType);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.category.toLowerCase().includes(q) ||
          (l.location || '').toLowerCase().includes(q) ||
          (Array.isArray(l.tags) && l.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    if (sortBy === 'price_asc') {
      list.sort((a, b) => (a.price_amount ?? 0) - (b.price_amount ?? 0));
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => (b.price_amount ?? 0) - (a.price_amount ?? 0));
    } else {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return list;
  }, [listings, activeTab, filterType, searchQuery, sortBy]);

  const filteredInquiries = useMemo(() => {
    if (activityRoleFilter === 'received') return inquiries.filter((i) => i.seller_id === currentUserId);
    if (activityRoleFilter === 'sent') return inquiries.filter((i) => i.buyer_id === currentUserId);
    return inquiries;
  }, [inquiries, activityRoleFilter, currentUserId]);

  const filteredBookings = useMemo(() => {
    if (activityRoleFilter === 'received') return bookings.filter((b) => b.provider_id === currentUserId);
    if (activityRoleFilter === 'sent') return bookings.filter((b) => b.requester_id === currentUserId);
    return bookings;
  }, [bookings, activityRoleFilter, currentUserId]);

  const totalActivityCount = inquiries.length + bookings.length;

  const primaryBtn =
    'inline-flex items-center gap-1.5 rounded-lg bg-[#1B4332] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#2D6A4F] disabled:opacity-50';
  const ghostBtn =
    'inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50';

  return (
    <div className="space-y-5">
      {/* Top bar: tabs + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200">
        <div className="-mb-px flex items-center gap-5">
          <button
            type="button"
            onClick={() => setActiveTab('browse')}
            className={`border-b-2 pb-2.5 text-sm transition-colors ${
              activeTab === 'browse'
                ? 'border-[#1B4332] font-medium text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            All listings
          </button>
          {isMember && (
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className={`border-b-2 pb-2.5 text-sm transition-colors ${
                activeTab === 'saved'
                  ? 'border-[#1B4332] font-medium text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              Saved
            </button>
          )}
          {isMember && (
            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              className={`inline-flex items-center gap-1.5 border-b-2 pb-2.5 text-sm transition-colors ${
                activeTab === 'activity'
                  ? 'border-[#1B4332] font-medium text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <span>Requests</span>
              {totalActivityCount > 0 && (
                <span className="rounded-full bg-stone-200 px-1.5 py-0.2 text-[11px] font-medium text-stone-700">
                  {totalActivityCount}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="mb-2 flex items-center gap-2">
          {isMember && (
            <button
              type="button"
              onClick={() => {
                setActiveDmConvoId(null);
                setDmDrawerOpen(true);
              }}
              className={ghostBtn}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Messages
            </button>
          )}
          {isMember && (
            <button type="button" onClick={handleOpenCreate} className={primaryBtn}>
              <Plus className="h-4 w-4" />
              New listing
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filter row */}
      {activeTab !== 'activity' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1">
            {TYPE_FILTERS.map((t) => {
              const active = filterType === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setFilterType(t.key)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#1B4332] text-white'
                      : 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-44 rounded-lg border border-stone-200 bg-white py-1 pl-8 pr-3 text-xs text-stone-800 placeholder-stone-400 focus:border-[#2D6A4F] focus:outline-none sm:w-56"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-700 focus:outline-none"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low</option>
              <option value="price_desc">Price: high</option>
            </select>
          </div>
        </div>
      )}

      {/* Listings grid */}
      {activeTab !== 'activity' && (
        <>
          {visibleListings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 bg-white py-16 text-center text-sm text-stone-500">
              {activeTab === 'saved' ? 'No saved listings.' : 'No listings yet.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visibleListings.map((item) => {
                const isSeller = currentUserId === item.seller_id;
                const canManage = isSeller || isStaff;
                const hasImage = item.image_urls && item.image_urls.length > 0;
                const specEntries =
                  item.custom_fields && typeof item.custom_fields === 'object'
                    ? Object.entries(item.custom_fields).slice(0, 2)
                    : [];

                return (
                  <article
                    key={item.id}
                    className="flex flex-col justify-between overflow-hidden rounded-xl border border-stone-200 bg-white transition-colors hover:border-stone-300"
                  >
                    <div>
                      {hasImage && (
                        <button
                          type="button"
                          onClick={() => setSelectedListing(item)}
                          className="block h-44 w-full overflow-hidden bg-stone-100 text-left"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.image_urls[0]}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      )}

                      <div className="space-y-2 p-4">
                        <div className="flex items-baseline justify-between gap-2">
                          <Link
                            href={`/circles/${circleSlug}/marketplace/${item.id}`}
                            className="truncate text-sm font-semibold text-stone-900 hover:underline"
                          >
                            {item.title}
                          </Link>
                          <span className="shrink-0 text-sm font-semibold text-[#1B4332]">
                            {formatListingPrice(item)}
                          </span>
                        </div>

                        {item.description && (
                          <p className="line-clamp-2 text-xs leading-relaxed text-stone-600">
                            {item.description}
                          </p>
                        )}

                        {(specEntries.length > 0 || item.location) && (
                          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-stone-500">
                            {specEntries.map(([k, v]) => (
                              <span key={k} className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px]">
                                {k}: {String(v)}
                              </span>
                            ))}
                            {item.location && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-stone-400">
                                <MapPin className="h-3 w-3" />
                                <span className="max-w-[120px] truncate">{item.location}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-stone-100 px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-2 text-xs text-stone-500">
                        {item.seller?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.seller.avatar_url}
                            alt=""
                            className="h-5 w-5 rounded-full object-cover"
                          />
                        ) : (
                          <User className="h-3.5 w-3.5 text-stone-400" />
                        )}
                        <span className="truncate">{item.seller?.display_name || 'Member'}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.status !== 'published' && (
                          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-stone-600">
                            {item.status}
                          </span>
                        )}

                        {isMember && (
                          <button
                            type="button"
                            onClick={() => handleToggleSave(item.id)}
                            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-800"
                            aria-label="Save"
                          >
                            <Bookmark
                              className={`h-3.5 w-3.5 ${
                                item.viewer_has_saved ? 'fill-current text-[#1B4332]' : ''
                              }`}
                            />
                          </button>
                        )}

                        {!isSeller && isMember && item.status === 'published' && (
                          <>
                            {item.action_type === 'link' && item.action_url ? (
                              <a
                                href={item.action_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={ghostBtn}
                              >
                                Open
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : item.action_type === 'booking' ||
                              item.listing_type === 'service' ||
                              item.listing_type === 'rental' ? (
                              <button
                                type="button"
                                onClick={() => handleOpenBooking(item)}
                                className={ghostBtn}
                              >
                                {item.listing_type === 'rental' ? 'Borrow' : 'Book'}
                              </button>
                            ) : item.action_type === 'application' ? (
                              <button
                                type="button"
                                onClick={() => handleOpenInquiry(item)}
                                className={ghostBtn}
                              >
                                Apply
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenInquiry(item)}
                                className={ghostBtn}
                              >
                                Message
                              </button>
                            )}
                          </>
                        )}

                        {canManage && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-800"
                            aria-label="Edit"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Activity tab */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          <div className="flex items-center gap-1">
            {(['all', 'received', 'sent'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setActivityRoleFilter(mode)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize ${
                  activityRoleFilter === mode
                    ? 'bg-[#1B4332] text-white'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Inquiries */}
            <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-stone-900">
                Inquiries ({filteredInquiries.length})
              </h4>

              {filteredInquiries.length === 0 ? (
                <p className="py-6 text-center text-xs text-stone-400">None yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {filteredInquiries.map((inq) => {
                    const isSeller = inq.seller_id === currentUserId;
                    const canReply = isSeller && inq.status === 'open';
                    return (
                      <div key={inq.id} className="space-y-2 rounded-lg border border-stone-200 p-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate font-medium text-stone-900">
                            {inq.listing_title || 'Listing'}
                          </span>
                          <span className="text-stone-400">{inq.status}</span>
                        </div>
                        <p className="text-xs text-stone-700">{inq.message}</p>
                        {inq.seller_response && (
                          <p className="rounded bg-[#F4F3EE] p-2 text-xs text-[#1B4332]">
                            {inq.seller_response}
                          </p>
                        )}
                        {canReply && (
                          <div className="space-y-2 pt-1">
                            <textarea
                              rows={2}
                              value={inquiryReplyText[inq.id] || ''}
                              onChange={(e) =>
                                setInquiryReplyText((prev) => ({
                                  ...prev,
                                  [inq.id]: e.target.value,
                                }))
                              }
                              placeholder="Reply..."
                              className="w-full rounded-lg border border-stone-200 p-2 text-xs"
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleRespondInquiry(inq.id, 'declined')}
                                className={ghostBtn}
                              >
                                Decline
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRespondInquiry(inq.id, 'accepted')}
                                className="rounded-lg bg-[#1B4332] px-3 py-1.5 text-xs font-medium text-white"
                              >
                                Accept
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bookings */}
            <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-stone-900">
                Bookings ({filteredBookings.length})
              </h4>

              {filteredBookings.length === 0 ? (
                <p className="py-6 text-center text-xs text-stone-400">None yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {filteredBookings.map((b) => {
                    const isProvider = b.provider_id === currentUserId;
                    const canReview = isProvider && b.status === 'pending';
                    const isApprovedRental =
                      isProvider && b.status === 'approved' && b.booking_type === 'rental';

                    return (
                      <div key={b.id} className="space-y-2 rounded-lg border border-stone-200 p-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate font-medium text-stone-900">
                            {b.listing_title || 'Listing'}
                          </span>
                          <span className="text-stone-400">{b.status}</span>
                        </div>
                        <p className="text-xs text-stone-500">
                          {new Date(b.starts_at).toLocaleString([], {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </p>
                        {b.notes && <p className="text-xs text-stone-600">{b.notes}</p>}

                        <div className="flex items-center justify-between pt-1">
                          {b.status === 'approved' || b.status === 'completed' ? (
                            <button
                              type="button"
                              onClick={() => handleDownloadIcs(b)}
                              className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900"
                            >
                              <Download className="h-3 w-3" />
                              .ics
                            </button>
                          ) : (
                            <span />
                          )}
                          <div className="flex items-center gap-1.5">
                            {canReview && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateBookingStatus(b.id, 'rejected')}
                                  className={ghostBtn}
                                >
                                  Decline
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateBookingStatus(b.id, 'approved')}
                                  className="inline-flex items-center gap-1 rounded-lg bg-[#1B4332] px-3 py-1.5 text-xs font-medium text-white"
                                >
                                  <Check className="h-3 w-3" />
                                  Approve
                                </button>
                              </>
                            )}
                            {isApprovedRental && (
                              <button
                                type="button"
                                onClick={() => handleUpdateBookingStatus(b.id, 'returned')}
                                className={ghostBtn}
                              >
                                Returned
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Wizard modal */}
      <UniversalListingWizardModal
        isOpen={wizardModalOpen}
        onClose={() => {
          setWizardModalOpen(false);
          setEditingListingItem(null);
        }}
        circleId={circleId}
        circleSlug={circleSlug}
        editingListing={editingListingItem}
        onSaved={handleListingSaved}
      />

      {/* Quick detail modal */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-stone-900">{selectedListing.title}</h3>
                <p className="text-sm font-semibold text-[#1B4332]">
                  {formatListingPrice(selectedListing)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedListing(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedListing.image_urls && selectedListing.image_urls.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {selectedListing.image_urls.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    className="h-48 w-full shrink-0 overflow-hidden rounded-xl bg-stone-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            )}

            {selectedListing.description && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-stone-600">
                {selectedListing.description}
              </p>
            )}

            {selectedListing.custom_fields &&
              typeof selectedListing.custom_fields === 'object' &&
              Object.keys(selectedListing.custom_fields).length > 0 && (
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-stone-50 p-3 text-xs">
                  {Object.entries(selectedListing.custom_fields).map(([k, v]) => (
                    <div key={k}>
                      <span className="text-stone-400">{k}: </span>
                      <span className="font-medium text-stone-800">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

            <div className="flex items-center justify-between border-t border-stone-100 pt-3">
              {currentUserId === selectedListing.seller_id || isStaff ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const item = selectedListing;
                      setSelectedListing(null);
                      handleOpenEdit(item);
                    }}
                    className={ghostBtn}
                  >
                    Edit
                  </button>
                  {selectedListing.status === 'published' && (
                    <button
                      type="button"
                      onClick={() => handleQuickStatusUpdate(selectedListing.id, 'reserved')}
                      className={ghostBtn}
                    >
                      Mark reserved
                    </button>
                  )}
                  {selectedListing.status === 'reserved' && (
                    <button
                      type="button"
                      onClick={() => handleQuickStatusUpdate(selectedListing.id, 'sold')}
                      className={ghostBtn}
                    >
                      Mark sold
                    </button>
                  )}
                </div>
              ) : (
                <span />
              )}

              <Link
                href={`/circles/${circleSlug}/marketplace/${selectedListing.id}`}
                className={ghostBtn}
              >
                Open page
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Inquiry modal */}
      {inquiryListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSendInquiry}
            className="w-full max-w-md space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">{inquiryListing.title}</h3>
              <button
                type="button"
                onClick={() => setInquiryListing(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              required
              rows={3}
              value={inquiryMessage}
              onChange={(e) => setInquiryMessage(e.target.value)}
              placeholder="Write a message..."
              className="w-full rounded-xl border border-stone-200 p-3 text-sm focus:border-[#2D6A4F] focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInquiryListing(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button type="submit" disabled={sendingInquiry} className={primaryBtn}>
                <Send className="h-3.5 w-3.5" />
                {sendingInquiry ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Booking modal */}
      {bookingListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSendBooking}
            className="w-full max-w-md space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">{bookingListing.title}</h3>
              <button
                type="button"
                onClick={() => setBookingListing(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {availableBookingDates.map((item) => {
                const selected = selectedBookingDate === item.dateStr;
                return (
                  <button
                    key={item.dateStr}
                    type="button"
                    onClick={() => {
                      setSelectedBookingDate(item.dateStr);
                      const sched = bookingListing.availability_schedule || {
                        days: [1, 2, 3, 4, 5],
                        startTime: '09:00',
                        endTime: '17:00',
                        slotDurationMinutes: bookingListing.service_duration_minutes || 60,
                        bufferMinutes: 0,
                      };
                      const listingBookings = bookings.filter(
                        (b) => b.listing_id === bookingListing.id
                      );
                      const slots = generateAvailableSlots(sched, item.dateStr, listingBookings);
                      const firstAvail = slots.find((s) => s.available);
                      if (firstAvail) {
                        setBookingStartsAt(firstAvail.startsAt.slice(0, 16));
                        setBookingEndsAt(firstAvail.endsAt.slice(0, 16));
                      }
                    }}
                    className={`flex min-w-[60px] flex-col items-center rounded-xl border p-2 text-xs ${
                      selected
                        ? 'border-[#1B4332] bg-[#1B4332] text-white'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <span className="text-[10px] opacity-75">{item.weekday}</span>
                    <span className="font-semibold">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-stone-500">Time</span>
                <button
                  type="button"
                  onClick={() => setManualTimeOverride((v) => !v)}
                  className="text-stone-500 underline"
                >
                  {manualTimeOverride ? 'Slots' : 'Custom'}
                </button>
              </div>

              {!manualTimeOverride ? (
                computedBookingSlots.length > 0 ? (
                  <div className="grid max-h-36 grid-cols-3 gap-1.5 overflow-y-auto">
                    {computedBookingSlots.map((slot, idx) => {
                      const selected =
                        bookingStartsAt === slot.startsAt.slice(0, 16) &&
                        bookingEndsAt === slot.endsAt.slice(0, 16);
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => {
                            setBookingStartsAt(slot.startsAt.slice(0, 16));
                            setBookingEndsAt(slot.endsAt.slice(0, 16));
                          }}
                          className={`rounded-lg border p-2 text-xs ${
                            selected
                              ? 'border-[#1B4332] bg-[#F4F3EE] font-medium text-[#1B4332]'
                              : slot.available
                              ? 'border-stone-200 text-stone-800 hover:bg-stone-50'
                              : 'border-stone-100 bg-stone-50 text-stone-300 line-through'
                          }`}
                        >
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg bg-stone-50 p-3 text-center text-xs text-stone-500">
                    No slots on this date.
                  </p>
                )
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="datetime-local"
                    required
                    value={bookingStartsAt}
                    onChange={(e) => setBookingStartsAt(e.target.value)}
                    className="rounded-lg border border-stone-200 p-2 text-xs"
                  />
                  <input
                    type="datetime-local"
                    required
                    value={bookingEndsAt}
                    onChange={(e) => setBookingEndsAt(e.target.value)}
                    className="rounded-lg border border-stone-200 p-2 text-xs"
                  />
                </div>
              )}
            </div>

            <textarea
              rows={2}
              value={bookingNotes}
              onChange={(e) => setBookingNotes(e.target.value)}
              placeholder="Note (optional)"
              className="w-full rounded-xl border border-stone-200 p-2.5 text-xs focus:border-[#2D6A4F] focus:outline-none"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBookingListing(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingBooking || !bookingStartsAt}
                className={primaryBtn}
              >
                {bookingListing.is_instant_bookable ? (
                  <Zap className="h-3.5 w-3.5" />
                ) : (
                  <Calendar className="h-3.5 w-3.5" />
                )}
                {submittingBooking ? 'Booking…' : 'Confirm'}
              </button>
            </div>
          </form>
        </div>
      )}

      <DirectMessageDrawer
        circleId={circleId}
        isOpen={dmDrawerOpen}
        onClose={() => setDmDrawerOpen(false)}
        currentUserId={currentUserId}
        activeConversationId={activeDmConvoId}
        onSelectConversation={(id) => setActiveDmConvoId(id)}
      />
    </div>
  );
}
