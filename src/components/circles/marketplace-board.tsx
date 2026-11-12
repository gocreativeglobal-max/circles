'use client';

import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  Briefcase,
  CheckCircle2,
  CreditCard,
  Home,
  MapPin,
  Plus,
  Search,
  ShoppingBag,
  Sliders,
  Sparkles,
  Trash2,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import {
  AvailabilitySchedule,
  CircleRole,
  ListingInquiryItem,
  MarketplaceCircleSettings,
  MarketplaceListingItem,
  MemberWalletBalanceItem,
  MemberWalletTransactionItem,
  ServiceBookingItem,
} from '@/types/domain';
import { UniversalListingWizardModal } from './universal-listing-wizard-modal';
import { formatListingPrice, getActionLabel } from '@/features/marketplace/listing-helpers';
import { generateAvailableSlots } from '@/features/marketplace/calendar-utils';
import {
  BACHS_ACCEPTED_CURRENCIES,
  formatBachsAmount,
} from '@/lib/payments/currencies';

interface MarketplaceBoardProps {
  circleId: string;
  circleSlug: string;
  initialListings: MarketplaceListingItem[];
  initialInquiries: ListingInquiryItem[];
  initialBookings: ServiceBookingItem[];
  isMember: boolean;
  currentUserId: string | null;
  currentUserRole: CircleRole | null;
  initialMarketplaceSettings?: MarketplaceCircleSettings;
  initialWalletSummary?: {
    balances: MemberWalletBalanceItem[];
    transactions: MemberWalletTransactionItem[];
  } | null;
}

const ALL_TYPE_PILLS = [
  { id: 'all', label: 'All', icon: ShoppingBag },
  { id: 'product', label: 'Goods', icon: ShoppingBag },
  { id: 'service', label: 'Services', icon: Sparkles },
  { id: 'rental', label: 'Rentals', icon: Wrench },
  { id: 'property', label: 'Housing', icon: Home },
  { id: 'job', label: 'Jobs', icon: Briefcase },
];

export function MarketplaceBoard({
  circleId,
  initialListings,
  initialInquiries,
  initialBookings,
  isMember,
  currentUserId,
  currentUserRole,
  initialMarketplaceSettings,
  initialWalletSummary = null,
}: MarketplaceBoardProps) {
  const [listings, setListings] = useState<MarketplaceListingItem[]>(initialListings);
  const [inquiries, setInquiries] = useState<ListingInquiryItem[]>(initialInquiries);
  const [bookings, setBookings] = useState<ServiceBookingItem[]>(initialBookings);
  const [mktSettings, setMktSettings] = useState<MarketplaceCircleSettings>(
    initialMarketplaceSettings || {
      defaultCurrency: 'USD',
      allowMultiCurrency: true,
      commissionPercentage: 0,
      payToPostEnabled: false,
      payToPostFeeAmount: 0,
      payToPostTypes: ['job', 'property'],
      allowedListingTypes: ['product', 'service', 'rental', 'property', 'job', 'custom'],
      postingPolicy: 'all_members',
    }
  );
  const [walletSummary, setWalletSummary] = useState(
    initialWalletSummary || { balances: [], transactions: [] }
  );

  const [activeView, setActiveView] = useState<'browse' | 'saved' | 'activity' | 'wallet'>(
    'browse'
  );
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');

  // Modals
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<MarketplaceListingItem | null>(null);
  const [detailListing, setDetailListing] = useState<MarketplaceListingItem | null>(null);

  // Checkout Modal State (Members & Non-Members)
  const [checkoutListing, setCheckoutListing] = useState<MarketplaceListingItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<
    'card' | 'mobile_money' | 'bank_transfer' | 'stablecoin'
  >('card');
  const [buyerNote, setBuyerNote] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderReceipt, setOrderReceipt] = useState<{
    title: string;
    amountFormatted: string;
    reference: string;
  } | null>(null);

  // Admin Customization Modal State
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [draftSettings, setDraftSettings] = useState<MarketplaceCircleSettings>(mktSettings);
  const [savingSettings, setSavingSettings] = useState(false);

  // Wallet Withdrawal State
  const [withdrawCurrency, setWithdrawCurrency] = useState('USD');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawDest, setWithdrawDest] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [walletNotice, setWalletNotice] = useState<string | null>(null);

  // Inquiry / Application Modal
  const [inquiryTarget, setInquiryTarget] = useState<MarketplaceListingItem | null>(null);
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [sendingInquiry, setSendingInquiry] = useState(false);

  // Booking Modal
  const [bookingTarget, setBookingTarget] = useState<MarketplaceListingItem | null>(null);
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedSlot, setSelectedSlot] = useState<{ startsAt: string; endsAt: string } | null>(
    null
  );
  const [bookingNotes, setBookingNotes] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);

  const isStaff =
    currentUserRole === 'owner' ||
    currentUserRole === 'admin' ||
    currentUserRole === 'moderator';
  const isAdmin = currentUserRole === 'owner' || currentUserRole === 'admin';

  const canCreateListing =
    isMember && (mktSettings.postingPolicy !== 'admins_only' || isStaff);

  const visibleTypePills = useMemo(() => {
    const allowed = mktSettings.allowedListingTypes;
    if (!allowed || allowed.length === 0) return ALL_TYPE_PILLS;
    return ALL_TYPE_PILLS.filter(
      (p) => p.id === 'all' || allowed.includes(p.id) || (p.id === 'property' && allowed.includes('housing'))
    );
  }, [mktSettings.allowedListingTypes]);

  const filteredListings = useMemo(() => {
    return listings
      .filter((item) => {
        if (item.status === 'removed' || item.status === 'archived') return false;
        if (activeView === 'saved' && !item.viewer_has_saved) return false;
        if (selectedType !== 'all') {
          if (selectedType === 'property') {
            if (item.listing_type !== 'property' && item.listing_type !== 'housing') return false;
          } else if (item.listing_type !== selectedType) {
            return false;
          }
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const inTitle = item.title.toLowerCase().includes(q);
          const inDesc = (item.description || '').toLowerCase().includes(q);
          const inCat = (item.category || '').toLowerCase().includes(q);
          const inLoc = (item.location || '').toLowerCase().includes(q);
          if (!inTitle && !inDesc && !inCat && !inLoc) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') {
          return (a.price_amount ?? 0) - (b.price_amount ?? 0);
        }
        if (sortBy === 'price_desc') {
          return (b.price_amount ?? 0) - (a.price_amount ?? 0);
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [listings, activeView, selectedType, searchQuery, sortBy]);

  const availableSlots = useMemo(() => {
    if (!bookingTarget) return [];
    const rawSched = bookingTarget.availability_schedule;
    const schedule: AvailabilitySchedule =
      (typeof rawSched === 'string'
        ? (JSON.parse(rawSched) as AvailabilitySchedule)
        : rawSched) || {
        days: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '17:00',
        slotDurationMinutes: bookingTarget.service_duration_minutes || 60,
        bufferMinutes: 0,
      };
    const existingForListing = bookings
      .filter(
        (b) =>
          b.listing_id === bookingTarget.id &&
          (b.status === 'pending' || b.status === 'approved')
      )
      .map((b) => ({ starts_at: b.starts_at, ends_at: b.ends_at, status: b.status }));
    return generateAvailableSlots(schedule, bookingDate, existingForListing);
  }, [bookingTarget, bookingDate, bookings]);

  async function handleToggleSave(listingId: string) {
    if (!currentUserId) return;
    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, viewer_has_saved: !l.viewer_has_saved } : l))
    );
    await fetch(`/api/circles/${circleId}/marketplace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_save', listingId }),
    });
  }

  async function handleDeleteListing(listingId: string) {
    const res = await fetch(`/api/circles/${circleId}/marketplace`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, status: 'removed' }),
    });
    if (res.ok) {
      setListings((prev) => prev.filter((l) => l.id !== listingId));
      if (detailListing?.id === listingId) setDetailListing(null);
    }
  }

  function triggerPrimaryAction(item: MarketplaceListingItem) {
    const aType = item.action_type || 'inquiry';
    if (aType === 'link' && item.action_url) {
      window.open(item.action_url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!currentUserId) {
      const returnUrl = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/circles';
      window.location.href = `/login?next=${encodeURIComponent(returnUrl)}`;
      return;
    }
    if (aType === 'checkout') {
      setCheckoutListing(item);
      setCheckoutError(null);
      setBuyerNote('');
      return;
    }
    if (aType === 'booking') {
      setBookingTarget(item);
      setSelectedSlot(null);
      setBookingNotes('');
      return;
    }
    setInquiryTarget(item);
    setInquiryMessage('');
  }

  async function handleSubmitCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!checkoutListing) return;
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkout',
          listingId: checkoutListing.id,
          paymentMethod,
          buyerNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data.error || 'Payment failed.');
        return;
      }
      if (data.listing) {
        setListings((prev) =>
          prev.map((l) => (l.id === data.listing.id ? data.listing : l))
        );
      }
      if (data.walletSummary) {
        setWalletSummary(data.walletSummary);
      }
      setOrderReceipt({
        title: checkoutListing.title,
        amountFormatted: formatBachsAmount(
          Number(data.order?.gross_amount_cents || Math.round((checkoutListing.price_amount || 0) * 100)),
          checkoutListing.price_currency || 'USD'
        ),
        reference: data.order?.payment_reference || 'PAID',
      });
      setCheckoutListing(null);
      setDetailListing(null);
    } catch {
      setCheckoutError('Network error during checkout.');
    } finally {
      setCheckoutBusy(false);
    }
  }

  async function handleSaveCustomize(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/capabilities`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capabilityKey: 'marketplace',
          enabled: true,
          settings: draftSettings,
        }),
      });
      if (res.ok) {
        setMktSettings(draftSettings);
        setCustomizeOpen(false);
      }
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleWithdrawWallet(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = Math.round(Number(withdrawAmount || 0) * 100);
    if (amountCents < 100 || !withdrawDest.trim()) return;
    setWithdrawing(true);
    setWalletNotice(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'withdraw_wallet',
          currency: withdrawCurrency,
          amountCents,
          payoutDestination: withdrawDest.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWalletNotice(data.error || 'Could not process withdrawal.');
        return;
      }
      if (data.walletSummary) {
        setWalletSummary(data.walletSummary);
      }
      setWithdrawAmount('');
      setWithdrawDest('');
      setWalletNotice('Withdrawal processed.');
    } finally {
      setWithdrawing(false);
    }
  }

  async function handleSendInquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!inquiryTarget || !inquiryMessage.trim()) return;
    setSendingInquiry(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'inquiry',
          listingId: inquiryTarget.id,
          message: inquiryMessage.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.inquiry) {
        setInquiries((prev) => [data.inquiry, ...prev]);
        setInquiryTarget(null);
        setInquiryMessage('');
      }
    } finally {
      setSendingInquiry(false);
    }
  }

  async function handleSendBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingTarget || !selectedSlot) return;
    setSubmittingBooking(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'booking',
          listingId: bookingTarget.id,
          bookingType: bookingTarget.listing_type === 'rental' ? 'rental' : 'service',
          startsAt: selectedSlot.startsAt,
          endsAt: selectedSlot.endsAt,
          notes: bookingNotes.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.booking) {
        setBookings((prev) => [data.booking, ...prev]);
        setBookingTarget(null);
      }
    } finally {
      setSubmittingBooking(false);
    }
  }

  async function handleRespondInquiry(
    inquiryId: string,
    status: 'accepted' | 'declined',
    sellerResponse?: string
  ) {
    const res = await fetch(`/api/circles/${circleId}/marketplace`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'respond_inquiry', inquiryId, status, sellerResponse }),
    });
    const data = await res.json();
    if (res.ok && data.inquiry) {
      setInquiries((prev) => prev.map((i) => (i.id === inquiryId ? data.inquiry : i)));
    }
  }

  async function handleUpdateBooking(
    bookingId: string,
    status: 'approved' | 'rejected' | 'cancelled' | 'completed'
  ) {
    const res = await fetch(`/api/circles/${circleId}/marketplace`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_booking', bookingId, status }),
    });
    const data = await res.json();
    if (res.ok && data.booking) {
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? data.booking : b)));
    }
  }

  const activityCount = inquiries.length + bookings.length;

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col justify-between gap-3 border-b border-stone-200 pb-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'browse', label: 'All listings' },
            { id: 'saved', label: 'Saved' },
            ...(isMember
              ? [
                  {
                    id: 'activity',
                    label: `Requests${activityCount > 0 ? ` (${activityCount})` : ''}`,
                  },
                ]
              : []),
            ...(currentUserId ? [{ id: 'wallet', label: 'Wallet' }] : []),
          ].map((tab) => {
            const active = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveView(tab.id as typeof activeView)}
                className={`relative px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  active ? 'text-stone-900 font-semibold' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                {tab.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-[13px] h-0.5 rounded-full bg-black" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setDraftSettings(mktSettings);
                setCustomizeOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Customize</span>
            </button>
          )}

          {canCreateListing && (
            <button
              type="button"
              onClick={() => {
                setEditingListing(null);
                setWizardOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-black px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New listing</span>
            </button>
          )}
        </div>
      </div>

      {/* Order Confirmation Banner */}
      {orderReceipt && (
        <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-[#F4F3EE] px-4 py-3 text-xs text-stone-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Purchased <strong>{orderReceipt.title}</strong> ({orderReceipt.amountFormatted}) · Ref:{' '}
              <code className="font-mono">{orderReceipt.reference}</code>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOrderReceipt(null)}
            className="text-stone-600 hover:text-black"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* BROWSE / SAVED VIEW */}
      {(activeView === 'browse' || activeView === 'saved') && (
        <>
          {/* Filter & Search Bar */}
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              {visibleTypePills.map((pill) => {
                const Icon = pill.icon;
                const active = selectedType === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setSelectedType(pill.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-black text-white'
                        : 'bg-white border border-stone-200/80 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{pill.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-xl border border-stone-200 bg-white py-1.5 pl-8 pr-3 text-xs text-stone-900 focus:border-black focus:outline-none"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700 focus:border-black focus:outline-none"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {/* Grid */}
          {filteredListings.length === 0 ? (
            <div className="rounded-2xl border border-stone-200/80 bg-white p-12 text-center">
              <ShoppingBag className="mx-auto h-7 w-7 text-stone-300" />
              <p className="mt-2 text-sm font-medium text-stone-700">No listings found</p>
              {canCreateListing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingListing(null);
                    setWizardOpen(true);
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-black px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Post a listing</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredListings.map((item) => {
                const isOwner = currentUserId && item.seller_id === currentUserId;
                const priceLabel = formatListingPrice(item);
                const coverImg = item.image_urls?.[0] || null;
                const isSold = item.status === 'sold';

                return (
                  <div
                    key={item.id}
                    onClick={() => setDetailListing(item)}
                    className="group flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-stone-200/80 bg-white transition-all hover:border-stone-300 hover:shadow-xs"
                  >
                    <div>
                      {coverImg && (
                        <div className="relative h-40 w-full overflow-hidden bg-stone-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={coverImg}
                            alt={item.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          {isSold && (
                            <span className="absolute left-3 top-3 rounded-lg bg-stone-900/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                              Sold
                            </span>
                          )}
                        </div>
                      )}

                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[11px] font-medium text-stone-400">
                            {item.category}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                              isSold
                                ? 'bg-stone-100 text-stone-400 line-through'
                                : 'bg-[#F4F3EE] text-stone-900'
                            }`}
                          >
                            {priceLabel}
                          </span>
                        </div>

                        <h3 className="mt-1.5 text-sm font-semibold text-stone-900 line-clamp-1">
                          {item.title}
                        </h3>

                        {item.description && (
                          <p className="mt-1 text-xs text-stone-500 line-clamp-2">
                            {item.description}
                          </p>
                        )}

                        {item.location && (
                          <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-stone-400">
                            <MapPin className="h-3 w-3" />
                            <span>{item.location}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div
                      className="flex items-center justify-between border-t border-stone-100 px-4 py-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[11px] text-stone-500 truncate">
                        {item.seller?.display_name || 'Member'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {currentUserId && (
                          <button
                            type="button"
                            onClick={() => handleToggleSave(item.id)}
                            className={`rounded-lg p-1.5 transition-colors ${
                              item.viewer_has_saved
                                ? 'text-stone-900'
                                : 'text-stone-400 hover:bg-stone-100 hover:text-stone-700'
                            }`}
                            title="Save"
                          >
                            <Bookmark className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {isOwner ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingListing(item);
                              setWizardOpen(true);
                            }}
                            className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
                          >
                            Edit
                          </button>
                        ) : isSold ? (
                          <span className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-400">
                            Sold
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => triggerPrimaryAction(item)}
                            className="inline-flex items-center gap-1 rounded-lg bg-black px-2.5 py-1 text-xs font-semibold text-white hover:bg-zinc-800"
                          >
                            {item.action_type === 'checkout' && (
                              <CreditCard className="h-3 w-3" />
                            )}
                            <span>{getActionLabel(item.action_type, item.listing_type)}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* WALLET VIEW (Member Wallet) */}
      {activeView === 'wallet' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Balances & Withdraw */}
          <div className="space-y-4 lg:col-span-1">
            <div className="rounded-2xl border border-stone-200/80 bg-white p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-stone-900" />
                <h3 className="text-sm font-semibold text-stone-900">Member Wallet</h3>
              </div>

              {walletSummary.balances.length === 0 ? (
                <p className="text-xs text-stone-500">
                  No balance yet. When you sell items on the platform, your earnings appear here.
                </p>
              ) : (
                <div className="space-y-2">
                  {walletSummary.balances.map((b) => (
                    <div
                      key={b.currency}
                      className="flex items-center justify-between rounded-xl bg-[#FAF9F6] px-3.5 py-2.5"
                    >
                      <span className="text-xs font-medium text-stone-600">{b.currency}</span>
                      <span className="text-sm font-bold text-stone-900">
                        {formatBachsAmount(b.available_cents, b.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={handleWithdrawWallet}
              className="rounded-2xl border border-stone-200/80 bg-white p-5 space-y-3"
            >
              <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                Withdraw Funds
              </h4>

              {walletNotice && (
                <p className="rounded-lg bg-[#F4F3EE] px-3 py-1.5 text-xs font-medium text-stone-900">
                  {walletNotice}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={withdrawCurrency}
                  onChange={(e) => setWithdrawCurrency(e.target.value)}
                  className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900"
                >
                  {BACHS_ACCEPTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.symbol})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  step="any"
                  required
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Amount"
                  className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900"
                />
              </div>

              <input
                type="text"
                required
                value={withdrawDest}
                onChange={(e) => setWithdrawDest(e.target.value)}
                placeholder="Bank account, Mobile Money, or Wallet address"
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900"
              />

              <button
                type="submit"
                disabled={withdrawing}
                className="w-full rounded-xl bg-black py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {withdrawing ? 'Processing...' : 'Withdraw'}
              </button>
            </form>
          </div>

          {/* Wallet Transactions */}
          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-stone-900 mb-3">Wallet Activity</h3>
            {walletSummary.transactions.length === 0 ? (
              <p className="text-xs text-stone-400">No transactions recorded yet.</p>
            ) : (
              <div className="divide-y divide-stone-100">
                {walletSummary.transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-3 text-xs">
                    <div>
                      <p className="font-semibold text-stone-900">{tx.description}</p>
                      <p className="text-[11px] text-stone-400">
                        {new Date(tx.created_at).toLocaleDateString()} · {tx.status}
                      </p>
                    </div>
                    <span
                      className={`font-semibold ${
                        tx.entry_type === 'sale_credit' ? 'text-stone-900' : 'text-stone-700'
                      }`}
                    >
                      {tx.entry_type === 'sale_credit' ? '+' : '-'}
                      {formatBachsAmount(tx.amount_cents, tx.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACTIVITY / REQUESTS VIEW */}
      {activeView === 'activity' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Inquiries */}
          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 space-y-3">
            <h3 className="text-sm font-semibold text-stone-900">Messages & Applications</h3>
            {inquiries.length === 0 ? (
              <p className="text-xs text-stone-400">No messages yet.</p>
            ) : (
              <div className="divide-y divide-stone-100">
                {inquiries.map((inq) => {
                  const isSeller = inq.seller_id === currentUserId;
                  return (
                    <div key={inq.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-900">
                          {inq.listing_title || 'Listing'}
                        </span>
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium capitalize text-stone-600">
                          {inq.status}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600">{inq.message}</p>
                      {isSeller && inq.status === 'open' && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleRespondInquiry(inq.id, 'accepted', 'Accepted')}
                            className="rounded-lg bg-black px-2.5 py-1 text-[11px] font-semibold text-white"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRespondInquiry(inq.id, 'declined', 'Declined')}
                            className="rounded-lg border border-stone-200 px-2.5 py-1 text-[11px] font-medium text-stone-600"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bookings */}
          <div className="rounded-2xl border border-stone-200/80 bg-white p-5 space-y-3">
            <h3 className="text-sm font-semibold text-stone-900">Bookings & Rentals</h3>
            {bookings.length === 0 ? (
              <p className="text-xs text-stone-400">No bookings yet.</p>
            ) : (
              <div className="divide-y divide-stone-100">
                {bookings.map((b) => {
                  const isProvider = b.provider_id === currentUserId;
                  return (
                    <div key={b.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-900">
                          {b.listing_title || 'Booking'}
                        </span>
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium capitalize text-stone-600">
                          {b.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500">
                        {new Date(b.starts_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      {isProvider && b.status === 'pending' && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateBooking(b.id, 'approved')}
                            className="rounded-lg bg-black px-2.5 py-1 text-[11px] font-semibold text-white"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateBooking(b.id, 'rejected')}
                            className="rounded-lg border border-stone-200 px-2.5 py-1 text-[11px] font-medium text-stone-600"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* QUICK DETAIL MODAL */}
      {detailListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-medium text-stone-400">
                  {detailListing.category}
                </span>
                <h3 className="text-lg font-bold text-stone-900">{detailListing.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailListing(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailListing.image_urls?.[0] && (
              <div className="overflow-hidden rounded-xl bg-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={detailListing.image_urls[0]}
                  alt={detailListing.title}
                  className="max-h-64 w-full object-cover"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-[#F4F3EE] px-3 py-1 text-sm font-semibold text-stone-900">
                {formatListingPrice(detailListing)}
              </span>
              {detailListing.location && (
                <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                  <MapPin className="h-3.5 w-3.5" />
                  {detailListing.location}
                </span>
              )}
            </div>

            {detailListing.description && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-stone-700">
                {detailListing.description}
              </p>
            )}

            {detailListing.custom_fields &&
              Object.keys(detailListing.custom_fields).length > 0 && (
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#FAF9F6] p-3">
                  {Object.entries(detailListing.custom_fields).map(([k, v]) => (
                    <div key={k}>
                      <span className="block text-[10px] uppercase text-stone-400">{k}</span>
                      <span className="text-xs font-medium text-stone-800">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

            <div className="flex items-center justify-between border-t border-stone-100 pt-4">
              <span className="text-xs text-stone-500">
                Posted by {detailListing.seller?.display_name || 'Member'}
              </span>

              <div className="flex items-center gap-2">
                {(isStaff || detailListing.seller_id === currentUserId) && (
                  <button
                    type="button"
                    onClick={() => handleDeleteListing(detailListing.id)}
                    className="rounded-xl border border-stone-200 p-2 text-stone-500 hover:bg-red-50 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}

                {detailListing.seller_id !== currentUserId && detailListing.status !== 'sold' && (
                  <>
                    {detailListing.action_type === 'checkout' && (
                      <button
                        type="button"
                        onClick={() => {
                          const target = detailListing;
                          setDetailListing(null);
                          setInquiryTarget(target);
                        }}
                        className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
                      >
                        Message seller
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const target = detailListing;
                        setDetailListing(null);
                        triggerPrimaryAction(target);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
                    >
                      {detailListing.action_type === 'checkout' && (
                        <CreditCard className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {getActionLabel(detailListing.action_type, detailListing.listing_type)}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ON-PLATFORM CHECKOUT MODAL (Members & Non-Members) */}
      {checkoutListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSubmitCheckout}
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-stone-900" />
                <h4 className="text-sm font-semibold text-stone-900">Checkout</h4>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutListing(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {checkoutError && (
              <div className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {checkoutError}
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl bg-[#FAF9F6] p-3.5">
              <div>
                <p className="text-sm font-semibold text-stone-900">{checkoutListing.title}</p>
                <p className="text-xs text-stone-500">
                  Seller: {checkoutListing.seller?.display_name || 'Member'}
                </p>
              </div>
              <span className="text-base font-bold text-stone-900">
                {formatListingPrice(checkoutListing)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                Payment method
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'card', label: 'Card' },
                  { id: 'mobile_money', label: 'Mobile Money' },
                  { id: 'bank_transfer', label: 'Bank Transfer' },
                  { id: 'stablecoin', label: 'USDT / USDC' },
                ].map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(pm.id as typeof paymentMethod)}
                    className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                      paymentMethod === pm.id
                        ? 'border-stone-900 bg-[#F4F3EE] text-stone-900 font-semibold'
                        : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Delivery / pickup note (optional)
              </label>
              <input
                type="text"
                value={buyerNote}
                onChange={(e) => setBuyerNote(e.target.value)}
                placeholder="Coordinate pickup or delivery details..."
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs text-stone-900 focus:border-black focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setCheckoutListing(null)}
                className="rounded-xl border border-stone-200 px-3.5 py-2 text-xs font-medium text-stone-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={checkoutBusy}
                className="rounded-xl bg-black px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {checkoutBusy ? 'Processing...' : `Pay ${formatListingPrice(checkoutListing)}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADMIN MARKETPLACE CUSTOMIZATION MODAL */}
      {customizeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSaveCustomize}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h4 className="text-sm font-semibold text-stone-900">Customize Marketplace</h4>
              <button
                type="button"
                onClick={() => setCustomizeOpen(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Currency Configuration */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-stone-700">Default currency</label>
              <select
                value={draftSettings.defaultCurrency || 'USD'}
                onChange={(e) =>
                  setDraftSettings((prev) => ({ ...prev, defaultCurrency: e.target.value }))
                }
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900"
              >
                {BACHS_ACCEPTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol}) — {c.name}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={draftSettings.allowMultiCurrency !== false}
                  onChange={(e) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      allowMultiCurrency: e.target.checked,
                    }))
                  }
                />
                <span>Allow sellers to pick other currencies</span>
              </label>
            </div>

            {/* Admin Commission % */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-stone-700">
                  Community commission on sales (%)
                </label>
                <span className="text-xs font-semibold text-stone-900">
                  {draftSettings.commissionPercentage ?? 0}%
                </span>
              </div>
              <input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={draftSettings.commissionPercentage ?? 0}
                onChange={(e) =>
                  setDraftSettings((prev) => ({
                    ...prev,
                    commissionPercentage: Math.min(30, Math.max(0, Number(e.target.value))),
                  }))
                }
                className="mt-1.5 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900"
              />
            </div>

            {/* Pay-to-Post Setting */}
            <div className="rounded-xl border border-stone-200 bg-[#FAF9F6] p-3.5 space-y-2.5">
              <label className="flex items-center justify-between text-xs font-medium text-stone-800 cursor-pointer">
                <span>Pay-to-Post listing fee</span>
                <input
                  type="checkbox"
                  checked={Boolean(draftSettings.payToPostEnabled)}
                  onChange={(e) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      payToPostEnabled: e.target.checked,
                    }))
                  }
                />
              </label>

              {draftSettings.payToPostEnabled && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[11px] text-stone-500">
                      Fee ({draftSettings.defaultCurrency || 'USD'})
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={draftSettings.payToPostFeeAmount ?? 0}
                      onChange={(e) =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          payToPostFeeAmount: Math.max(0, Number(e.target.value)),
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-stone-500">Applies to</label>
                    <select
                      value={
                        (draftSettings.payToPostTypes || []).includes('all')
                          ? 'all'
                          : 'jobs_housing'
                      }
                      onChange={(e) =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          payToPostTypes:
                            e.target.value === 'all' ? ['all'] : ['job', 'property'],
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-900"
                    >
                      <option value="jobs_housing">Jobs & Housing only</option>
                      <option value="all">All listings</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Who can post */}
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Who can post</label>
              <select
                value={draftSettings.postingPolicy || 'all_members'}
                onChange={(e) =>
                  setDraftSettings((prev) => ({
                    ...prev,
                    postingPolicy: e.target.value as 'all_members' | 'admins_only',
                  }))
                }
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-900"
              >
                <option value="all_members">All active members</option>
                <option value="admins_only">Admins & moderators only</option>
              </select>
            </div>

            {/* Enabled Listing Types */}
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                Allowed listing types
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'product', label: 'Goods' },
                  { id: 'service', label: 'Services' },
                  { id: 'rental', label: 'Rentals' },
                  { id: 'property', label: 'Housing' },
                  { id: 'job', label: 'Jobs' },
                  { id: 'custom', label: 'Other' },
                ].map((t) => {
                  const current = draftSettings.allowedListingTypes || [
                    'product',
                    'service',
                    'rental',
                    'property',
                    'job',
                    'custom',
                  ];
                  const active = current.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? current.filter((x) => x !== t.id)
                          : [...current, t.id];
                        if (next.length > 0) {
                          setDraftSettings((prev) => ({ ...prev, allowedListingTypes: next }));
                        }
                      }}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                        active
                          ? 'border-stone-900 bg-[#F4F3EE] text-stone-900 font-semibold'
                          : 'border-stone-200 bg-white text-stone-500'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setCustomizeOpen(false)}
                className="rounded-xl border border-stone-200 px-3.5 py-2 text-xs font-medium text-stone-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingSettings}
                className="rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* INQUIRY / APPLICATION MODAL */}
      {inquiryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSendInquiry}
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-stone-900">
                {inquiryTarget.action_type === 'application' ? 'Apply' : 'Message'}:{' '}
                {inquiryTarget.title}
              </h4>
              <button
                type="button"
                onClick={() => setInquiryTarget(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <textarea
              rows={4}
              required
              value={inquiryMessage}
              onChange={(e) => setInquiryMessage(e.target.value)}
              placeholder="Write your message..."
              className="w-full rounded-xl border border-stone-200 p-3 text-xs text-stone-900 focus:border-black focus:outline-none"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInquiryTarget(null)}
                className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendingInquiry}
                className="rounded-xl bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                {sendingInquiry ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* BOOKING MODAL */}
      {bookingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSendBooking}
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-stone-900">Book: {bookingTarget.title}</h4>
              <button
                type="button"
                onClick={() => setBookingTarget(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Date</label>
              <input
                type="date"
                value={bookingDate}
                onChange={(e) => {
                  setBookingDate(e.target.value);
                  setSelectedSlot(null);
                }}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Time slots</label>
              {availableSlots.length === 0 ? (
                <p className="text-xs text-stone-400">No slots on this date.</p>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto">
                  {availableSlots.map((slot) => {
                    const active = selectedSlot?.startsAt === slot.startsAt;
                    return (
                      <button
                        key={slot.startsAt}
                        type="button"
                        disabled={!slot.available}
                        onClick={() =>
                          setSelectedSlot({ startsAt: slot.startsAt, endsAt: slot.endsAt })
                        }
                        className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium ${
                          !slot.available
                            ? 'border-stone-100 bg-stone-50 text-stone-300'
                            : active
                              ? 'border-stone-900 bg-black text-white'
                              : 'border-stone-200 text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <textarea
              rows={2}
              value={bookingNotes}
              onChange={(e) => setBookingNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="w-full rounded-xl border border-stone-200 p-2.5 text-xs text-stone-900"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBookingTarget(null)}
                className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedSlot || submittingBooking}
                className="rounded-xl bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-40"
              >
                {submittingBooking ? 'Booking...' : 'Confirm'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* UNIVERSAL WIZARD MODAL */}
      <UniversalListingWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        circleId={circleId}
        editingListing={editingListing}
        marketplaceSettings={mktSettings}
        isStaff={isStaff}
        onSaved={(saved, isEdit) => {
          if (isEdit) {
            setListings((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
          } else {
            setListings((prev) => [saved, ...prev]);
          }
        }}
      />
    </div>
  );
}
