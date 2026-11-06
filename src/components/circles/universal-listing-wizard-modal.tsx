'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Calendar,
  Check,
  ExternalLink,
  Eye,
  Home,
  Layers,
  MapPin,
  MessageSquare,
  Package,
  Plus,
  Send,
  Sparkles,
  Tag,
  Trash2,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageUploader } from '@/components/ui/image-uploader';
import {
  ListingActionType,
  ListingRateInterval,
  ListingTransactionType,
  MarketplaceListingItem,
} from '@/types/domain';
import { formatListingPrice, LISTING_PRESETS } from '@/features/marketplace/listing-helpers';

export interface UniversalListingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  circleId: string;
  circleSlug?: string;
  circleName?: string;
  editingListing?: MarketplaceListingItem | null;
  onSaved: (savedListing: MarketplaceListingItem, isEdit: boolean) => void;
}

const ARCHETYPES = [
  {
    id: 'housing',
    label: 'Housing & Sublets',
    icon: Home,
    description: 'Apartments, private rooms, dorm sublets, parking, or storage space.',
    badge: 'Popular',
    presetKey: 'housing',
  },
  {
    id: 'job',
    label: 'Jobs & Gigs',
    icon: Briefcase,
    description: 'Freelance contracts, campus gigs, student projects, or internships.',
    badge: 'Opportunities',
    presetKey: 'job',
  },
  {
    id: 'rental',
    label: 'Gear & Tool Lending',
    icon: Wrench,
    description: 'Share power tools, cameras, camping equipment, or party supplies.',
    badge: 'Sharing',
    presetKey: 'rental',
  },
  {
    id: 'service',
    label: 'Services & Lessons',
    icon: Zap,
    description: '1-on-1 tutoring, consulting, tech repair, coaching, or creative work.',
    badge: 'Services',
    presetKey: 'service',
  },
  {
    id: 'product',
    label: 'Goods & For Sale',
    icon: Package,
    description: 'Textbooks, furniture, electronics, clothing, or gear for sale or trade.',
    badge: 'Marketplace',
    presetKey: 'product',
  },
  {
    id: 'custom',
    label: 'Custom Community Listing',
    icon: Sparkles,
    description: 'Carpools, lost & found, community requests, or study groups.',
    badge: 'Flexible',
    presetKey: 'product',
  },
];

const POPULAR_CATEGORIES: Record<string, string[]> = {
  housing: ['Apartment Sublet', 'Private Room', 'Shared Room', 'Parking Spot', 'Storage Space', 'General'],
  job: ['Software & Tech', 'Design & Creative', 'Tutoring', 'Campus Gig', 'Community & Events', 'General'],
  rental: ['Power Tools', 'Gardening Gear', 'Camping & Outdoors', 'AV & Photography', 'Party Supplies', 'General'],
  service: ['Tutoring & Lessons', 'Tech & Design', 'Home & Repair', 'Health & Fitness', 'Consulting', 'General'],
  product: ['Electronics', 'Books & Media', 'Home & Furniture', 'Clothing', 'Sports & Outdoors', 'General'],
  custom: ['Carpool', 'Lost & Found', 'Community Request', 'Study Group', 'Volunteer', 'General'],
};

export function UniversalListingWizardModal({
  isOpen,
  onClose,
  circleId,
  circleName = 'Community',
  editingListing = null,
  onSaved,
}: UniversalListingWizardModalProps) {
  // Step Management: 1: Type, 2: Details, 3: Pricing & Action, 4: Specs & Review
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(editingListing ? 2 : 1);

  // Form State
  const [listingType, setListingType] = useState<string>('product');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [status, setStatus] = useState<'published' | 'draft' | 'reserved' | 'sold'>('published');

  // Pricing Model
  const [transactionType, setTransactionType] = useState<ListingTransactionType>('fixed');
  const [rateInterval, setRateInterval] = useState<ListingRateInterval>('monthly');
  const [priceAmount, setPriceAmount] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [priceCurrency] = useState('USD');

  // Action Model
  const [actionType, setActionType] = useState<ListingActionType>('inquiry');
  const [actionUrl, setActionUrl] = useState('');

  // Specs & Tags
  const [customFields, setCustomFields] = useState<Array<{ key: string; value: string }>>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Submission State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate on Edit or Reset on Create
  useEffect(() => {
    if (editingListing) {
      setCurrentStep(2);
      setListingType(editingListing.listing_type);
      setTitle(editingListing.title);
      setCategory(editingListing.category || 'General');
      setDescription(editingListing.description || '');
      setLocation(editingListing.location || '');
      setImageUrls(editingListing.image_urls || []);
      setStatus(
        editingListing.status === 'draft' ||
          editingListing.status === 'reserved' ||
          editingListing.status === 'sold'
          ? editingListing.status
          : 'published'
      );

      const transType =
        editingListing.transaction_type ||
        (editingListing.pricing_unit === 'free'
          ? 'free'
          : editingListing.pricing_unit === 'negotiable'
          ? 'negotiable'
          : ['hourly', 'daily', 'monthly'].includes(editingListing.pricing_unit)
          ? 'rate'
          : 'fixed');
      setTransactionType(transType);

      setRateInterval(
        editingListing.rate_interval ||
          (editingListing.pricing_unit === 'hourly'
            ? 'hourly'
            : editingListing.pricing_unit === 'daily'
            ? 'daily'
            : editingListing.pricing_unit === 'monthly'
            ? 'monthly'
            : 'monthly')
      );

      setPriceAmount(
        editingListing.price_amount !== null && editingListing.price_amount !== undefined
          ? String(editingListing.price_amount)
          : ''
      );
      setPriceMin(
        editingListing.price_min !== null && editingListing.price_min !== undefined
          ? String(editingListing.price_min)
          : ''
      );
      setPriceMax(
        editingListing.price_max !== null && editingListing.price_max !== undefined
          ? String(editingListing.price_max)
          : ''
      );

      setActionType(
        editingListing.action_type ||
          (editingListing.listing_type === 'service' || editingListing.listing_type === 'rental'
            ? 'booking'
            : 'inquiry')
      );
      setActionUrl(editingListing.action_url || '');

      if (editingListing.custom_fields && typeof editingListing.custom_fields === 'object') {
        const fields = Object.entries(editingListing.custom_fields).map(([k, v]) => ({
          key: k,
          value: String(v ?? ''),
        }));
        setCustomFields(fields);
      } else {
        setCustomFields([]);
      }

      setTags(Array.isArray(editingListing.tags) ? editingListing.tags : []);
    } else {
      setCurrentStep(1);
      setListingType('product');
      setTitle('');
      setCategory('General');
      setDescription('');
      setLocation('');
      setImageUrls([]);
      setStatus('published');
      setTransactionType('fixed');
      setRateInterval('monthly');
      setPriceAmount('');
      setPriceMin('');
      setPriceMax('');
      setActionType('inquiry');
      setActionUrl('');
      setCustomFields([]);
      setTags([]);
      setTagInput('');
      setError(null);
    }
  }, [editingListing, isOpen]);

  if (!isOpen) return null;

  // Handle Picking an Archetype
  function handleSelectArchetype(archId: string) {
    setListingType(archId);
    const preset = LISTING_PRESETS[archId];
    if (preset) {
      setTransactionType(preset.defaultTransaction);
      setActionType(preset.defaultAction);
      const initialFields = Object.entries(preset.fields).map(([key, value]) => ({ key, value }));
      setCustomFields(initialFields);
    } else {
      setTransactionType('fixed');
      setActionType('inquiry');
      setCustomFields([]);
    }
    const categories = POPULAR_CATEGORIES[archId] || POPULAR_CATEGORIES.product;
    setCategory(categories[0] || 'General');
    setCurrentStep(2);
  }

  // Tag Helpers
  function handleAddTag() {
    const clean = tagInput.trim().replace(/^#/, '');
    if (!clean) return;
    if (!tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
    }
    setTagInput('');
  }

  function handleRemoveTag(tagToRemove: string) {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  }

  // Custom Field Helpers
  function handleAddCustomField(key = '', value = '') {
    setCustomFields((prev) => [...prev, { key, value }]);
  }

  function handleUpdateCustomField(idx: number, key: string, value: string) {
    setCustomFields((prev) => {
      const next = [...prev];
      next[idx] = { key, value };
      return next;
    });
  }

  function handleRemoveCustomField(idx: number) {
    setCustomFields((prev) => prev.filter((_, i) => i !== idx));
  }

  // Quick Preset Chips for Smart Specs
  function handleQuickChip(key: string, value: string) {
    const existingIndex = customFields.findIndex((f) => f.key.toLowerCase() === key.toLowerCase());
    if (existingIndex >= 0) {
      handleUpdateCustomField(existingIndex, key, value);
    } else {
      handleAddCustomField(key, value);
    }
  }

  // Final Publish / Save
  async function handleFinalSave() {
    if (!title.trim()) {
      setError('Please provide a listing title.');
      setCurrentStep(2);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const isEdit = Boolean(editingListing?.id);
      const url = `/api/circles/${circleId}/marketplace`;
      const method = isEdit ? 'PATCH' : 'POST';

      const parsedImages = imageUrls
        .map((u) => u.trim())
        .filter((u) => u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/'));

      const fieldsObj: Record<string, string> = {};
      customFields.forEach(({ key, value }) => {
        if (key.trim()) {
          fieldsObj[key.trim()] = value.trim();
        }
      });

      const legacyPricingUnit: 'fixed' | 'hourly' | 'daily' | 'monthly' | 'free' | 'negotiable' =
        transactionType === 'free'
          ? 'free'
          : transactionType === 'negotiable'
          ? 'negotiable'
          : transactionType === 'rate'
          ? rateInterval === 'hourly'
            ? 'hourly'
            : rateInterval === 'daily'
            ? 'daily'
            : rateInterval === 'monthly'
            ? 'monthly'
            : 'monthly'
          : 'fixed';

      const payload = {
        ...(isEdit ? { listingId: editingListing?.id } : {}),
        listingType: listingType.trim() || 'product',
        category: category.trim() || 'General',
        title: title.trim(),
        description: description.trim(),
        transactionType,
        rateInterval: transactionType === 'rate' ? rateInterval : null,
        priceAmount:
          (transactionType === 'fixed' ||
            transactionType === 'rate' ||
            transactionType === 'negotiable') &&
          priceAmount
            ? Number(priceAmount)
            : null,
        priceMin: transactionType === 'range' && priceMin ? Number(priceMin) : null,
        priceMax: transactionType === 'range' && priceMax ? Number(priceMax) : null,
        priceCurrency: priceCurrency.toUpperCase(),
        pricingUnit: legacyPricingUnit,
        actionType,
        actionUrl: actionType === 'link' && actionUrl.trim() ? actionUrl.trim() : null,
        customFields: fieldsObj,
        tags: tags.map((t) => t.trim()).filter(Boolean),
        location: location.trim() ? location.trim() : null,
        imageUrls: parsedImages,
        status,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish listing.');
      }

      onSaved(data.listing, isEdit);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish listing.');
    } finally {
      setLoading(false);
    }
  }

  // Preview Item for Step 4
  const previewItem = {
    title: title.trim() || 'Your Listing Title Here',
    description: description.trim() || 'A short description of what you are offering to the community.',
    listing_type: listingType,
    category,
    location,
    image_urls: imageUrls,
    transaction_type: transactionType,
    rate_interval: rateInterval,
    price_amount: priceAmount ? Number(priceAmount) : null,
    price_min: priceMin ? Number(priceMin) : null,
    price_max: priceMax ? Number(priceMax) : null,
    price_currency: priceCurrency,
    action_type: actionType,
    tags,
    custom_fields: Object.fromEntries(
      customFields.filter((f) => f.key.trim()).map((f) => [f.key.trim(), f.value.trim()])
    ),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-3xl rounded-3xl border border-stone-200/90 bg-white shadow-2xl overflow-hidden max-h-[92vh]">
        {/* Wizard Header & Stepper */}
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4 bg-stone-50/60">
          <div className="flex items-center gap-3">
            {currentStep > 1 && !editingListing && (
              <button
                type="button"
                onClick={() =>
                  setCurrentStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : 1))
                }
                className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors shadow-2xs"
                title="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-800">
                  Step {currentStep} of 4
                </span>
                <span className="text-stone-300">·</span>
                <span className="text-xs text-stone-500 font-medium">
                  {currentStep === 1 && 'Choose Type'}
                  {currentStep === 2 && 'Listing Basics'}
                  {currentStep === 3 && 'Pricing & Response'}
                  {currentStep === 4 && 'Specs & Publish'}
                </span>
              </div>
              <h2 className="text-base font-bold text-stone-900 leading-tight">
                {editingListing ? 'Edit Community Listing' : 'Create a New Community Offering'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Minimal Step Indicator Dots */}
            <div className="hidden sm:flex items-center gap-1.5">
              {[1, 2, 3, 4].map((stepNum) => (
                <div
                  key={stepNum}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    currentStep === stepNum
                      ? 'w-6 bg-emerald-800'
                      : currentStep > stepNum
                      ? 'w-2 bg-emerald-700/60'
                      : 'w-2 bg-stone-200'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-stone-400 hover:bg-stone-200/60 hover:text-stone-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Wizard Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800 flex items-center justify-between">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-rose-600 hover:text-rose-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* STEP 1: ARCHETYPE CARDS */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="text-center max-w-md mx-auto space-y-1">
                <h3 className="text-lg font-bold text-stone-900">What would you like to list?</h3>
                <p className="text-xs text-stone-500">
                  Select an offering type to load the ideal template, pricing model, and questions.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {ARCHETYPES.map((arch) => {
                  const Icon = arch.icon;
                  const isSelected = listingType === arch.id;
                  return (
                    <button
                      key={arch.id}
                      type="button"
                      onClick={() => handleSelectArchetype(arch.id)}
                      className={`group flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-all duration-200 ${
                        isSelected
                          ? 'border-emerald-800 bg-emerald-50/40 ring-2 ring-emerald-800/10 shadow-xs'
                          : 'border-stone-200 bg-white hover:border-stone-400 hover:shadow-xs'
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          isSelected
                            ? 'bg-emerald-800 text-white'
                            : 'bg-stone-100 text-stone-700 group-hover:bg-emerald-100 group-hover:text-emerald-900'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-stone-900">{arch.label}</span>
                          <span className="rounded-full bg-stone-100 px-2 py-0.2 text-[9px] font-mono text-stone-600 border border-stone-200/60">
                            {arch.badge}
                          </span>
                        </div>
                        <p className="text-xs text-stone-500 leading-relaxed font-normal">
                          {arch.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: CORE BASICS (TITLE, CATEGORY, PHOTOS, DESCRIPTION) */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-stone-700">
                  Listing Title *
                </label>
                <input
                  required
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    listingType === 'housing'
                      ? 'e.g. 2-Bedroom Sunny Apartment Sublet near Campus'
                      : listingType === 'job'
                      ? 'e.g. Part-Time React & Design Student Contributor'
                      : listingType === 'rental'
                      ? 'e.g. DeWalt 20V Cordless Drill & Toolkit'
                      : listingType === 'service'
                      ? 'e.g. Calculus & Physics 1-on-1 Peer Tutoring'
                      : 'e.g. Ergonomic Office Desk Chair (Like New)'
                  }
                  className="w-full rounded-2xl border border-stone-200 bg-stone-50/60 px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-800/30"
                />
              </div>

              {/* Category Pills */}
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-stone-700">
                  Category
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(POPULAR_CATEGORIES[listingType] || POPULAR_CATEGORIES.product).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                        category.toLowerCase() === cat.toLowerCase()
                          ? 'bg-stone-900 text-white font-semibold shadow-xs'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80 hover:text-stone-900 border border-stone-200/60'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meetup Spot / Location */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-stone-700">
                  Meetup Location / Address (Optional)
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-stone-400" />
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Science Library Room 102 or Student Commons"
                    className="w-full rounded-2xl border border-stone-200 bg-stone-50/60 pl-10 pr-4 py-2.5 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-800/30"
                  />
                </div>
              </div>

              {/* Photos */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-stone-700">
                  Photos & Media
                </label>
                <ImageUploader
                  circleId={circleId}
                  value={imageUrls}
                  onChange={setImageUrls}
                  multiple
                  maxFiles={8}
                  helperText="Upload photos from your device or paste links"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-stone-700">
                  Description & Details
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Share details, specifications, condition, rental terms, or timing..."
                  className="w-full rounded-2xl border border-stone-200 bg-stone-50/60 px-4 py-2.5 text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-800/30"
                />
              </div>
            </div>
          )}

          {/* STEP 3: VALUE, PRICING & ACTION MODEL */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
              {/* Part A: Pricing Model */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-stone-700">
                    1. Pricing & Value Model
                  </label>
                  <span className="text-[10px] font-mono text-stone-400">Choose how value works</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'fixed', label: 'Fixed Price', desc: 'One-time cost' },
                    { id: 'rate', label: 'Recurring Rate', desc: 'Hourly / Monthly' },
                    { id: 'range', label: 'Price Range', desc: 'Min to Max' },
                    { id: 'free', label: 'Free', desc: 'Community gift' },
                    { id: 'negotiable', label: 'Negotiable', desc: 'Open to offers' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTransactionType(m.id as ListingTransactionType)}
                      className={`flex flex-col items-center justify-center rounded-2xl border p-3 text-center transition-all ${
                        transactionType === m.id
                          ? 'border-emerald-800 bg-emerald-50/50 text-emerald-950 font-bold shadow-2xs ring-1 ring-emerald-800/20'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                      }`}
                    >
                      <span className="text-xs">{m.label}</span>
                      <span className="text-[10px] font-normal text-stone-500 mt-0.5">{m.desc}</span>
                    </button>
                  ))}
                </div>

                {/* Dynamic Price Inputs */}
                <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4">
                  {transactionType === 'fixed' && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-stone-700 font-mono">$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        autoFocus
                        value={priceAmount}
                        onChange={(e) => setPriceAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-36 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                      />
                      <span className="text-xs text-stone-500 font-mono">USD fixed price</span>
                    </div>
                  )}

                  {transactionType === 'rate' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-stone-700 font-mono">$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        autoFocus
                        value={priceAmount}
                        onChange={(e) => setPriceAmount(e.target.value)}
                        placeholder="Amount"
                        className="w-32 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                      />
                      <span className="text-xs text-stone-500 font-mono">per</span>
                      <div className="flex gap-1">
                        {[
                          { id: 'hourly', label: 'Hour' },
                          { id: 'daily', label: 'Day' },
                          { id: 'weekly', label: 'Week' },
                          { id: 'monthly', label: 'Month' },
                        ].map((int) => (
                          <button
                            key={int.id}
                            type="button"
                            onClick={() => setRateInterval(int.id as ListingRateInterval)}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                              rateInterval === int.id
                                ? 'bg-stone-900 text-white shadow-2xs'
                                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
                            }`}
                          >
                            {int.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {transactionType === 'range' && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-stone-700 font-mono">$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={priceMin}
                        onChange={(e) => setPriceMin(e.target.value)}
                        placeholder="Min (e.g. 500)"
                        className="w-32 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
                      />
                      <span className="text-xs text-stone-400 font-mono">to</span>
                      <span className="text-sm font-bold text-stone-700 font-mono">$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={priceMax}
                        onChange={(e) => setPriceMax(e.target.value)}
                        placeholder="Max (e.g. 800)"
                        className="w-32 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
                      />
                    </div>
                  )}

                  {transactionType === 'free' && (
                    <div className="flex items-center gap-2 text-xs font-medium text-emerald-800">
                      <Check className="h-4 w-4 text-emerald-700" />
                      <span>Free offering — no monetary charge for circle members.</span>
                    </div>
                  )}

                  {transactionType === 'negotiable' && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-stone-700 font-mono">$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={priceAmount}
                        onChange={(e) => setPriceAmount(e.target.value)}
                        placeholder="Target Price (Optional)"
                        className="w-44 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
                      />
                      <span className="text-xs text-stone-500 font-mono">
                        (Open to offers / best offer)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Part B: Action Model (How members respond) */}
              <div className="space-y-3 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-stone-700">
                    2. Primary Member Action
                  </label>
                  <span className="text-[10px] font-mono text-stone-400">
                    What happens when clicked
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    {
                      id: 'inquiry',
                      label: 'Direct Message',
                      icon: MessageSquare,
                      desc: 'Opens a private chat drawer with you pre-linked to this listing.',
                    },
                    {
                      id: 'booking',
                      label: 'Booking Calendar',
                      icon: Calendar,
                      desc: 'Members schedule a date or time slot to pick up or meet.',
                    },
                    {
                      id: 'application',
                      label: 'Application Note / Pitch',
                      icon: Send,
                      desc: 'Members submit a private pitch or credential note to apply.',
                    },
                    {
                      id: 'link',
                      label: 'External Web Link',
                      icon: ExternalLink,
                      desc: 'Sends members directly to an external application or listing URL.',
                    },
                  ].map((act) => {
                    const Icon = act.icon;
                    const isSelected = actionType === act.id;
                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => setActionType(act.id as ListingActionType)}
                        className={`flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                          isSelected
                            ? 'border-emerald-800 bg-emerald-50/40 ring-1 ring-emerald-800/20 shadow-2xs'
                            : 'border-stone-200 bg-white hover:border-stone-400'
                        }`}
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            isSelected
                              ? 'bg-emerald-800 text-white'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-stone-900 block">
                            {act.label}
                          </span>
                          <span className="text-[11px] text-stone-500 leading-tight block font-normal">
                            {act.desc}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {actionType === 'link' && (
                  <div className="space-y-1 pt-1">
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-stone-600">
                      External URL *
                    </label>
                    <input
                      type="url"
                      required
                      value={actionUrl}
                      onChange={(e) => setActionUrl(e.target.value)}
                      placeholder="https://example.com/apply or https://airbnb.com/..."
                      className="w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-800"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: SMART SPECS, TAGS & LIVE CARD PREVIEW */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
              {/* Quick Spec Presets based on Type */}
              <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-emerald-800" />
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-700">
                      Quick Specifications
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => handleAddCustomField()}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    <span>Add Custom Field</span>
                  </Button>
                </div>

                {/* Adaptive Quick Pills */}
                {listingType === 'housing' && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-[11px] font-mono text-stone-500 mr-1">Bedrooms:</span>
                      {['Studio', '1 Bed', '2 Beds', '3+ Beds'].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleQuickChip('Bedrooms', opt)}
                          className="rounded-lg bg-white border border-stone-200 px-2 py-0.5 text-xs text-stone-700 hover:border-emerald-700 hover:text-emerald-900"
                        >
                          +{opt}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-[11px] font-mono text-stone-500 mr-1">Furnished:</span>
                      {['Furnished', 'Unfurnished'].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleQuickChip('Furnished', opt)}
                          className="rounded-lg bg-white border border-stone-200 px-2 py-0.5 text-xs text-stone-700 hover:border-emerald-700 hover:text-emerald-900"
                        >
                          +{opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {listingType === 'job' && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-[11px] font-mono text-stone-500 mr-1">Workplace:</span>
                      {['Remote', 'Hybrid', 'On-site'].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleQuickChip('Workplace', opt)}
                          className="rounded-lg bg-white border border-stone-200 px-2 py-0.5 text-xs text-stone-700 hover:border-emerald-700 hover:text-emerald-900"
                        >
                          +{opt}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-[11px] font-mono text-stone-500 mr-1">Commitment:</span>
                      {['Full-time', 'Part-time', 'Gig / Contract'].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleQuickChip('Commitment', opt)}
                          className="rounded-lg bg-white border border-stone-200 px-2 py-0.5 text-xs text-stone-700 hover:border-emerald-700 hover:text-emerald-900"
                        >
                          +{opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current Custom Field Rows */}
                {customFields.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-stone-200/60">
                    {customFields.map((field, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          value={field.key}
                          onChange={(e) => handleUpdateCustomField(idx, e.target.value, field.value)}
                          placeholder="Specification Name"
                          className="w-1/3 rounded-xl border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-900 font-mono"
                        />
                        <input
                          value={field.value}
                          onChange={(e) => handleUpdateCustomField(idx, field.key, e.target.value)}
                          placeholder="Value (e.g. Flexible or 1 Year)"
                          className="w-1/2 rounded-xl border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-900"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomField(idx)}
                          className="rounded-lg p-1 text-stone-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags Section */}
              <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4 space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-stone-700">
                  Search Tags & Keywords
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="absolute left-3 top-2.5 h-3.5 w-3.5 text-stone-400" />
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="Type a tag and press Enter (e.g. Sublet, Urgent, Summer)..."
                      className="w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 py-1.5 text-xs text-stone-900"
                    />
                  </div>
                  <Button type="button" size="xs" variant="outline" onClick={handleAddTag}>
                    Add Tag
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-mono text-stone-700 border border-stone-200 shadow-2xs"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(t)}
                          className="text-stone-400 hover:text-stone-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Live Card Preview */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-stone-600">
                  <Eye className="h-3.5 w-3.5 text-emerald-800" />
                  <span>Feed Preview Card:</span>
                </div>

                <div className="max-w-md mx-auto rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-3 pointer-events-none opacity-95">
                  {imageUrls.length > 0 && (
                    <div className="h-36 w-full overflow-hidden rounded-xl bg-stone-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrls[0]} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-emerald-900 border border-emerald-200">
                      {listingType}
                    </span>
                    <span className="text-[11px] font-mono text-stone-400">#{category}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="text-sm font-bold text-stone-900 truncate">
                        {previewItem.title}
                      </h4>
                      <span className="text-xs font-black font-mono text-stone-900 shrink-0">
                        {formatListingPrice(previewItem)}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed">
                      {previewItem.description}
                    </p>
                  </div>
                  {location && (
                    <div className="flex items-center gap-1 text-[11px] text-stone-400">
                      <MapPin className="h-3 w-3" />
                      <span>{location}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation */}
        <div className="flex items-center justify-between border-t border-stone-100 px-6 py-4 bg-stone-50/60">
          <div>
            {currentStep > 1 && !editingListing ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setCurrentStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : 1))
                }
              >
                Back
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < 4 ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (currentStep === 2 && !title.trim()) {
                    setError('Please provide a listing title to continue.');
                    return;
                  }
                  setError(null);
                  setCurrentStep((prev) => (prev < 4 ? ((prev + 1) as 1 | 2 | 3 | 4) : 4));
                }}
                className="bg-emerald-800 hover:bg-emerald-900 text-white"
              >
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={loading}
                onClick={handleFinalSave}
                className="bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs"
              >
                {loading
                  ? 'Publishing...'
                  : editingListing
                  ? 'Update Listing'
                  : `Publish to ${circleName}`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
