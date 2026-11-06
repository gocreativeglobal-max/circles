'use client';

import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  LayoutGrid,
  MapPin,
  Radio,
  Video,
  X,
} from 'lucide-react';
import {
  CircleEventItem,
  CircleMembership,
  CircleSpace,
} from '@/types/domain';
import { Button } from '@/components/ui/button';
import { ImageUploader } from '@/components/ui/image-uploader';

export interface EventCreationWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  circleId: string;
  circleSlug?: string;
  spaces: CircleSpace[];
  members: CircleMembership[];
  currentUserId?: string | null;
  onEventCreated: (event: CircleEventItem) => void;
}

const WEEKDAYS = [
  { key: 'Mon', label: 'M' },
  { key: 'Tue', label: 'T' },
  { key: 'Wed', label: 'W' },
  { key: 'Thu', label: 'T' },
  { key: 'Fri', label: 'F' },
  { key: 'Sat', label: 'S' },
  { key: 'Sun', label: 'S' },
];

export function EventCreationWizardModal({
  isOpen,
  onClose,
  circleId,
  circleSlug: _circleSlug = 'community',
  spaces = [],
  members = [],
  currentUserId,
  onEventCreated,
}: EventCreationWizardModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Details
  const [title, setTitle] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [hostId, setHostId] = useState(currentUserId || '');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');

  // Step 2: Date & Repeat
  const now = Date.now();
  const defaultStart = new Date(now + 86400_000);
  const defaultEnd = new Date(now + 90000_000);
  const [startsAt, setStartsAt] = useState(() => defaultStart.toISOString().slice(0, 16));
  const [endsAt, setEndsAt] = useState(() => defaultEnd.toISOString().slice(0, 16));
  const [repeatFrequency, setRepeatFrequency] = useState<'none' | 'weekly' | 'biweekly' | 'monthly'>('none');
  const [repeatDays, setRepeatDays] = useState<string[]>(['Sun']);
  const [repeatEnds, setRepeatEnds] = useState<'never' | 'on_date' | 'after_occurrences'>('never');
  const [repeatEndDate, setRepeatEndDate] = useState<string>('');
  const [repeatOccurrences, setRepeatOccurrences] = useState<number>(10);

  // Step 3: Location & Access
  const [locationType, setLocationType] = useState<'live_room' | 'zoom' | 'in_person' | 'online'>('live_room');
  const [liveRoomDefaultView, setLiveRoomDefaultView] = useState<'gallery' | 'speaker'>('gallery');
  const [venueText, setVenueText] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [visibility, setVisibility] = useState<'community' | 'space_members' | 'secret'>('community');

  // Host Controls
  const [recordLive, setRecordLive] = useState(false);
  const [autoPostRecording, setAutoPostRecording] = useState(false);
  const [muteOnEntry, setMuteOnEntry] = useState(false);
  const [hideAttendees, setHideAttendees] = useState(false);
  const [disableChat, setDisableChat] = useState(false);
  const [disableLiveLinkSharing, setDisableLiveLinkSharing] = useState(false);
  const [hideLocationFromNonAttendees, setHideLocationFromNonAttendees] = useState(false);

  if (!isOpen) return null;

  function handleAddTopic(val: string) {
    const clean = val.trim().replace(/^#/, '');
    if (!clean || topics.length >= 5) return;
    if (!topics.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setTopics([...topics, clean]);
    }
    setTopicInput('');
  }

  function handleRemoveTopic(index: number) {
    setTopics(topics.filter((_, i) => i !== index));
  }

  function toggleWeekday(day: string) {
    if (repeatDays.includes(day)) {
      if (repeatDays.length > 1) {
        setRepeatDays(repeatDays.filter((d) => d !== day));
      }
    } else {
      setRepeatDays([...repeatDays, day]);
    }
  }

  async function handlePublishEvent(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!title.trim()) {
      setError('Event title is required.');
      setStep(1);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        coverImageUrl: coverImageUrl.trim() ? coverImageUrl.trim() : null,
        topics,
        hostId: hostId || null,
        spaceId: spaceId || null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        repeatFrequency,
        locationType,
        liveRoomDefaultView,
        venueText: venueText.trim(),
        meetingUrl: meetingUrl.trim() ? meetingUrl.trim() : null,
        visibility,
        capacity: null,
        registrationClosesAt: null,
        hostControls: {
          record_live: recordLive,
          auto_post_recording: autoPostRecording,
          mute_on_entry: muteOnEntry,
          hide_attendees: hideAttendees,
          disable_chat: disableChat,
          disable_live_link_sharing: disableLiveLinkSharing,
          hide_location_from_non_attendees: hideLocationFromNonAttendees,
          repeat_days: repeatDays,
          repeat_ends: repeatEnds,
          repeat_end_date: repeatEndDate,
          repeat_occurrences: repeatOccurrences,
          notify_on_publish: true,
          notify_on_update: false,
          is_paid: false,
          remind_24h: true,
          remind_1h: true,
          remind_10m: true,
        },
      };

      const res = await fetch(`/api/circles/${circleId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create event.');
      }

      onEventCreated(data.event);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create event.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative flex flex-col max-h-[92vh] w-full max-w-2xl rounded-3xl border border-stone-200 bg-white shadow-2xl overflow-hidden">
        {/* WIZARD HEADER */}
        <div className="border-b border-stone-200/80 bg-stone-50/90 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-xs">
                <CalendarIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Create an Event</h3>
                <p className="text-xs text-stone-500">
                  {step === 1 && 'Step 1 of 3: Event Details & Host'}
                  {step === 2 && 'Step 2 of 3: Date, Time & Repeat'}
                  {step === 3 && 'Step 3 of 3: Location & Access Controls'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-stone-400 hover:bg-stone-200/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* STEP INDICATOR PILLS */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { num: 1, label: 'Details' },
              { num: 2, label: 'Schedule' },
              { num: 3, label: 'Location' },
            ].map((s) => (
              <button
                key={s.num}
                type="button"
                onClick={() => {
                  if (s.num === 1 || title.trim()) {
                    setStep(s.num as 1 | 2 | 3);
                  }
                }}
                className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold transition-all ${
                  step === s.num
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : step > s.num
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-stone-200/70 text-stone-600'
                }`}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
                  {step > s.num ? <Check className="h-3 w-3" /> : s.num}
                </span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ERROR BANNER */}
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
            <span>{error}</span>
          </div>
        )}

        {/* WIZARD BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ============================================================== */}
          {/* STEP 1: EVENT DETAILS                                          */}
          {/* ============================================================== */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in-50">
              {/* Event Title */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Title <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Super Sunday Community Workshop"
                  className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-700/20"
                />
              </div>

              {/* Space Selection */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Space
                </label>
                <select
                  value={spaceId}
                  onChange={(e) => setSpaceId(e.target.value)}
                  className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs text-stone-800 focus:border-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-700/20"
                >
                  <option value="">General Community (All Spaces)</option>
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.name} ({s.visibility === 'staff_only' ? 'Staff Space' : s.visibility === 'members' ? 'Members Space' : 'Open Space'})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-stone-500">
                  Choose which space this event is listed in.
                </p>
              </div>

              {/* Host Selector */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Host
                </label>
                <select
                  value={hostId}
                  onChange={(e) => setHostId(e.target.value)}
                  className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs text-stone-800 focus:border-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-700/20"
                >
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.profile?.display_name || m.profile?.username || 'Member'} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Topics (Up to 5) */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Topics <span className="font-normal text-stone-500">(Choose up to 5)</span>
                </label>
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {topics.map((t, idx) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 border border-emerald-200"
                    >
                      #{t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(idx)}
                        className="hover:text-rose-600 ml-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {topics.length < 5 && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={topicInput}
                        onChange={(e) => setTopicInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTopic(topicInput);
                          }
                        }}
                        placeholder="Add topic (Press Enter)"
                        className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-800 placeholder:text-stone-400 focus:border-emerald-700 focus:outline-hidden"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddTopic(topicInput)}
                        className="rounded-full text-xs h-7 px-2.5"
                      >
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this event about? Share the agenda, learning outcomes, or what guests should prepare."
                  className="w-full rounded-2xl border border-stone-300 bg-white p-3.5 text-xs text-stone-800 placeholder:text-stone-400 focus:border-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-700/20 resize-y"
                />
              </div>

              {/* Optional Cover Image */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Cover Image <span className="font-normal text-stone-500">(Optional)</span>
                </label>
                <ImageUploader
                  circleId={circleId}
                  value={coverImageUrl}
                  onChange={(val: string | string[]) =>
                    setCoverImageUrl(Array.isArray(val) ? val[0] || '' : val)
                  }
                  maxFiles={1}
                />
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 2: DATE & REPEAT                                          */}
          {/* ============================================================== */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in-50">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900 mb-1">
                  <Clock className="h-4 w-4 text-emerald-700" />
                  <span>Timezone</span>
                </div>
                <p className="text-xs text-emerald-800">
                  Times are displayed in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).
                </p>
              </div>

              {/* Date & Time Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5">
                    Start Date &amp; Time <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full rounded-2xl border border-stone-300 bg-white px-3.5 py-2.5 text-xs text-stone-800 focus:border-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-700/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5">
                    End Date &amp; Time <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="w-full rounded-2xl border border-stone-300 bg-white px-3.5 py-2.5 text-xs text-stone-800 focus:border-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-700/20"
                  />
                </div>
              </div>

              {/* Repeat Selector */}
              <div className="border-t border-stone-200/80 pt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5">
                    Repeat
                  </label>
                  <select
                    value={repeatFrequency}
                    onChange={(e) =>
                      setRepeatFrequency(e.target.value as 'none' | 'weekly' | 'biweekly' | 'monthly')
                    }
                    className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs text-stone-800 focus:border-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-700/20"
                  >
                    <option value="none">Does not repeat</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 weeks</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {repeatFrequency !== 'none' && (
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-4 animate-in fade-in-50">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-2">
                        Repeats on
                      </label>
                      <div className="flex items-center gap-2">
                        {WEEKDAYS.map((day) => {
                          const active = repeatDays.includes(day.key);
                          return (
                            <button
                              key={day.key}
                              type="button"
                              onClick={() => toggleWeekday(day.key)}
                              className={`h-9 w-9 rounded-full text-xs font-bold transition-all ${
                                active
                                  ? 'bg-emerald-800 text-white shadow-xs'
                                  : 'bg-white border border-stone-300 text-stone-700 hover:border-emerald-600'
                              }`}
                              title={day.key}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-stone-200/80 pt-3">
                      <label className="block text-xs font-semibold text-stone-700 mb-2">
                        Ends
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2.5 text-xs text-stone-800 cursor-pointer">
                          <input
                            type="radio"
                            name="repeatEnds"
                            value="never"
                            checked={repeatEnds === 'never'}
                            onChange={() => setRepeatEnds('never')}
                            className="text-emerald-700 focus:ring-emerald-700"
                          />
                          <span>Never</span>
                        </label>

                        <div className="flex items-center gap-2.5 text-xs text-stone-800">
                          <input
                            type="radio"
                            name="repeatEnds"
                            value="on_date"
                            checked={repeatEnds === 'on_date'}
                            onChange={() => setRepeatEnds('on_date')}
                            className="text-emerald-700 focus:ring-emerald-700"
                          />
                          <span>On</span>
                          <input
                            type="date"
                            disabled={repeatEnds !== 'on_date'}
                            value={repeatEndDate}
                            onChange={(e) => setRepeatEndDate(e.target.value)}
                            className="rounded-xl border border-stone-300 bg-white px-2.5 py-1 text-xs text-stone-800 disabled:opacity-50"
                          />
                        </div>

                        <div className="flex items-center gap-2.5 text-xs text-stone-800">
                          <input
                            type="radio"
                            name="repeatEnds"
                            value="after_occurrences"
                            checked={repeatEnds === 'after_occurrences'}
                            onChange={() => setRepeatEnds('after_occurrences')}
                            className="text-emerald-700 focus:ring-emerald-700"
                          />
                          <span>After</span>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            disabled={repeatEnds !== 'after_occurrences'}
                            value={repeatOccurrences}
                            onChange={(e) => setRepeatOccurrences(parseInt(e.target.value, 10) || 1)}
                            className="w-16 rounded-xl border border-stone-300 bg-white px-2.5 py-1 text-xs text-stone-800 disabled:opacity-50 text-center"
                          />
                          <span>occurrences</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 3: LOCATION & ACCESS                                      */}
          {/* ============================================================== */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in-50">
              {/* Location Type Selection Cards */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-2">
                  Location <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      id: 'live_room',
                      title: 'Live Room',
                      badge: 'Native Room',
                      desc: 'Interactive audio/video room inside Circles',
                      icon: Radio,
                    },
                    {
                      id: 'zoom',
                      title: 'Zoom',
                      badge: 'Video Call',
                      desc: 'External Zoom meeting link',
                      icon: Video,
                    },
                    {
                      id: 'in_person',
                      title: 'In-Person',
                      badge: 'Physical Venue',
                      desc: 'Venue address or campus hall',
                      icon: MapPin,
                    },
                    {
                      id: 'online',
                      title: 'Custom Link',
                      badge: 'Webinar / Stream',
                      desc: 'External link, YouTube Live, or stream',
                      icon: Globe,
                    },
                  ].map((loc) => {
                    const Icon = loc.icon;
                    const active = locationType === loc.id;
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() =>
                          setLocationType(loc.id as 'live_room' | 'zoom' | 'in_person' | 'online')
                        }
                        className={`text-left p-3.5 rounded-2xl border transition-all ${
                          active
                            ? 'border-emerald-700 bg-emerald-50/50 ring-2 ring-emerald-700/20 shadow-xs'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                                active ? 'bg-emerald-800 text-white' : 'bg-stone-100 text-stone-700'
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-bold text-stone-900">{loc.title}</span>
                          </div>
                          <span className="text-[10px] font-mono text-stone-500 uppercase">
                            {loc.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 leading-snug">{loc.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditional inputs for Location */}
              {locationType === 'live_room' && (
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-3 animate-in fade-in-50">
                  <label className="block text-xs font-bold text-stone-800">
                    Default View
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setLiveRoomDefaultView('gallery')}
                      className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-medium border ${
                        liveRoomDefaultView === 'gallery'
                          ? 'border-emerald-700 bg-white text-emerald-900 shadow-xs ring-1 ring-emerald-700'
                          : 'border-stone-200 bg-white text-stone-700'
                      }`}
                    >
                      <LayoutGrid className="h-4 w-4 text-emerald-700" />
                      <span>Gallery View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLiveRoomDefaultView('speaker')}
                      className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-medium border ${
                        liveRoomDefaultView === 'speaker'
                          ? 'border-emerald-700 bg-white text-emerald-900 shadow-xs ring-1 ring-emerald-700'
                          : 'border-stone-200 bg-white text-stone-700'
                      }`}
                    >
                      <Radio className="h-4 w-4 text-emerald-700" />
                      <span>Speaker View</span>
                    </button>
                  </div>
                </div>
              )}

              {(locationType === 'zoom' || locationType === 'online') && (
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5">
                    Meeting URL <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="url"
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder="https://zoom.us/j/123456789 or stream URL"
                    className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs text-stone-800 focus:border-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-700/20"
                  />
                </div>
              )}

              {locationType === 'in_person' && (
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5">
                    Venue / Physical Location <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={venueText}
                    onChange={(e) => setVenueText(e.target.value)}
                    placeholder="e.g. Building 4, Conference Room B, Main Campus"
                    className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs text-stone-800 focus:border-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-700/20"
                  />
                </div>
              )}

              {/* Visibility */}
              <div className="border-t border-stone-200/80 pt-4">
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Visibility
                </label>
                <select
                  value={visibility}
                  onChange={(e) =>
                    setVisibility(e.target.value as 'community' | 'space_members' | 'secret')
                  }
                  className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs text-stone-800 focus:border-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-700/20"
                >
                  <option value="community">Community (All circle members)</option>
                  <option value="space_members">Space Members Only</option>
                  <option value="secret">Secret (Invite-only)</option>
                </select>
              </div>

              {/* Host Controls Toggle List */}
              <div className="border-t border-stone-200/80 pt-4 space-y-3">
                <label className="block text-xs font-bold text-stone-800 mb-2">
                  Host Controls
                </label>

                {[
                  {
                    id: 'recordLive',
                    label: 'Record this live',
                    desc: 'Automatically capture session for on-demand playback',
                    checked: recordLive,
                    onChange: setRecordLive,
                  },
                  {
                    id: 'autoPostRecording',
                    label: 'Automatically post recording to event page',
                    desc: 'Publishes replay video as soon as processing completes',
                    checked: autoPostRecording,
                    onChange: setAutoPostRecording,
                  },
                  {
                    id: 'muteOnEntry',
                    label: 'Mute participants upon entry',
                    desc: 'Keeps background noise down in large sessions',
                    checked: muteOnEntry,
                    onChange: setMuteOnEntry,
                  },
                  {
                    id: 'hideAttendees',
                    label: 'Hide participants list',
                    desc: 'Only hosts and moderators can view the live roster',
                    checked: hideAttendees,
                    onChange: setHideAttendees,
                  },
                  {
                    id: 'disableChat',
                    label: 'Disable chat',
                    desc: 'Turn off live textual messaging during this broadcast',
                    checked: disableChat,
                    onChange: setDisableChat,
                  },
                  {
                    id: 'disableLiveLinkSharing',
                    label: 'Disable live link sharing',
                    desc: 'Prevents guests from sharing room link outside the circle',
                    checked: disableLiveLinkSharing,
                    onChange: setDisableLiveLinkSharing,
                  },
                  {
                    id: 'hideLocation',
                    label: 'Hide location from non-attendees',
                    desc: 'Only confirmed RSVPs will receive live room link or venue address',
                    checked: hideLocationFromNonAttendees,
                    onChange: setHideLocationFromNonAttendees,
                  },
                ].map((ctrl) => (
                  <label
                    key={ctrl.id}
                    className="flex items-start gap-3 rounded-2xl border border-stone-200 p-3 hover:bg-stone-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={ctrl.checked}
                      onChange={(e) => ctrl.onChange(e.target.checked)}
                      className="mt-0.5 rounded-md border-stone-300 text-emerald-800 focus:ring-emerald-700"
                    />
                    <div>
                      <div className="text-xs font-bold text-stone-800">{ctrl.label}</div>
                      <div className="text-[11px] text-stone-500">{ctrl.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* WIZARD FOOTER NAVIGATION */}
        <div className="border-t border-stone-200 bg-stone-50 px-6 py-4 flex items-center justify-between">
          <div>
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                className="rounded-xl text-xs"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-xs text-stone-500 hover:text-stone-800"
              >
                Cancel
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step < 3 ? (
              <Button
                type="button"
                size="sm"
                disabled={step === 1 && !title.trim()}
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                className="rounded-xl bg-emerald-800 px-5 text-white hover:bg-emerald-900 shadow-xs text-xs font-semibold"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={loading || !title.trim()}
                onClick={() => handlePublishEvent()}
                className="rounded-xl bg-emerald-800 px-6 text-white hover:bg-emerald-900 shadow-xs text-xs font-semibold"
              >
                {loading ? 'Publishing...' : 'Publish Event 🎉'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
