'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bookmark,
  Calendar,
  Check,
  Clock,
  Edit3,
  ExternalLink,
  Layers,
  MapPin,
  MessageSquare,
  Plus,
  Send,
  Share2,
  ShieldAlert,
  Tag,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  Circle,
  ListingActionType,
  ListingRateInterval,
  ListingTransactionType,
  MarketplaceListingItem,
  ServiceBookingItem,
} from '@/types/domain';
import { Button } from '@/components/ui/button';
import { ImageUploader } from '@/components/ui/image-uploader';
import { DirectMessageDrawer } from '@/components/messages/direct-message-drawer';
import {
  generateAvailableSlots,
  generateBookingIcs,
} from '@/features/marketplace/calendar-utils';
import { formatListingPrice } from '@/features/marketplace/listing-helpers';

interface ListingDetailClientProps {
  circle: Circle;
  initialListing: MarketplaceListingItem;
  initialBookings: ServiceBookingItem[];
  relatedListings: MarketplaceListingItem[];
  isMember: boolean;
  currentUserId: string | null;
  currentUserRole: string | null;
}

export function ListingDetailClient({
  circle,
  initialListing,
  initialBookings,
  relatedListings,
  isMember,
  currentUserId,
  currentUserRole,
}: ListingDetailClientProps) {
  const router = useRouter();
  const [listing, setListing] = useState<MarketplaceListingItem>(initialListing);
  const [bookings, setBookings] = useState<ServiceBookingItem[]>(initialBookings);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // DM Drawer
  const [dmDrawerOpen, setDmDrawerOpen] = useState(false);
  const [activeDmConvoId, setActiveDmConvoId] = useState<string | null>(null);

  // Booking Flow
  const [bookingDate, setBookingDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400_000);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [selectedSlot, setSelectedSlot] = useState<{
    startsAt: string;
    endsAt: string;
    label: string;
  } | null>(null);
  const [bookingNotes, setBookingNotes] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState<ServiceBookingItem | null>(null);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(listing.title);
  const [editDescription, setEditDescription] = useState(listing.description);
  const [editTransactionType, setEditTransactionType] = useState<ListingTransactionType>(
    listing.transaction_type ||
      (listing.pricing_unit === 'free'
        ? 'free'
        : listing.pricing_unit === 'negotiable'
        ? 'negotiable'
        : ['hourly', 'daily', 'monthly'].includes(listing.pricing_unit)
        ? 'rate'
        : 'fixed')
  );
  const [editRateInterval, setEditRateInterval] = useState<ListingRateInterval>(
    listing.rate_interval ||
      (listing.pricing_unit === 'hourly'
        ? 'hourly'
        : listing.pricing_unit === 'daily'
        ? 'daily'
        : listing.pricing_unit === 'monthly'
        ? 'monthly'
        : 'monthly')
  );
  const [editPrice, setEditPrice] = useState(
    listing.price_amount !== null && listing.price_amount !== undefined
      ? String(listing.price_amount)
      : ''
  );
  const [editPriceMin, setEditPriceMin] = useState(
    listing.price_min !== null && listing.price_min !== undefined ? String(listing.price_min) : ''
  );
  const [editPriceMax, setEditPriceMax] = useState(
    listing.price_max !== null && listing.price_max !== undefined ? String(listing.price_max) : ''
  );
  const [editActionType, setEditActionType] = useState<ListingActionType>(
    listing.action_type ||
      (listing.listing_type === 'service' || listing.listing_type === 'rental'
        ? 'booking'
        : 'inquiry')
  );
  const [editActionUrl, setEditActionUrl] = useState(listing.action_url || '');
  const [editLocation, setEditLocation] = useState(listing.location || '');
  const [editStatus, setEditStatus] = useState(listing.status);
  const [editPhotos, setEditPhotos] = useState<string[]>(listing.image_urls || []);
  const [editCustomFields, setEditCustomFields] = useState<Array<{ key: string; value: string }>>(
    listing.custom_fields && typeof listing.custom_fields === 'object'
      ? Object.entries(listing.custom_fields).map(([k, v]) => ({ key: k, value: String(v ?? '') }))
      : []
  );
  const [editTags, setEditTags] = useState<string[]>(Array.isArray(listing.tags) ? listing.tags : []);
  const [editTagInput, setEditTagInput] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  function handleAddEditCustomField() {
    setEditCustomFields((prev) => [...prev, { key: '', value: '' }]);
  }

  function handleUpdateEditCustomField(index: number, key: string, value: string) {
    setEditCustomFields((prev) => {
      const next = [...prev];
      next[index] = { key, value };
      return next;
    });
  }

  function handleRemoveEditCustomField(index: number) {
    setEditCustomFields((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddEditTag() {
    const raw = editTagInput.trim().replace(/^#/, '');
    if (!raw) return;
    if (!editTags.includes(raw)) {
      setEditTags((prev) => [...prev, raw]);
    }
    setEditTagInput('');
  }

  function handleRemoveEditTag(tagToRemove: string) {
    setEditTags((prev) => prev.filter((t) => t !== tagToRemove));
  }

  const isSeller = currentUserId === listing.seller_id;
  const isStaff = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canManage = isSeller || isStaff;

  const photos = listing.image_urls && listing.image_urls.length > 0 ? listing.image_urls : [];

  // Toggle Save / Bookmark
  async function handleToggleSave() {
    if (!currentUserId) {
      router.push('/login');
      return;
    }
    try {
      const res = await fetch(`/api/circles/${circle.id}/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_save',
          listingId: listing.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setListing((prev) => ({ ...prev, viewer_has_saved: data.saved }));
      }
    } catch {
      // Ignore toggle errors
    }
  }

  // Quick Status Update
  async function handleQuickStatusUpdate(nextStatus: 'published' | 'reserved' | 'sold') {
    try {
      const res = await fetch(`/api/circles/${circle.id}/marketplace/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setListing(data.listing);
      }
    } catch {
      alert('Failed to update status.');
    }
  }

  // Save Edit Form
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSavingEdit(true);
    try {
      const fieldsObj: Record<string, string> = {};
      editCustomFields.forEach(({ key, value }) => {
        if (key.trim()) {
          fieldsObj[key.trim()] = value.trim();
        }
      });

      const legacyPricingUnit =
        editTransactionType === 'free'
          ? 'free'
          : editTransactionType === 'negotiable'
          ? 'negotiable'
          : editTransactionType === 'rate'
          ? editRateInterval === 'hourly'
            ? 'hourly'
            : editRateInterval === 'daily'
            ? 'daily'
            : editRateInterval === 'monthly'
            ? 'monthly'
            : 'monthly'
          : 'fixed';

      const res = await fetch(`/api/circles/${circle.id}/marketplace/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          transactionType: editTransactionType,
          rateInterval: editTransactionType === 'rate' ? editRateInterval : null,
          priceAmount:
            (editTransactionType === 'fixed' ||
              editTransactionType === 'rate' ||
              editTransactionType === 'negotiable') &&
            editPrice
              ? Number(editPrice)
              : null,
          priceMin: editTransactionType === 'range' && editPriceMin ? Number(editPriceMin) : null,
          priceMax: editTransactionType === 'range' && editPriceMax ? Number(editPriceMax) : null,
          pricingUnit: legacyPricingUnit,
          actionType: editActionType,
          actionUrl: editActionType === 'link' && editActionUrl.trim() ? editActionUrl.trim() : null,
          customFields: fieldsObj,
          tags: editTags.map((t) => t.trim()).filter(Boolean),
          location: editLocation.trim() || null,
          imageUrls: editPhotos,
          status: editStatus,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update listing.');
      }
      const data = await res.json();
      setListing(data.listing);
      setEditModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update listing.');
    } finally {
      setSavingEdit(false);
    }
  }

  // Open Direct Message / Inquiry
  async function handleOpenInquiry() {
    if (!currentUserId) {
      router.push('/login');
      return;
    }
    if (isSeller) {
      alert('You are the author of this listing.');
      return;
    }

    try {
      const res = await fetch(`/api/circles/${circle.id}/messages/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: listing.seller_id,
          listingId: listing.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveDmConvoId(data.conversation.id);
        setDmDrawerOpen(true);
      } else {
        alert('Could not start conversation with seller.');
      }
    } catch {
      alert('Network error while initiating conversation.');
    }
  }

  // Availability Slots for Booking
  const sched = listing.availability_schedule || {
    days: [1, 2, 3, 4, 5],
    startTime: '09:00',
    endTime: '17:00',
    slotDurationMinutes: listing.service_duration_minutes || 60,
    bufferMinutes: 0,
  };
  const listingBookings = bookings.filter((b) => b.listing_id === listing.id);
  const availableSlots = generateAvailableSlots(sched, bookingDate, listingBookings);

  // Submit Booking
  async function handleSubmitBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) {
      alert('Please select an available time slot.');
      return;
    }
    setSubmittingBooking(true);
    try {
      const res = await fetch(`/api/circles/${circle.id}/marketplace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'booking',
          listingId: listing.id,
          bookingType: listing.listing_type === 'rental' ? 'rental' : 'service',
          startsAt: selectedSlot.startsAt,
          endsAt: selectedSlot.endsAt,
          notes: bookingNotes.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit booking.');
      setBookings((prev) => [data.booking, ...prev]);
      setBookingSuccess(data.booking);
      setSelectedSlot(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to complete booking.');
    } finally {
      setSubmittingBooking(false);
    }
  }

  // Copy Share Link
  function handleCopyShareLink() {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  }

  // Download iCalendar .ics
  function handleDownloadIcs(booking: ServiceBookingItem) {
    const ics = generateBookingIcs(booking, listing.title, circle.name);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking-${booking.id.slice(0, 8)}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const isBookable = listing.listing_type === 'service' || listing.listing_type === 'rental';

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Navigation Breadcrumbs & Back */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-stone-500 font-mono">
          <Link
            href={`/circles/${circle.slug}/marketplace`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Marketplace</span>
          </Link>
          <span className="text-stone-300">/</span>
          <span className="capitalize">{listing.listing_type}</span>
          <span className="text-stone-300">/</span>
          <span className="text-stone-800 font-bold truncate max-w-xs">{listing.title}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Share Button */}
          <Button size="sm" variant="outline" onClick={handleCopyShareLink}>
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1 text-stone-700" />
                <span className="text-stone-900 font-semibold">Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5 mr-1" />
                <span>Share</span>
              </>
            )}
          </Button>

          {/* Bookmark Button */}
          {isMember && (
            <Button
              size="sm"
              variant={listing.viewer_has_saved ? 'secondary' : 'outline'}
              onClick={handleToggleSave}
            >
              <Bookmark
                className={`h-3.5 w-3.5 mr-1 ${listing.viewer_has_saved ? 'fill-current' : ''}`}
              />
              <span>{listing.viewer_has_saved ? 'Saved' : 'Save'}</span>
            </Button>
          )}

          {/* Manage Button (Owner/Admin) */}
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setEditModalOpen(true)}>
              <Edit3 className="h-3.5 w-3.5 mr-1" />
              <span>Edit Listing</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid: Gallery & Details + Action Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column (2 spans): Gallery & Full Specifications */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photos Showcase */}
          {photos.length > 0 ? (
            <div className="space-y-3">
              <div
                onClick={() => setLightboxOpen(true)}
                className="relative h-80 sm:h-96 w-full cursor-zoom-in overflow-hidden rounded-2xl border border-stone-200/90 bg-stone-100 shadow-xs group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photos[selectedPhotoIndex]}
                  alt={listing.title}
                  className="h-full w-full object-cover group-hover:scale-102 transition-transform duration-300"
                />
                <span className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2.5 py-1 text-xs font-mono font-medium text-white backdrop-blur-xs">
                  Photo {selectedPhotoIndex + 1} of {photos.length} · Click to expand
                </span>
              </div>

              {photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photos.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedPhotoIndex(idx)}
                      className={`relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border transition-all ${
                        selectedPhotoIndex === idx
                          ? 'border-stone-900 ring-2 ring-stone-900/20 shadow-xs'
                          : 'border-stone-200 opacity-70 hover:opacity-100'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imgUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-56 w-full items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-stone-50/60 text-stone-400">
              <div className="text-center space-y-1">
                <Tag className="mx-auto h-8 w-8 text-stone-300" />
                <p className="text-xs font-medium">No photos uploaded for this listing</p>
              </div>
            </div>
          )}

          {/* Title, Badges & Header Info */}
          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider text-stone-900 border border-stone-200">
                {listing.listing_type}
              </span>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-mono font-semibold text-stone-700 border border-stone-200">
                #{listing.category}
              </span>
              {listing.condition && listing.condition !== 'not_applicable' && (
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-mono text-stone-600 border border-stone-200 uppercase">
                  Condition: {listing.condition.replace('_', ' ')}
                </span>
              )}
              {listing.status === 'reserved' && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-mono font-bold text-amber-800 border border-amber-200">
                  RESERVED
                </span>
              )}
              {listing.status === 'sold' && (
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-mono font-bold text-stone-600 border border-stone-200">
                  SOLD
                </span>
              )}
              {listing.status === 'published' && (
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-mono font-bold text-stone-900 border border-stone-200">
                  AVAILABLE
                </span>
              )}
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
                {listing.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-stone-500">
                {listing.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-stone-400" />
                    <span>{listing.location}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-stone-400" />
                  <span>Listed {new Date(listing.created_at).toLocaleDateString()}</span>
                </span>
                {listing.service_duration_minutes && (
                  <span className="inline-flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-stone-400" />
                    <span>Duration: {listing.service_duration_minutes} minutes</span>
                  </span>
                )}
              </div>

              {/* Tags */}
              {Array.isArray(listing.tags) && listing.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {listing.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-mono text-stone-700 border border-stone-200/80"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="border-t border-stone-100 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 font-mono mb-2">
                Listing Description
              </h3>
              <div className="text-sm text-stone-700 leading-relaxed whitespace-pre-line bg-stone-50/70 p-4 rounded-xl border border-stone-100">
                {listing.description || 'No description provided.'}
              </div>
            </div>

            {/* Specifications Details & Custom Attributes */}
            <div className="border-t border-stone-100 pt-4 space-y-3">
              <div className="flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-stone-900" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 font-mono">
                  Specifications & Attributes
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-stone-100 bg-stone-50/50 p-3">
                  <span className="text-stone-400 block font-mono text-[11px]">Pricing Model</span>
                  <span className="font-bold text-stone-800 capitalize mt-0.5 block">
                    {listing.transaction_type || listing.pricing_unit}
                  </span>
                </div>
                <div className="rounded-xl border border-stone-100 bg-stone-50/50 p-3">
                  <span className="text-stone-400 block font-mono text-[11px]">Response Mode</span>
                  <span className="font-bold text-stone-800 capitalize mt-0.5 block">
                    {listing.action_type || listing.contact_preference.replace('_', ' ')}
                  </span>
                </div>
                <div className="rounded-xl border border-stone-100 bg-stone-50/50 p-3">
                  <span className="text-stone-400 block font-mono text-[11px]">Instant Booking</span>
                  <span className="font-bold text-stone-800 mt-0.5 block">
                    {listing.is_instant_bookable ? 'Enabled ⚡' : 'Host Approval'}
                  </span>
                </div>

                {/* Dynamic Custom Fields */}
                {listing.custom_fields &&
                  typeof listing.custom_fields === 'object' &&
                  Object.entries(listing.custom_fields).map(([k, v], idx) => (
                    <div
                      key={`custom-${idx}`}
                      className="rounded-xl border border-stone-100 bg-stone-50/50 p-3"
                    >
                      <span className="text-stone-400 block font-mono text-[11px] truncate">
                        {k}
                      </span>
                      <span className="font-bold text-stone-800 mt-0.5 block truncate">
                        {String(v)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Interactive Booking & Availability Calendar (Services & Rentals) */}
          {isBookable && listing.status === 'published' && (
            <section className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-stone-900" />
                  <div>
                    <h2 className="text-base font-bold text-stone-900">
                      Book a Slot / Schedule Reservation
                    </h2>
                    <p className="text-xs text-stone-500">
                      {listing.is_instant_bookable
                        ? '⚡ Instant booking enabled — slot is automatically confirmed upon selection.'
                        : 'Submit your requested date and slot for the host to confirm.'}
                    </p>
                  </div>
                </div>
              </div>

              {bookingSuccess ? (
                <div className="rounded-xl border border-stone-200 bg-stone-100 p-5 text-center space-y-3">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-900">
                    <Check className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-stone-900">
                      {bookingSuccess.status === 'approved'
                        ? 'Appointment Confirmed!'
                        : 'Booking Request Submitted!'}
                    </h3>
                    <p className="text-xs text-stone-900 mt-1">
                      Scheduled for{' '}
                      <strong>{new Date(bookingSuccess.starts_at).toLocaleString()}</strong>
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleDownloadIcs(bookingSuccess)}
                      className="bg-black hover:bg-zinc-800 text-white"
                    >
                      <Calendar className="h-3.5 w-3.5 mr-1" />
                      <span>Add to Calendar (.ics)</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBookingSuccess(null)}
                    >
                      Book Another Slot
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitBooking} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 font-mono uppercase mb-1.5">
                      Select Date (Next 14 Days)
                    </label>
                    <input
                      type="date"
                      value={bookingDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => {
                        setBookingDate(e.target.value);
                        setSelectedSlot(null);
                      }}
                      className="w-full sm:w-64 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-black"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 font-mono uppercase mb-1.5">
                      Available Time Slots
                    </label>
                    {availableSlots.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 p-4 text-center text-xs text-stone-500">
                        The provider has no scheduled availability on this day of the week.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {availableSlots.map((slot, idx) => {
                          const isSelected =
                            selectedSlot?.startsAt === slot.startsAt &&
                            selectedSlot?.endsAt === slot.endsAt;
                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={!slot.available}
                              onClick={() => setSelectedSlot(slot)}
                              className={`rounded-xl border p-2 text-center text-xs font-mono font-medium transition-all ${
                                !slot.available
                                  ? 'border-stone-100 bg-stone-50 text-stone-300 cursor-not-allowed line-through'
                                  : isSelected
                                  ? 'border-black bg-stone-100 text-stone-900 ring-2 ring-black/10 font-bold shadow-xs'
                                  : 'border-stone-200 bg-white text-stone-800 hover:border-stone-400 hover:bg-stone-50'
                              }`}
                            >
                              <div>{slot.label}</div>
                              <span className="text-[10px] text-stone-400 block mt-0.5">
                                {!slot.available ? 'Booked' : 'Available'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 font-mono uppercase mb-1.5">
                      Notes or Special Requests (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                      placeholder="Share any background details or questions for your appointment..."
                      className="w-full rounded-xl border border-stone-200 bg-white p-3 text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-black"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={!selectedSlot || submittingBooking}
                    className="w-full sm:w-auto"
                  >
                    {submittingBooking
                      ? 'Confirming Slot...'
                      : listing.is_instant_bookable
                      ? '⚡ Instant Confirm Slot'
                      : 'Request Appointment Booking'}
                  </Button>
                </form>
              )}
            </section>
          )}

          {/* Related Listings from this Circle */}
          {relatedListings.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-stone-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-stone-800 font-mono">
                  More From This Circle
                </h3>
                <Link
                  href={`/circles/${circle.slug}/marketplace`}
                  className="text-xs font-semibold text-stone-900 hover:underline"
                >
                  View All Listings →
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {relatedListings.map((rel) => (
                  <Link
                    key={rel.id}
                    href={`/circles/${circle.slug}/marketplace/${rel.id}`}
                    className="group rounded-xl border border-stone-200 bg-white p-3 hover:border-stone-400 hover:shadow-xs transition-all space-y-2 block"
                  >
                    {rel.image_urls && rel.image_urls.length > 0 ? (
                      <div className="h-28 w-full overflow-hidden rounded-lg bg-stone-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={rel.image_urls[0]}
                          alt={rel.title}
                          className="h-full w-full object-cover group-hover:scale-103 transition-transform"
                        />
                      </div>
                    ) : (
                      <div className="h-28 w-full rounded-lg bg-stone-50 flex items-center justify-center text-stone-400">
                        <Tag className="h-6 w-6 text-stone-300" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-stone-900 truncate group-hover:text-stone-900">
                        {rel.title}
                      </h4>
                      <p className="text-xs font-mono font-black text-stone-800 mt-0.5">
                        {rel.pricing_unit === 'free'
                          ? 'FREE'
                          : rel.price_amount !== null
                          ? `${rel.price_currency} ${rel.price_amount.toFixed(2)}`
                          : rel.pricing_unit}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1 span): Pricing, Seller & Actions Sidebar */}
        <div className="space-y-6 lg:sticky lg:top-20">
          {/* Action Box */}
          <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xs space-y-5">
            {/* Price Box */}
            <div className="border-b border-stone-100 pb-4">
              <span className="text-xs font-mono text-stone-400 uppercase tracking-wider block">
                Listing Price
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-stone-900 font-mono">
                  {formatListingPrice(listing)}
                </span>
              </div>
            </div>

            {/* Actions for Visitors */}
            {!isSeller && isMember && (
              <div className="space-y-2.5">
                {listing.action_type === 'link' && listing.action_url ? (
                  <a
                    href={listing.action_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-zinc-800 transition-colors"
                  >
                    <span>Visit / Apply Externally</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : listing.action_type === 'booking' || isBookable ? (
                  <Button
                    size="md"
                    onClick={() => {
                      const el = document.querySelector('section');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-full bg-black hover:bg-zinc-800 text-white shadow-xs"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    <span>
                      {listing.listing_type === 'rental'
                        ? 'Request Rental Dates'
                        : 'Book Appointment'}
                    </span>
                  </Button>
                ) : listing.action_type === 'application' ? (
                  <Button
                    size="md"
                    onClick={handleOpenInquiry}
                    className="w-full bg-black hover:bg-zinc-800 text-white shadow-xs"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    <span>Apply / Submit Pitch</span>
                  </Button>
                ) : (
                  <Button
                    size="md"
                    onClick={handleOpenInquiry}
                    className="w-full bg-black hover:bg-zinc-800 text-white shadow-xs"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    <span>Message Seller / Inquire</span>
                  </Button>
                )}

                {isBookable && listing.action_type !== 'booking' && (
                  <Button
                    size="md"
                    variant="outline"
                    onClick={() => {
                      const el = document.querySelector('section');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-full"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    <span>View Booking Availability</span>
                  </Button>
                )}
              </div>
            )}

            {!isMember && (
              <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 text-xs text-amber-900 text-center space-y-2">
                <ShieldAlert className="mx-auto h-5 w-5 text-amber-700" />
                <p>Join this Circle to message the seller or book this service.</p>
                <Link
                  href={`/circles/${circle.slug}`}
                  className="inline-block font-bold text-amber-950 underline"
                >
                  Request to Join Circle →
                </Link>
              </div>
            )}

            {/* Seller Controls */}
            {canManage && (
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <span className="text-[11px] font-mono text-stone-400 uppercase tracking-wider block">
                  Author & Moderation Controls
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditModalOpen(true)}
                    className="w-full"
                  >
                    <Edit3 className="h-3.5 w-3.5 mr-1" />
                    <span>Edit</span>
                  </Button>

                  {listing.status === 'published' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickStatusUpdate('reserved')}
                      className="w-full"
                    >
                      Mark Reserved
                    </Button>
                  )}

                  {listing.status === 'reserved' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickStatusUpdate('sold')}
                      className="w-full"
                    >
                      Mark Sold
                    </Button>
                  )}

                  {(listing.status === 'reserved' || listing.status === 'sold') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickStatusUpdate('published')}
                      className="w-full"
                    >
                      Re-list Active
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Seller Card */}
          <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs space-y-4">
            <span className="text-xs font-mono uppercase text-stone-400 tracking-wider block">
              Posted By Member
            </span>

            <div className="flex items-center gap-3">
              {listing.seller?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={listing.seller.avatar_url}
                  alt=""
                  className="h-11 w-11 rounded-full object-cover border border-stone-200"
                />
              ) : (
                <div className="h-11 w-11 rounded-full bg-stone-100 text-stone-900 font-bold text-sm flex items-center justify-center border border-stone-200">
                  {(listing.seller?.display_name || 'M')[0].toUpperCase()}
                </div>
              )}
              <div className="truncate">
                <div className="text-sm font-bold text-stone-900 truncate">
                  {listing.seller?.display_name || 'Member'}
                </div>
                <div className="text-xs text-stone-400 font-mono truncate">
                  @{listing.seller?.username || 'member'}
                </div>
              </div>
            </div>

            {!isSeller && isMember && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenInquiry}
                className="w-full text-xs"
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                <span>Chat with {listing.seller?.display_name?.split(' ')[0] || 'Seller'}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && photos.length > 0 && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm cursor-zoom-out"
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/40"
          >
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[selectedPhotoIndex]}
            alt=""
            className="max-h-[90vh] max-w-[95vw] object-contain rounded-xl"
          />
        </div>
      )}

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">Edit Listing</h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 font-mono uppercase mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 p-2.5 text-sm text-stone-900"
                  required
                />
              </div>

              {/* Transaction & Pricing Model */}
              <div className="rounded-xl border border-stone-200/90 bg-stone-50/60 p-4 space-y-3">
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-700">
                  Pricing & Transaction Model
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {[
                    { id: 'fixed', label: 'Fixed Price' },
                    { id: 'rate', label: 'Recurring Rate' },
                    { id: 'range', label: 'Price Range' },
                    { id: 'free', label: 'Free' },
                    { id: 'negotiable', label: 'Negotiable' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setEditTransactionType(m.id as ListingTransactionType)}
                      className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-all ${
                        editTransactionType === m.id
                          ? 'bg-stone-900 text-white shadow-xs'
                          : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="pt-1">
                  {editTransactionType === 'fixed' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-600">
                        {listing.price_currency || 'USD'}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-40 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-stone-900"
                      />
                    </div>
                  )}

                  {editTransactionType === 'rate' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-stone-600">
                        {listing.price_currency || 'USD'}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        placeholder="Amount"
                        className="w-36 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-stone-900"
                      />
                      <span className="text-xs text-stone-500 font-mono">per</span>
                      <select
                        value={editRateInterval}
                        onChange={(e) =>
                          setEditRateInterval(e.target.value as ListingRateInterval)
                        }
                        className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-stone-900"
                      >
                        <option value="hourly">Hour</option>
                        <option value="daily">Day</option>
                        <option value="weekly">Week</option>
                        <option value="monthly">Month</option>
                        <option value="annually">Year</option>
                      </select>
                    </div>
                  )}

                  {editTransactionType === 'range' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-stone-600">
                        {listing.price_currency || 'USD'}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editPriceMin}
                        onChange={(e) => setEditPriceMin(e.target.value)}
                        placeholder="Min (e.g. 500)"
                        className="w-32 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-stone-900"
                      />
                      <span className="text-xs text-stone-400 font-mono">to</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editPriceMax}
                        onChange={(e) => setEditPriceMax(e.target.value)}
                        placeholder="Max (e.g. 800)"
                        className="w-32 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-stone-900"
                      />
                    </div>
                  )}

                  {editTransactionType === 'free' && (
                    <div className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-900 border border-stone-200 inline-block">
                      ✓ Free community listing — no payment required
                    </div>
                  )}

                  {editTransactionType === 'negotiable' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-stone-600">
                        {listing.price_currency || 'USD'}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        placeholder="Target / Starting Price (Optional)"
                        className="w-64 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-stone-900"
                      />
                      <span className="text-xs text-stone-500 font-mono">(Open to offers)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Type */}
              <div className="rounded-xl border border-stone-200/90 bg-stone-50/60 p-4 space-y-3">
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-700">
                  Primary Action / Call to Action
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'inquiry', label: '💬 Direct Message' },
                    { id: 'booking', label: '📅 Booking Calendar' },
                    { id: 'application', label: '📝 Application Pitch' },
                    { id: 'link', label: '🔗 External Link' },
                  ].map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setEditActionType(a.id as ListingActionType)}
                      className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-all ${
                        editActionType === a.id
                          ? 'bg-stone-900 text-white shadow-xs'
                          : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>

                {editActionType === 'link' && (
                  <div className="pt-1">
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-stone-500 mb-1">
                      External URL
                    </label>
                    <input
                      type="url"
                      value={editActionUrl}
                      onChange={(e) => setEditActionUrl(e.target.value)}
                      placeholder="https://example.com/apply"
                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900"
                    />
                  </div>
                )}
              </div>

              {/* Custom Attributes */}
              <div className="rounded-xl border border-stone-200/90 bg-stone-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-stone-900" />
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-700">
                      Specifications & Attributes
                    </label>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={handleAddEditCustomField}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    <span>Add Attribute</span>
                  </Button>
                </div>

                {editCustomFields.length > 0 && (
                  <div className="space-y-2">
                    {editCustomFields.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          value={f.key}
                          onChange={(e) =>
                            handleUpdateEditCustomField(idx, e.target.value, f.value)
                          }
                          placeholder="Key (e.g. Bedrooms)"
                          className="w-1/3 rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-900 font-mono"
                        />
                        <input
                          value={f.value}
                          onChange={(e) =>
                            handleUpdateEditCustomField(idx, f.key, e.target.value)
                          }
                          placeholder="Value (e.g. 2 Bed)"
                          className="w-1/2 rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-900"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveEditCustomField(idx)}
                          className="rounded-lg p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="rounded-xl border border-stone-200/90 bg-stone-50/60 p-4 space-y-2.5">
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-700">
                  Search Tags & Keywords
                </label>
                <div className="flex gap-2">
                  <input
                    value={editTagInput}
                    onChange={(e) => setEditTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEditTag();
                      }
                    }}
                    placeholder="Add tag and press Enter"
                    className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddEditTag}
                  >
                    Add
                  </Button>
                </div>
                {editTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {editTags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs font-mono text-stone-700 border border-stone-200 shadow-2xs"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => handleRemoveEditTag(t)}
                          className="text-stone-400 hover:text-stone-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 font-mono uppercase mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="e.g. Building C, Library, Downtown"
                  className="w-full rounded-xl border border-stone-200 p-2.5 text-sm text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 font-mono uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 p-2.5 text-sm text-stone-900"
                  required
                />
              </div>

              <div>
                <ImageUploader
                  circleId={circle.id}
                  value={editPhotos}
                  onChange={setEditPhotos}
                  multiple
                  maxFiles={8}
                  label="Photos"
                  helperText="Upload or manage photos for this listing"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 font-mono uppercase mb-1">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) =>
                    setEditStatus(e.target.value as 'published' | 'reserved' | 'sold')
                  }
                  className="w-full rounded-xl border border-stone-200 p-2.5 text-sm text-stone-900"
                >
                  <option value="published">Available (Published)</option>
                  <option value="reserved">Reserved</option>
                  <option value="sold">Sold</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Message Drawer */}
      <DirectMessageDrawer
        circleId={circle.id}
        isOpen={dmDrawerOpen}
        onClose={() => {
          setDmDrawerOpen(false);
          setActiveDmConvoId(null);
        }}
        currentUserId={currentUserId}
        activeConversationId={activeDmConvoId}
      />
    </div>
  );
}
