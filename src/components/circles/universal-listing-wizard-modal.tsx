'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Calendar,
  CreditCard,
  ExternalLink,
  Home,
  MapPin,
  MessageSquare,
  Package,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { ImageUploader } from '@/components/ui/image-uploader';
import {
  ListingActionType,
  ListingRateInterval,
  ListingTransactionType,
  MarketplaceCircleSettings,
  MarketplaceListingItem,
} from '@/types/domain';
import { formatListingPrice, LISTING_PRESETS } from '@/features/marketplace/listing-helpers';
import {
  BACHS_ACCEPTED_CURRENCIES,
  formatBachsAmount,
  getBachsCurrency,
} from '@/lib/payments/currencies';

export interface UniversalListingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  circleId: string;
  circleSlug?: string;
  circleName?: string;
  editingListing?: MarketplaceListingItem | null;
  marketplaceSettings?: MarketplaceCircleSettings;
  isStaff?: boolean;
  onSaved: (savedListing: MarketplaceListingItem, isEdit: boolean) => void;
}

const ARCHETYPES = [
  { id: 'housing', label: 'Housing', icon: Home },
  { id: 'job', label: 'Job or gig', icon: Briefcase },
  { id: 'rental', label: 'Tool or rental', icon: Wrench },
  { id: 'service', label: 'Service', icon: Zap },
  { id: 'product', label: 'Item for sale', icon: Package },
  { id: 'custom', label: 'Other', icon: Sparkles },
];

const POPULAR_CATEGORIES: Record<string, string[]> = {
  housing: ['Sublet', 'Private Room', 'Shared Room', 'Parking', 'Storage', 'General'],
  job: ['Engineering', 'Design', 'Tutoring', 'Gig', 'Operations', 'General'],
  rental: ['Tools', 'Outdoors', 'Camera & AV', 'Events', 'General'],
  service: ['Tutoring', 'Design & Tech', 'Repair', 'Coaching', 'General'],
  product: ['Electronics', 'Books', 'Furniture', 'Clothing', 'Outdoors', 'General'],
  custom: ['Carpool', 'Lost & Found', 'Request', 'Study Group', 'General'],
};

const QUICK_CHIPS: Record<string, Array<{ key: string; options: string[] }>> = {
  housing: [
    { key: 'Bedrooms', options: ['Studio', '1 Bed', '2 Beds', '3+ Beds'] },
    { key: 'Furnished', options: ['Furnished', 'Unfurnished'] },
  ],
  job: [
    { key: 'Workplace', options: ['Remote', 'Hybrid', 'On-site'] },
    { key: 'Type', options: ['Full-time', 'Part-time', 'Contract'] },
  ],
};

export function UniversalListingWizardModal({
  isOpen,
  onClose,
  circleId,
  editingListing = null,
  marketplaceSettings,
  isStaff = false,
  onSaved,
}: UniversalListingWizardModalProps) {
  const defaultCurrency = (marketplaceSettings?.defaultCurrency || 'USD').toUpperCase();
  const allowMultiCurrency = marketplaceSettings?.allowMultiCurrency !== false;
  const allowedTypes = marketplaceSettings?.allowedListingTypes;
  const visibleArchetypes = ARCHETYPES.filter((a) => {
    if (!allowedTypes || allowedTypes.length === 0) return true;
    if (a.id === 'housing') {
      return allowedTypes.includes('housing') || allowedTypes.includes('property');
    }
    return allowedTypes.includes(a.id);
  });

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(editingListing ? 2 : 1);

  const [listingType, setListingType] = useState<string>('product');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [status, setStatus] = useState<'published' | 'draft' | 'reserved' | 'sold'>('published');

  const [transactionType, setTransactionType] = useState<ListingTransactionType>('fixed');
  const [rateInterval, setRateInterval] = useState<ListingRateInterval>('monthly');
  const [priceAmount, setPriceAmount] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [priceCurrency, setPriceCurrency] = useState(defaultCurrency);

  const [actionType, setActionType] = useState<ListingActionType>('checkout');
  const [actionUrl, setActionUrl] = useState('');

  const [customFields, setCustomFields] = useState<Array<{ key: string; value: string }>>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      const tType =
        editingListing.transaction_type ||
        (editingListing.pricing_unit === 'free'
          ? 'free'
          : editingListing.pricing_unit === 'negotiable'
            ? 'negotiable'
            : ['hourly', 'daily', 'monthly'].includes(editingListing.pricing_unit)
              ? 'rate'
              : 'fixed');

      setTransactionType(tType as ListingTransactionType);
      setRateInterval(
        (editingListing.rate_interval as ListingRateInterval) ||
          (['hourly', 'daily', 'monthly'].includes(editingListing.pricing_unit)
            ? (editingListing.pricing_unit as ListingRateInterval)
            : 'monthly')
      );
      setPriceAmount(editingListing.price_amount != null ? String(editingListing.price_amount) : '');
      setPriceMin(editingListing.price_min != null ? String(editingListing.price_min) : '');
      setPriceMax(editingListing.price_max != null ? String(editingListing.price_max) : '');
      setPriceCurrency(
        (editingListing.price_currency || defaultCurrency).toUpperCase()
      );
      setActionType(editingListing.action_type || 'inquiry');
      setActionUrl(editingListing.action_url || '');

      const cf = editingListing.custom_fields || {};
      setCustomFields(
        Object.entries(cf).map(([k, v]) => ({ key: k, value: String(v ?? '') }))
      );
      setTags(Array.isArray(editingListing.tags) ? editingListing.tags : []);
    } else {
      const firstAllowed = visibleArchetypes[0]?.id || 'product';
      setCurrentStep(visibleArchetypes.length === 1 ? 2 : 1);
      setPriceCurrency(defaultCurrency);
      applyArchetypeDefaults(firstAllowed);
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingListing, isOpen, defaultCurrency]);

  function applyArchetypeDefaults(typeKey: string) {
    setListingType(typeKey);
    const preset = LISTING_PRESETS[typeKey];
    const cats = POPULAR_CATEGORIES[typeKey] || ['General'];
    setCategory(cats[0] || 'General');

    if (preset) {
      setTransactionType(preset.defaultTransaction);
      setActionType(typeKey === 'product' ? 'checkout' : preset.defaultAction);
      setCustomFields(
        Object.entries(preset.fields).map(([k, v]) => ({ key: k, value: v }))
      );
      if (typeKey === 'housing') setRateInterval('monthly');
      if (typeKey === 'rental') setRateInterval('daily');
      if (typeKey === 'service') setRateInterval('hourly');
    } else {
      setTransactionType('fixed');
      setActionType('inquiry');
      setCustomFields([]);
    }
  }

  function handleSelectArchetype(id: string) {
    applyArchetypeDefaults(id);
    setCurrentStep(2);
  }

  function handleQuickChipSelect(fieldKey: string, optionValue: string) {
    setCustomFields((prev) => {
      const idx = prev.findIndex((f) => f.key.toLowerCase() === fieldKey.toLowerCase());
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { key: fieldKey, value: optionValue };
        return next;
      }
      return [...prev, { key: fieldKey, value: optionValue }];
    });
  }

  function handleAddTag() {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  }

  function goNext() {
    setError(null);
    if (currentStep === 2) {
      if (title.trim().length < 3) {
        setError('Please enter a title (at least 3 characters).');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (actionType === 'checkout' && (!priceAmount || Number(priceAmount) <= 0)) {
        setError('Please enter a price greater than 0 for on-platform checkout.');
        return;
      }
      setCurrentStep(4);
    }
  }

  function goBack() {
    setError(null);
    if (currentStep === 2 && !editingListing && visibleArchetypes.length > 1) setCurrentStep(1);
    else if (currentStep === 3) setCurrentStep(2);
    else if (currentStep === 4) setCurrentStep(3);
  }

  const normalizedTypeForPay = listingType === 'housing' ? 'property' : listingType;
  const requiresPayToPost =
    !editingListing &&
    !isStaff &&
    Boolean(marketplaceSettings?.payToPostEnabled) &&
    Number(marketplaceSettings?.payToPostFeeAmount ?? 0) > 0 &&
    ((marketplaceSettings?.payToPostTypes || []).includes('all') ||
      (marketplaceSettings?.payToPostTypes || []).includes(listingType) ||
      (marketplaceSettings?.payToPostTypes || []).includes(normalizedTypeForPay));

  async function handleSubmit() {
    if (title.trim().length < 3) {
      setError('Title must be at least 3 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    const customFieldsObject: Record<string, string> = {};
    for (const pair of customFields) {
      const k = pair.key.trim();
      const v = pair.value.trim();
      if (k && v) customFieldsObject[k] = v;
    }

    let legacyPricingUnit: 'fixed' | 'hourly' | 'daily' | 'monthly' | 'free' | 'negotiable' =
      'fixed';
    if (transactionType === 'free') legacyPricingUnit = 'free';
    else if (transactionType === 'negotiable' || transactionType === 'range')
      legacyPricingUnit = 'negotiable';
    else if (transactionType === 'rate') {
      if (rateInterval === 'hourly' || rateInterval === 'daily' || rateInterval === 'monthly') {
        legacyPricingUnit = rateInterval;
      } else {
        legacyPricingUnit = 'monthly';
      }
    }

    const payload = {
      ...(editingListing ? { listingId: editingListing.id } : {}),
      listingType: listingType === 'housing' ? 'property' : listingType,
      category: category.trim() || 'General',
      title: title.trim(),
      description: description.trim(),
      location: location.trim() || null,
      imageUrls: imageUrls.filter(Boolean),
      status,
      transactionType,
      rateInterval: transactionType === 'rate' ? rateInterval : null,
      priceAmount:
        (transactionType === 'fixed' ||
          transactionType === 'rate' ||
          transactionType === 'negotiable') &&
        priceAmount !== ''
          ? Number(priceAmount)
          : null,
      priceMin: transactionType === 'range' && priceMin !== '' ? Number(priceMin) : null,
      priceMax: transactionType === 'range' && priceMax !== '' ? Number(priceMax) : null,
      priceCurrency: allowMultiCurrency ? priceCurrency : defaultCurrency,
      pricingUnit: legacyPricingUnit,
      actionType,
      actionUrl: actionType === 'link' && actionUrl.trim() ? actionUrl.trim() : null,
      customFields: customFieldsObject,
      tags,
    };

    try {
      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: editingListing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save listing.');
        return;
      }
      onSaved(data.listing, Boolean(editingListing));
      onClose();
    } catch {
      setError('Network error while saving listing.');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const activeCurrencyDef = getBachsCurrency(allowMultiCurrency ? priceCurrency : defaultCurrency);
  const previewPrice = formatListingPrice({
    transaction_type: transactionType,
    rate_interval: rateInterval,
    price_amount: priceAmount !== '' ? Number(priceAmount) : null,
    price_min: priceMin !== '' ? Number(priceMin) : null,
    price_max: priceMax !== '' ? Number(priceMax) : null,
    price_currency: activeCurrencyDef.code,
  });

  const activeCategories = POPULAR_CATEGORIES[listingType] || ['General'];
  const activeQuickChips = QUICK_CHIPS[listingType] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
        {/* Top Bar */}
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div className="flex items-center gap-3">
            {currentStep > 1 && !(editingListing && currentStep === 2) && (
              <button
                type="button"
                onClick={goBack}
                className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h3 className="text-base font-semibold text-stone-900">
              {editingListing ? 'Edit listing' : 'New listing'}
            </h3>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map((s) => (
                <span
                  key={s}
                  className={`h-1.5 rounded-full transition-all ${
                    currentStep === s
                      ? 'w-5 bg-black'
                      : currentStep > s
                        ? 'w-2 bg-[#52525b]'
                        : 'w-2 bg-stone-200'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          {/* STEP 1: SELECT TYPE */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-stone-700">What are you listing?</p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {visibleArchetypes.map((arch) => {
                  const Icon = arch.icon;
                  const selected = listingType === arch.id;
                  return (
                    <button
                      key={arch.id}
                      type="button"
                      onClick={() => handleSelectArchetype(arch.id)}
                      className={`flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                        selected
                          ? 'border-stone-900 bg-[#F4F3EE]/70 text-stone-900'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50/60'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-sm font-semibold">{arch.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: CORE DETAILS */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sunny 1BR sublet near campus"
                  className="mt-1.5 w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm text-stone-900 focus:border-black focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-stone-700">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-black focus:outline-none"
                  >
                    {activeCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700">Location</label>
                  <div className="relative mt-1.5">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="City, area, or Remote"
                      className="w-full rounded-xl border border-stone-200 py-2.5 pl-9 pr-3 text-sm text-stone-900 focus:border-black focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {activeQuickChips.map((group) => {
                const currentVal =
                  customFields.find((f) => f.key.toLowerCase() === group.key.toLowerCase())?.value ||
                  '';
                return (
                  <div key={group.key}>
                    <label className="block text-xs font-medium text-stone-700">{group.key}</label>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {group.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleQuickChipSelect(group.key, opt)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            currentVal === opt
                              ? 'border-stone-900 bg-black text-white'
                              : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">Photos</label>
                <ImageUploader
                  circleId={circleId}
                  value={imageUrls}
                  onChange={(val: string | string[]) =>
                    setImageUrls(Array.isArray(val) ? val : [val])
                  }
                  multiple
                  maxFiles={6}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Share key details..."
                  className="mt-1.5 w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm text-stone-900 focus:border-black focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* STEP 3: PRICING, CURRENCY & ACTION */}
          {currentStep === 3 && (
            <div className="space-y-5">
              {/* Currency Selector */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-[#FAF9F6] px-3.5 py-2.5">
                <span className="text-xs font-medium text-stone-700">Currency</span>
                {allowMultiCurrency ? (
                  <select
                    value={priceCurrency}
                    onChange={(e) => setPriceCurrency(e.target.value)}
                    className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-900 focus:border-black focus:outline-none"
                  >
                    {BACHS_ACCEPTED_CURRENCIES.map((cur) => (
                      <option key={cur.code} value={cur.code}>
                        {cur.code} ({cur.symbol}) — {cur.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-stone-800 border border-stone-200">
                    {activeCurrencyDef.code} ({activeCurrencyDef.symbol})
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-2">Pricing</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'fixed', label: 'Fixed' },
                    { id: 'rate', label: 'Recurring rate' },
                    { id: 'range', label: 'Range' },
                    { id: 'negotiable', label: 'Negotiable' },
                    { id: 'free', label: 'Free' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        const nextTrans = t.id as ListingTransactionType;
                        setTransactionType(nextTrans);
                        if (nextTrans === 'free' || nextTrans === 'range' || nextTrans === 'negotiable') {
                          if (actionType === 'checkout') setActionType('inquiry');
                        }
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        transactionType === t.id
                          ? 'border-stone-900 bg-black text-white'
                          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {(transactionType === 'fixed' ||
                  transactionType === 'rate' ||
                  transactionType === 'negotiable') && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-stone-400">
                        {activeCurrencyDef.symbol}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={priceAmount}
                        onChange={(e) => setPriceAmount(e.target.value)}
                        placeholder={transactionType === 'negotiable' ? 'Optional amount' : '0.00'}
                        className="w-full rounded-xl border border-stone-200 py-2.5 pl-10 pr-3 text-sm text-stone-900 focus:border-black focus:outline-none"
                      />
                    </div>

                    {transactionType === 'rate' && (
                      <select
                        value={rateInterval}
                        onChange={(e) => setRateInterval(e.target.value as ListingRateInterval)}
                        className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-black focus:outline-none"
                      >
                        <option value="hourly">/ hour</option>
                        <option value="daily">/ day</option>
                        <option value="weekly">/ week</option>
                        <option value="monthly">/ month</option>
                        <option value="annually">/ year</option>
                      </select>
                    )}
                  </div>
                )}

                {transactionType === 'range' && (
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <input
                      type="number"
                      min={0}
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      placeholder={`Min (${activeCurrencyDef.symbol})`}
                      className="w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm text-stone-900 focus:border-black focus:outline-none"
                    />
                    <input
                      type="number"
                      min={0}
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      placeholder={`Max (${activeCurrencyDef.symbol})`}
                      className="w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm text-stone-900 focus:border-black focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-2">
                  How buyers respond
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      id: 'checkout',
                      label: 'Buy on platform',
                      icon: CreditCard,
                      disabled:
                        transactionType === 'free' ||
                        transactionType === 'range' ||
                        transactionType === 'negotiable',
                    },
                    { id: 'inquiry', label: 'Message seller', icon: MessageSquare, disabled: false },
                    { id: 'booking', label: 'Book slot', icon: Calendar, disabled: false },
                    { id: 'application', label: 'Apply', icon: Send, disabled: false },
                    { id: 'link', label: 'External link', icon: ExternalLink, disabled: false },
                  ].map((a) => {
                    const Icon = a.icon;
                    const active = actionType === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        disabled={a.disabled}
                        onClick={() => setActionType(a.id as ListingActionType)}
                        className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-xs font-medium transition-colors disabled:opacity-40 ${
                          active
                            ? 'border-stone-900 bg-[#F4F3EE] text-stone-900'
                            : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{a.label}</span>
                      </button>
                    );
                  })}
                </div>

                {actionType === 'checkout' && (
                  <p className="mt-2 text-[11px] text-stone-500">
                    Buyers pay directly on Circles. Net earnings are credited to your Member Wallet.
                    {Number(marketplaceSettings?.commissionPercentage ?? 0) > 0 &&
                      ` (${marketplaceSettings?.commissionPercentage}% Circle commission applies)`}
                  </p>
                )}

                {actionType === 'link' && (
                  <input
                    type="url"
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-2.5 w-full rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm text-stone-900 focus:border-black focus:outline-none"
                  />
                )}
              </div>
            </div>
          )}

          {/* STEP 4: SPECS & PREVIEW */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-stone-700">Specifications</label>
                  <button
                    type="button"
                    onClick={() => setCustomFields([...customFields, { key: '', value: '' }])}
                    className="inline-flex items-center gap-1 text-xs font-medium text-stone-900 hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>

                <div className="space-y-2">
                  {customFields.map((pair, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={pair.key}
                        onChange={(e) => {
                          const next = [...customFields];
                          next[idx] = { ...next[idx], key: e.target.value };
                          setCustomFields(next);
                        }}
                        placeholder="Label"
                        className="w-1/3 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-900"
                      />
                      <input
                        type="text"
                        value={pair.value}
                        onChange={(e) => {
                          const next = [...customFields];
                          next[idx] = { ...next[idx], value: e.target.value };
                          setCustomFields(next);
                        }}
                        placeholder="Value"
                        className="flex-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-900"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCustomFields(customFields.filter((_, i) => i !== idx))
                        }
                        className="p-1 text-stone-400 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">Tags</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Add tag and press Enter"
                    className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-xs text-stone-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
                  >
                    Add
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-700"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => setTags(tags.filter((x) => x !== t))}
                          className="text-stone-400 hover:text-stone-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview Card */}
              <div className="rounded-xl border border-stone-200 bg-[#FAF9F6] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-medium text-stone-500">{category}</span>
                    <h4 className="text-sm font-semibold text-stone-900">
                      {title || 'Untitled listing'}
                    </h4>
                  </div>
                  <span className="rounded-lg bg-[#F4F3EE] px-2.5 py-1 text-xs font-semibold text-stone-900">
                    {previewPrice}
                  </span>
                </div>
              </div>

              {requiresPayToPost && (
                <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-[#F4F3EE] px-4 py-3 text-xs text-stone-900">
                  <span className="font-medium">Community posting fee</span>
                  <span className="font-bold">
                    {formatBachsAmount(
                      Math.round(Number(marketplaceSettings?.payToPostFeeAmount || 0) * 100),
                      defaultCurrency
                    )}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {currentStep > 1 && (
          <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/50 px-6 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium text-stone-500 hover:text-stone-800"
            >
              Cancel
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleSubmit}
                className="inline-flex items-center gap-1.5 rounded-xl bg-black px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                <span>
                  {loading
                    ? 'Processing...'
                    : editingListing
                      ? 'Save changes'
                      : requiresPayToPost
                        ? `Pay ${formatBachsAmount(
                            Math.round(Number(marketplaceSettings?.payToPostFeeAmount || 0) * 100),
                            defaultCurrency
                          )} & Publish`
                        : 'Publish'}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
