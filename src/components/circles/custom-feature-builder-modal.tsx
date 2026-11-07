'use client';

import React, { useState } from 'react';
import {
  Check,
  Code2,
  Columns3,
  LayoutGrid,
  MessageSquare,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  Wallet,
  Wand2,
  X,
} from 'lucide-react';
import {
  CircleCustomModuleField,
  CircleCustomModuleItem,
} from '@/types/domain';
import {
  BUILT_IN_CUSTOM_FEATURE_TEMPLATES,
  CustomFeatureTemplatePreset,
} from '@/features/custom-modules/presets';

const ICON_OPTIONS = [
  { value: 'sparkles', label: 'Sparkles' },
  { value: 'graduation-cap', label: 'Mentorship / Cap' },
  { value: 'heart', label: 'Heart / Care' },
  { value: 'rocket', label: 'Rocket / Pitch' },
  { value: 'lightbulb', label: 'Ideas / Bulb' },
  { value: 'compass', label: 'Compass / Local' },
  { value: 'briefcase', label: 'Briefcase / Work' },
  { value: 'book-open', label: 'Book / Library' },
  { value: 'award', label: 'Award / Trophy' },
];

const CURRENCY_OPTIONS = [
  'USD',
  'NGN',
  'GHS',
  'KES',
  'ZAR',
  'EUR',
  'GBP',
  'CAD',
  'UGX',
  'TZS',
  'RWF',
  'ZMW',
  'USDT',
  'USDC',
];

export function CustomFeatureBuilderModal({
  circleId,
  isStaff,
  sharedTemplates = BUILT_IN_CUSTOM_FEATURE_TEMPLATES,
  onClose,
  onCreated,
}: {
  circleId: string;
  isStaff: boolean;
  sharedTemplates?: CustomFeatureTemplatePreset[];
  onClose: () => void;
  onCreated: (mod: CircleCustomModuleItem) => void;
}) {
  const [promptText, setPromptText] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('sparkles');
  const [layoutType, setLayoutType] = useState<'cards' | 'wall' | 'board' | 'embed'>('cards');
  const [embedUrl, setEmbedUrl] = useState('');
  const [reactionLabel, setReactionLabel] = useState('Upvote');
  const [enablePayments, setEnablePayments] = useState(false);
  const [paymentLabel, setPaymentLabel] = useState('Support / Tip');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [postingPolicy, setPostingPolicy] = useState<'all_members' | 'admins_only'>('all_members');
  const [isSharedTemplate, setIsSharedTemplate] = useState(false);
  const [boardColumns, setBoardColumns] = useState<string[]>([
    'Open',
    'In Progress',
    'Completed',
  ]);
  const [fieldsSchema, setFieldsSchema] = useState<CircleCustomModuleField[]>([]);

  // New custom field draft
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<CircleCustomModuleField['type']>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyPreset(preset: CustomFeatureTemplatePreset) {
    setName(preset.name);
    setDescription(preset.description);
    setIcon(preset.icon);
    setLayoutType(preset.layoutType);
    setReactionLabel(preset.reactionLabel);
    setEnablePayments(preset.enablePayments);
    setPaymentLabel(preset.paymentLabel);
    setBoardColumns(preset.boardColumns);
    setFieldsSchema(preset.fieldsSchema);
  }

  async function handleGenerateFromPrompt() {
    if (!promptText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/custom-modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_from_prompt',
          prompt: promptText.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.preset) {
        applyPreset(data.preset);
      }
    } catch {
      // Ignore
    } finally {
      setBusy(false);
    }
  }

  function handleAddField() {
    if (!newFieldLabel.trim()) return;
    const key = newFieldLabel
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const options =
      newFieldType === 'select'
        ? newFieldOptions
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    setFieldsSchema((prev) => [
      ...prev,
      {
        key: key || `field_${prev.length + 1}`,
        label: newFieldLabel.trim(),
        type: newFieldType,
        required: false,
        options,
      },
    ]);
    setNewFieldLabel('');
    setNewFieldOptions('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/custom-modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_module',
          name: name.trim(),
          description: description.trim(),
          icon,
          layoutType,
          embedUrl: layoutType === 'embed' ? embedUrl.trim() : null,
          fieldsSchema,
          boardColumns,
          reactionLabel: reactionLabel.trim() || 'Upvote',
          enablePayments,
          paymentLabel: paymentLabel.trim() || 'Support / Tip',
          defaultCurrency,
          postingPolicy,
          isSharedTemplate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create custom feature.');
      onCreated(data.module);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create custom feature.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 shadow-xl max-h-[92vh] overflow-y-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stone-100 pb-3">
          <div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#1B4332]">
              <Sparkles className="h-3 w-3" />
              <span>{isStaff ? 'No-Code Feature Studio' : 'Propose a Community Feature'}</span>
            </span>
            <h3 className="text-base font-bold text-stone-900">
              {isStaff
                ? 'Build a Custom Feature for Your Circle'
                : 'Build & Propose a Feature for This Circle'}
            </h3>
            <p className="text-xs text-stone-500">
              {isStaff
                ? 'Create a custom module that appears directly in your Circle side menu.'
                : 'Design a custom feature for your community. Once a Circle Admin approves it, it goes live in the side menu!'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step 1: AI Prompt-to-Feature OR 1-Click Templates */}
        <div className="rounded-2xl border border-stone-200/80 bg-[#F4F3EE]/60 p-4 space-y-3">
          <label className="block text-xs font-semibold text-stone-800">
            Quick Start: Describe the feature you want (or pick a template below)
          </label>
          <div className="flex gap-2">
            <input
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="e.g., Mentorship directory where seniors list expertise and charge for 30-min sessions..."
              className="flex-1 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs text-stone-900 focus:border-[#1B4332] focus:outline-none"
            />
            <button
              type="button"
              disabled={busy || !promptText.trim()}
              onClick={handleGenerateFromPrompt}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B4332] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-40 shrink-0"
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span>Auto-Build</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {sharedTemplates.slice(0, 6).map((tpl) => (
              <button
                key={tpl.key}
                type="button"
                onClick={() => applyPreset(tpl)}
                className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-700 hover:border-[#1B4332] hover:text-[#1B4332] transition-colors"
              >
                + {tpl.name}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name, Icon, Posting Policy */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-700">
                Feature Name (Side Menu Label)
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Mentorship Board, Prayer Wall, Startup Pitches"
                className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900 focus:border-[#1B4332] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700">Menu Icon</label>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-900 focus:border-[#1B4332] focus:bg-white focus:outline-none"
              >
                {ICON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700">Short Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What can members do in this feature?"
              className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900 focus:border-[#1B4332] focus:bg-white focus:outline-none"
            />
          </div>

          {/* Layout Engine */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">
              Choose Layout Engine
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { id: 'cards', label: 'Card Directory', desc: 'Grid of cards', icon: LayoutGrid },
                { id: 'wall', label: 'Feed / Wall', desc: 'Social stream', icon: MessageSquare },
                { id: 'board', label: 'Status Board', desc: 'Track stages', icon: Columns3 },
                { id: 'embed', label: 'Embedded App', desc: 'External URL', icon: Code2 },
              ].map((lt) => {
                const Icon = lt.icon;
                const active = layoutType === lt.id;
                return (
                  <button
                    key={lt.id}
                    type="button"
                    onClick={() => setLayoutType(lt.id as typeof layoutType)}
                    className={`flex flex-col items-start rounded-xl border p-2.5 text-left transition-all ${
                      active
                        ? 'border-[#1B4332] bg-[#F4F3EE]/80'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <Icon className="h-4 w-4 text-[#1B4332]" />
                    <span className="mt-1 text-xs font-semibold text-stone-900">{lt.label}</span>
                    <span className="text-[10px] text-stone-500">{lt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {layoutType === 'embed' ? (
            <div>
              <label className="block text-xs font-medium text-stone-700">
                External App / Document URL to Embed
              </label>
              <input
                type="url"
                required
                value={embedUrl}
                onChange={(e) => setEmbedUrl(e.target.value)}
                placeholder="https://airtable.com/embed/... or Google Form / Notion / Typeform URL"
                className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-xs text-stone-900 focus:border-[#1B4332] focus:bg-white focus:outline-none"
              />
            </div>
          ) : (
            <>
              {/* Custom Form Fields Builder */}
              <div className="rounded-xl border border-stone-200/80 bg-stone-50/50 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-800">
                    Custom Form Fields ({fieldsSchema.length})
                  </span>
                  <span className="text-[11px] text-stone-500">
                    Title & Description are included automatically
                  </span>
                </div>

                {fieldsSchema.length > 0 && (
                  <div className="space-y-1.5">
                    {fieldsSchema.map((f, idx) => (
                      <div
                        key={f.key}
                        className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-stone-800">{f.label}</span>
                          <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">
                            {f.type}
                          </span>
                          {f.options && f.options.length > 0 && (
                            <span className="ml-2 text-[11px] text-stone-400">
                              ({f.options.join(', ')})
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFieldsSchema((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-stone-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    placeholder="Field label (e.g., Expertise, Location, Github URL)"
                    className="flex-1 min-w-[160px] rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <select
                    value={newFieldType}
                    onChange={(e) =>
                      setNewFieldType(e.target.value as CircleCustomModuleField['type'])
                    }
                    className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="text">Short Text</option>
                    <option value="textarea">Long Text</option>
                    <option value="select">Dropdown</option>
                    <option value="url">Link URL</option>
                    <option value="date">Date</option>
                    <option value="number">Number</option>
                  </select>
                  {newFieldType === 'select' && (
                    <input
                      value={newFieldOptions}
                      onChange={(e) => setNewFieldOptions(e.target.value)}
                      placeholder="Options comma-separated (e.g. Beginner, Pro)"
                      className="w-full sm:w-52 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs"
                    />
                  )}
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Field</span>
                  </button>
                </div>
              </div>

              {/* Interaction, Payments & Permissions */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-stone-700">
                    Reaction / Upvote Button Label
                  </label>
                  <input
                    value={reactionLabel}
                    onChange={(e) => setReactionLabel(e.target.value)}
                    placeholder="e.g., Upvote, Amen / Praying, Interested"
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700">
                    Who can add entries?
                  </label>
                  <select
                    value={postingPolicy}
                    onChange={(e) =>
                      setPostingPolicy(e.target.value as 'all_members' | 'admins_only')
                    }
                    className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs text-stone-900"
                  >
                    <option value="all_members">All Active Members</option>
                    <option value="admins_only">Admins & Moderators Only</option>
                  </select>
                </div>
              </div>

              {/* Optional Payment / Tip / Booking Integration */}
              <div className="rounded-xl border border-stone-200 p-3.5 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-stone-800">
                    <Wallet className="h-4 w-4 text-[#1B4332]" />
                    <span>Enable Payments, Tips, or Paid Bookings on Entries</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={enablePayments}
                    onChange={(e) => setEnablePayments(e.target.checked)}
                    className="rounded border-stone-300 text-[#1B4332]"
                  />
                </label>

                {enablePayments && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-stone-600">
                        Payment Button Label
                      </label>
                      <input
                        value={paymentLabel}
                        onChange={(e) => setPaymentLabel(e.target.value)}
                        placeholder="e.g., Book Session, Send Tip"
                        className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-stone-600">
                        Default Currency
                      </label>
                      <select
                        value={defaultCurrency}
                        onChange={(e) => setDefaultCurrency(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs"
                      >
                        {CURRENCY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Share to Global Circles Feature Library */}
          <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isSharedTemplate}
              onChange={(e) => setIsSharedTemplate(e.target.checked)}
              className="rounded border-stone-300 text-[#1B4332]"
            />
            <Share2 className="h-3.5 w-3.5 text-stone-400" />
            <span>
              Share this feature template to the <strong>Circles Feature Library</strong> so other
              communities can install it too
            </span>
          </label>

          <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1B4332] px-5 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              <span>
                {busy
                  ? 'Saving...'
                  : isStaff
                    ? 'Create & Add to Side Menu'
                    : 'Submit Feature Proposal'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
