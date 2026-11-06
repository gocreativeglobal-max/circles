'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Calendar,
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
  onSaved,
}: UniversalListingWizardModalProps) {
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
  const [priceCurrency] = useState('USD');

  const [actionType, setActionType] = useState<ListingActionType>('inquiry');
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
        setCustomFields(
          Object.entries(editingListing.custom_fields).map(([k, v]) => ({
            key: k,
            value: String(v ?? ''),
          }))
        );
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

  function handleSelectArchetype(archId: string) {
    setListingType(archId);
    const preset = LISTING_PRESETS[archId];
    if (preset) {
      setTransactionType(preset.defaultTransaction);
      setActionType(preset.defaultAction);
      setCustomFields(Object.entries(preset.fields).map(([key, value]) => ({ key, value })));
    } else {
      setTransactionType('fixed');
      setActionType('inquiry');
      setCustomFields([]);
    }
    const categories = POPULAR_CATEGORIES[archId] || POPULAR_CATEGORIES.product;
    setCategory(categories[0] || 'General');
    setCurrentStep(2);
  }

  function handleAddTag() {
    const clean = tagInput.trim().replace(/^#/, '');
    if (!clean) return;
    if (!tags.includes(clean)) setTags((prev) => [...prev, clean]);
    setTagInput('');
  }

  function handleQuickChip(key: string, value: string) {
    const idx = customFields.findIndex((f) => f.key.toLowerCase() === key.toLowerCase());
    if (idx >= 0) {
      setCustomFields((prev) => prev.map((f, i) => (i === idx ? { key, value } : f)));
    } else {
      setCustomFields((prev) => [...prev, { key, value }]);
    }
  }

  async function handleFinalSave() {
    if (!title.trim()) {
      setError('Title is required.');
      setCurrentStep(2);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const isEdit = Boolean(editingListing?.id);
      const parsedImages = imageUrls
        .map((u) => u.trim())
        .filter((u) => u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/'));

      const fieldsObj: Record<string, string> = {};
      customFields.forEach(({ key, value }) => {
        if (key.trim()) fieldsObj[key.trim()] = value.trim();
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

      const res = await fetch(`/api/circles/${circleId}/marketplace`, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save listing.');

      onSaved(data.listing, isEdit);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save listing.');
    } finally {
      setLoading(false);
    }
  }

  const previewItem = {
    title: title.trim() || 'Untitled listing',
    description: description.trim(),
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
  };

  const inputClass =
    'w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#2D6A4F] focus:outline-none';
  const labelClass = 'block text-xs font-medium text-stone-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            {currentStep > 1 && !editingListing && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : 1))}
                className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="text-sm font-semibold text-stone-900">
              {editingListing ? 'Edit listing' : 'New listing'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  className={`h-1.5 rounded-full transition-all ${
                    currentStep === n
                      ? 'w-5 bg-[#1B4332]'
                      : currentStep > n
                      ? 'w-1.5 bg-[#40916C]'
                      : 'w-1.5 bg-stone-200'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {error && (
            <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-700">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Step 1: Type */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-stone-900">What are you listing?</h3>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {ARCHETYPES.map((arch) => {
                  const Icon = arch.icon;
                  const selected = listingType === arch.id;
                  return (
                    <button
                      key={arch.id}
                      type="button"
                      onClick={() => handleSelectArchetype(arch.id)}
                      className={`flex flex-col items-start gap-2.5 rounded-xl border p-3.5 text-left transition-colors ${
                        selected
                          ? 'border-[#1B4332] bg-[#F4F3EE] text-stone-900'
                          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                          selected ? 'bg-[#1B4332] text-white' : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium">{arch.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Basics */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Title</label>
                <input
                  required
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What are you offering?"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Category</label>
                <div className="flex flex-wrap gap-1.5">
                  {(POPULAR_CATEGORIES[listingType] || POPULAR_CATEGORIES.product).map((cat) => {
                    const active = category.toLowerCase() === cat.toLowerCase();
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? 'bg-[#1B4332] text-white'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Neighborhood, building, or remote"
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Photos</label>
                <ImageUploader
                  circleId={circleId}
                  value={imageUrls}
                  onChange={setImageUrls}
                  multiple
                  maxFiles={8}
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add key details..."
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Step 3: Pricing & Action */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="space-y-2.5">
                <label className={labelClass}>Pricing</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { id: 'fixed', label: 'Fixed' },
                    { id: 'rate', label: 'Rate' },
                    { id: 'range', label: 'Range' },
                    { id: 'free', label: 'Free' },
                    { id: 'negotiable', label: 'Open' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setTransactionType(m.id as ListingTransactionType)}
                      className={`rounded-xl border py-2 text-xs font-medium transition-colors ${
                        transactionType === m.id
                          ? 'border-[#1B4332] bg-[#F4F3EE] text-[#1B4332]'
                          : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {transactionType === 'fixed' && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-sm font-medium text-stone-500">$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      autoFocus
                      value={priceAmount}
                      onChange={(e) => setPriceAmount(e.target.value)}
                      placeholder="0.00"
                      className={`${inputClass} w-36`}
                    />
                  </div>
                )}

                {transactionType === 'rate' && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-sm font-medium text-stone-500">$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      autoFocus
                      value={priceAmount}
                      onChange={(e) => setPriceAmount(e.target.value)}
                      placeholder="0.00"
                      className={`${inputClass} w-28`}
                    />
                    <span className="text-xs text-stone-400">/</span>
                    <div className="flex gap-1">
                      {[
                        { id: 'hourly', label: 'hr' },
                        { id: 'daily', label: 'day' },
                        { id: 'weekly', label: 'wk' },
                        { id: 'monthly', label: 'mo' },
                      ].map((int) => (
                        <button
                          key={int.id}
                          type="button"
                          onClick={() => setRateInterval(int.id as ListingRateInterval)}
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                            rateInterval === int.id
                              ? 'bg-[#1B4332] text-white'
                              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                          }`}
                        >
                          {int.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {transactionType === 'range' && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-sm font-medium text-stone-500">$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      placeholder="Min"
                      className={`${inputClass} w-28`}
                    />
                    <span className="text-xs text-stone-400">–</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      placeholder="Max"
                      className={`${inputClass} w-28`}
                    />
                  </div>
                )}

                {transactionType === 'negotiable' && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-sm font-medium text-stone-500">$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={priceAmount}
                      onChange={(e) => setPriceAmount(e.target.value)}
                      placeholder="Suggested price (optional)"
                      className={`${inputClass} w-48`}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2.5 border-t border-stone-100 pt-4">
                <label className={labelClass}>How members respond</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'inquiry', label: 'Message', icon: MessageSquare },
                    { id: 'booking', label: 'Book slot', icon: Calendar },
                    { id: 'application', label: 'Apply', icon: Send },
                    { id: 'link', label: 'External link', icon: ExternalLink },
                  ].map((act) => {
                    const Icon = act.icon;
                    const selected = actionType === act.id;
                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => setActionType(act.id as ListingActionType)}
                        className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm font-medium transition-colors ${
                          selected
                            ? 'border-[#1B4332] bg-[#F4F3EE] text-[#1B4332]'
                            : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{act.label}</span>
                      </button>
                    );
                  })}
                </div>

                {actionType === 'link' && (
                  <input
                    type="url"
                    required
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                    placeholder="https://..."
                    className={inputClass}
                  />
                )}
              </div>
            </div>
          )}

          {/* Step 4: Details & Preview */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="space-y-2.5 rounded-xl border border-stone-200 bg-stone-50/60 p-3.5">
                <div className="flex items-center justify-between">
                  <span className={labelClass}>Specifications</span>
                  <button
                    type="button"
                    onClick={() => setCustomFields((prev) => [...prev, { key: '', value: '' }])}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#1B4332] hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add field
                  </button>
                </div>

                {QUICK_CHIPS[listingType]?.map((group) => (
                  <div key={group.key} className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs text-stone-400">{group.key}:</span>
                    {group.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleQuickChip(group.key, opt)}
                        className="rounded-lg border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-700 hover:border-[#1B4332]"
                      >
                        +{opt}
                      </button>
                    ))}
                  </div>
                ))}

                {customFields.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {customFields.map((field, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          value={field.key}
                          onChange={(e) =>
                            setCustomFields((prev) =>
                              prev.map((f, i) => (i === idx ? { ...f, key: e.target.value } : f))
                            )
                          }
                          placeholder="Label"
                          className="w-1/3 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-900"
                        />
                        <input
                          value={field.value}
                          onChange={(e) =>
                            setCustomFields((prev) =>
                              prev.map((f, i) => (i === idx ? { ...f, value: e.target.value } : f))
                            )
                          }
                          placeholder="Value"
                          className="flex-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-900"
                        />
                        <button
                          type="button"
                          onClick={() => setCustomFields((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-stone-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Tags</label>
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Add tag and press Enter"
                    className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                  >
                    Add
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-700"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                          className="text-stone-400 hover:text-stone-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="space-y-1.5 pt-1">
                <span className={labelClass}>Preview</span>
                <div className="rounded-xl border border-stone-200 bg-white p-3.5">
                  {imageUrls.length > 0 && (
                    <div className="mb-3 h-36 w-full overflow-hidden rounded-lg bg-stone-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrls[0]} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="truncate text-sm font-semibold text-stone-900">
                      {previewItem.title}
                    </h4>
                    <span className="shrink-0 text-sm font-semibold text-[#1B4332]">
                      {formatListingPrice(previewItem)}
                    </span>
                  </div>
                  {previewItem.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-stone-500">
                      {previewItem.description}
                    </p>
                  )}
                  {location && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-stone-400">
                      <MapPin className="h-3 w-3" />
                      {location}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-100 px-5 py-3.5">
          {currentStep > 1 && !editingListing ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => (prev > 1 ? ((prev - 1) as 1 | 2 | 3 | 4) : 1))}
              className="rounded-lg px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100"
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100"
            >
              Cancel
            </button>
          )}

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={() => {
                if (currentStep === 2 && !title.trim()) {
                  setError('Title is required.');
                  return;
                }
                setError(null);
                setCurrentStep((prev) => (prev < 4 ? ((prev + 1) as 1 | 2 | 3 | 4) : 4));
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1B4332] px-4 py-2 text-sm font-medium text-white hover:bg-[#2D6A4F]"
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleFinalSave}
              className="rounded-lg bg-[#1B4332] px-4 py-2 text-sm font-medium text-white hover:bg-[#2D6A4F] disabled:opacity-50"
            >
              {loading ? 'Saving…' : editingListing ? 'Save' : 'Publish'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
