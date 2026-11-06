'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Search,
  Sliders,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  CircleEventItem,
  CircleMembership,
  CircleSpace,
  EventRsvpItem,
} from '@/types/domain';
import { Button } from '@/components/ui/button';
import { ImageUploader } from '@/components/ui/image-uploader';

export interface EventSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  circleId: string;
  circleSlug?: string;
  event: CircleEventItem;
  spaces: CircleSpace[];
  members: CircleMembership[];
  currentUserId?: string | null;
  onEventUpdated: (event: CircleEventItem) => void;
  onEventCancelled?: (event: CircleEventItem) => void;
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

export function EventSettingsModal({
  isOpen,
  onClose,
  circleId,
  circleSlug: _circleSlug = 'community',
  event,
  spaces = [],
  members = [],
  currentUserId,
  onEventUpdated,
  onEventCancelled,
}: EventSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'attendees' | 'host_controls'>('details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab 1: Details & Schedule
  const [title, setTitle] = useState(event.title);
  const [spaceId, setSpaceId] = useState(event.space_id || '');
  const [hostId, setHostId] = useState(event.host_id || event.organizer_id || currentUserId || '');
  const [description, setDescription] = useState(event.description || '');
  const [coverImageUrl, setCoverImageUrl] = useState(event.cover_image_url || '');
  const [topics, setTopics] = useState<string[]>(event.topics || []);
  const [topicInput, setTopicInput] = useState('');

  const controls = (event.host_controls || {}) as Record<string, unknown>;

  const [startsAt, setStartsAt] = useState(() =>
    new Date(event.starts_at).toISOString().slice(0, 16)
  );
  const [endsAt, setEndsAt] = useState(() =>
    new Date(event.ends_at).toISOString().slice(0, 16)
  );
  const [repeatFrequency, setRepeatFrequency] = useState<'none' | 'weekly' | 'biweekly' | 'monthly'>(
    event.repeat_frequency || 'none'
  );
  const [repeatDays, setRepeatDays] = useState<string[]>(
    Array.isArray(controls.repeat_days) ? (controls.repeat_days as string[]) : ['Sun']
  );

  const [locationType, setLocationType] = useState<'live_room' | 'zoom' | 'in_person' | 'online'>(
    event.location_type === 'zoom'
      ? 'zoom'
      : event.location_type === 'in_person'
      ? 'in_person'
      : event.location_type === 'online'
      ? 'online'
      : 'live_room'
  );
  const [liveRoomDefaultView, setLiveRoomDefaultView] = useState<'gallery' | 'speaker'>(
    event.live_room_default_view || 'gallery'
  );
  const [venueText, setVenueText] = useState(event.venue_text || '');
  const [meetingUrl, setMeetingUrl] = useState(event.meeting_url || '');
  const [visibility, setVisibility] = useState<'community' | 'space_members' | 'secret'>(
    event.visibility || 'community'
  );

  // Tab 2: Attendees
  const [rosterRsvps, setRosterRsvps] = useState<EventRsvpItem[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState<'all' | 'going' | 'attended'>('all');

  // Tab 3: Host Controls
  const [recordLive, setRecordLive] = useState(Boolean(controls.record_live));
  const [autoPostRecording, setAutoPostRecording] = useState(Boolean(controls.auto_post_recording));
  const [muteOnEntry, setMuteOnEntry] = useState(Boolean(controls.mute_on_entry));
  const [hideAttendees, setHideAttendees] = useState(Boolean(controls.hide_attendees));
  const [disableChat, setDisableChat] = useState(Boolean(controls.disable_chat));
  const [disableLiveLinkSharing, setDisableLiveLinkSharing] = useState(
    Boolean(controls.disable_live_link_sharing)
  );
  const [hideLocationFromNonAttendees, setHideLocationFromNonAttendees] = useState(
    Boolean(controls.hide_location_from_non_attendees)
  );
  const [capacity, setCapacity] = useState<string>(event.capacity ? String(event.capacity) : '');
  const [eventStatus, setEventStatus] = useState<'draft' | 'published' | 'cancelled' | 'completed'>(
    event.status || 'published'
  );

  // Pre-event Reminders
  const [remind24h, setRemind24h] = useState<boolean>(controls.remind_24h !== false);
  const [remind1h, setRemind1h] = useState<boolean>(controls.remind_1h !== false);
  const [remind10m, setRemind10m] = useState<boolean>(controls.remind_10m !== false);

  // Load Roster on mount / tab change
  useEffect(() => {
    if (!isOpen) return;
    async function fetchRoster() {
      setLoadingRoster(true);
      try {
        const res = await fetch(`/api/circles/${circleId}/events?eventId=${event.id}`);
        const data = await res.json();
        if (res.ok) {
          setRosterRsvps(data.rsvps || []);
        }
      } catch (err) {
        console.error('Failed to load roster:', err);
      } finally {
        setLoadingRoster(false);
      }
    }
    fetchRoster();
  }, [isOpen, circleId, event.id]);

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

  // Attendance check-in toggle
  async function handleToggleAttendance(targetUserId: string, currentAttended: boolean) {
    const nextAttended = !currentAttended;
    try {
      const res = await fetch(`/api/circles/${circleId}/events`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'attendance',
          eventId: event.id,
          targetUserId,
          attended: nextAttended,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check-in failed.');

      setRosterRsvps((prev) =>
        prev.map((r) => (r.user_id === targetUserId ? { ...r, attended: nextAttended } : r))
      );
      if (data.event) {
        onEventUpdated(data.event);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Attendance update failed.');
    }
  }

  // Save Settings
  async function handleSaveSettings(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!title.trim()) {
      setError('Event title cannot be empty.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const parsedCapacity = capacity.trim() ? parseInt(capacity.trim(), 10) : null;
      const payload = {
        eventId: event.id,
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
        capacity: parsedCapacity,
        status: eventStatus,
        hostControls: {
          ...event.host_controls,
          record_live: recordLive,
          auto_post_recording: autoPostRecording,
          mute_on_entry: muteOnEntry,
          hide_attendees: hideAttendees,
          disable_chat: disableChat,
          disable_live_link_sharing: disableLiveLinkSharing,
          hide_location_from_non_attendees: hideLocationFromNonAttendees,
          repeat_days: repeatDays,
          remind_24h: remind24h,
          remind_1h: remind1h,
          remind_10m: remind10m,
        },
      };

      const res = await fetch(`/api/circles/${circleId}/events`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update event.');
      }

      onEventUpdated(data.event);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setLoading(false);
    }
  }

  // Cancel Event
  async function handleCancelEvent() {
    if (!window.confirm('Are you sure you want to cancel this event? Attendees will be notified.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/events`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, status: 'cancelled' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel event.');

      setEventStatus('cancelled');
      if (onEventCancelled) onEventCancelled(data.event);
      onEventUpdated(data.event);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel event.');
    } finally {
      setLoading(false);
    }
  }

  // Filtered Roster
  const filteredRsvps = rosterRsvps.filter((r) => {
    if (rosterFilter === 'going' && r.status !== 'going') return false;
    if (rosterFilter === 'attended' && !r.attended) return false;
    if (rosterSearch.trim()) {
      const q = rosterSearch.toLowerCase();
      const name = r.profile?.display_name?.toLowerCase() || '';
      const user = r.profile?.username?.toLowerCase() || '';
      return name.includes(q) || user.includes(q);
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative flex flex-col max-h-[92vh] w-full max-w-3xl rounded-3xl border border-stone-200 bg-white shadow-2xl overflow-hidden">
        {/* HEADER */}
        <div className="border-b border-stone-200/80 bg-stone-50/90 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-xs">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-stone-900 truncate max-w-sm">
                    {title || 'Event Settings'}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                      eventStatus === 'published'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : eventStatus === 'cancelled'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-stone-100 text-stone-600 border-stone-200'
                    }`}
                  >
                    {eventStatus === 'published' ? 'Published' : eventStatus === 'cancelled' ? 'Cancelled' : 'Draft'}
                  </span>
                </div>
                <p className="text-xs text-stone-500">
                  Manage schedule, attendee roster, check-in, and host controls.
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

          {/* 3 CLEAN SETTINGS TABS */}
          <div className="mt-4 flex items-center gap-2 border-b border-stone-200/60 pb-1">
            {[
              { id: 'details', label: 'Details & Schedule', icon: CalendarIcon },
              { id: 'attendees', label: `Attendees & Check-in (${rosterRsvps.length})`, icon: Users },
              { id: 'host_controls', label: 'Host Controls & Limits', icon: Sliders },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as 'details' | 'attendees' | 'host_controls')}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ERROR BANNER */}
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* MODAL CONTENT */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ============================================================== */}
          {/* TAB 1: DETAILS & SCHEDULE                                      */}
          {/* ============================================================== */}
          {activeTab === 'details' && (
            <div className="space-y-5 animate-in fade-in-50">
              {/* Cover Image */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Cover Image
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

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Title <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs text-stone-800 focus:border-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-700/20"
                />
              </div>

              {/* Space & Host Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5">
                    Space
                  </label>
                  <select
                    value={spaceId}
                    onChange={(e) => setSpaceId(e.target.value)}
                    className="w-full rounded-2xl border border-stone-300 bg-white px-3.5 py-2.5 text-xs text-stone-800 focus:border-emerald-700 focus:outline-hidden"
                  >
                    <option value="">General Community</option>
                    {spaces.map((s) => (
                      <option key={s.id} value={s.id}>
                        #{s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-800 mb-1.5">
                    Host
                  </label>
                  <select
                    value={hostId}
                    onChange={(e) => setHostId(e.target.value)}
                    className="w-full rounded-2xl border border-stone-300 bg-white px-3.5 py-2.5 text-xs text-stone-800 focus:border-emerald-700 focus:outline-hidden"
                  >
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.profile?.display_name || m.profile?.username || 'Member'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Topics */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Topics
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
                        className="hover:text-rose-600"
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
                        placeholder="Add topic"
                        className="rounded-full border border-stone-300 px-3 py-1 text-xs text-stone-800"
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
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-2xl border border-stone-300 bg-white p-3.5 text-xs text-stone-800 focus:border-emerald-700 focus:outline-hidden"
                />
              </div>

              {/* Schedule */}
              <div className="border-t border-stone-200/80 pt-4 space-y-4">
                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Date, Time &amp; Repeat
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Start Date &amp; Time
                    </label>
                    <input
                      type="datetime-local"
                      value={startsAt}
                      onChange={(e) => setStartsAt(e.target.value)}
                      className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      End Date &amp; Time
                    </label>
                    <input
                      type="datetime-local"
                      value={endsAt}
                      onChange={(e) => setEndsAt(e.target.value)}
                      className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Repeat Frequency
                    </label>
                    <select
                      value={repeatFrequency}
                      onChange={(e) =>
                        setRepeatFrequency(e.target.value as 'none' | 'weekly' | 'biweekly' | 'monthly')
                      }
                      className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800"
                    >
                      <option value="none">Does not repeat</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  {repeatFrequency !== 'none' && (
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Repeat Days
                      </label>
                      <div className="flex items-center gap-1.5">
                        {WEEKDAYS.map((day) => {
                          const active = repeatDays.includes(day.key);
                          return (
                            <button
                              key={day.key}
                              type="button"
                              onClick={() => toggleWeekday(day.key)}
                              className={`h-7 w-7 rounded-full text-xs font-bold ${
                                active
                                  ? 'bg-emerald-800 text-white'
                                  : 'bg-white border border-stone-300 text-stone-600'
                              }`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Location & Visibility */}
              <div className="border-t border-stone-200/80 pt-4 space-y-4">
                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Location &amp; Access
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Location Type
                    </label>
                    <select
                      value={locationType}
                      onChange={(e) =>
                        setLocationType(e.target.value as 'live_room' | 'zoom' | 'in_person' | 'online')
                      }
                      className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800"
                    >
                      <option value="live_room">Live Room (Circles Native)</option>
                      <option value="zoom">Zoom</option>
                      <option value="in_person">In-Person</option>
                      <option value="online">Online / Custom URL</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Visibility
                    </label>
                    <select
                      value={visibility}
                      onChange={(e) =>
                        setVisibility(e.target.value as 'community' | 'space_members' | 'secret')
                      }
                      className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800"
                    >
                      <option value="community">Community</option>
                      <option value="space_members">Space Members Only</option>
                      <option value="secret">Secret (Invite-only)</option>
                    </select>
                  </div>
                </div>

                {locationType === 'live_room' && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Default View
                    </label>
                    <select
                      value={liveRoomDefaultView}
                      onChange={(e) =>
                        setLiveRoomDefaultView(e.target.value as 'gallery' | 'speaker')
                      }
                      className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800"
                    >
                      <option value="gallery">Gallery View</option>
                      <option value="speaker">Speaker View</option>
                    </select>
                  </div>
                )}

                {(locationType === 'zoom' || locationType === 'online') && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Meeting Link URL
                    </label>
                    <input
                      type="url"
                      value={meetingUrl}
                      onChange={(e) => setMeetingUrl(e.target.value)}
                      placeholder="https://zoom.us/j/..."
                      className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800"
                    />
                  </div>
                )}

                {locationType === 'in_person' && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Venue Address / Room
                    </label>
                    <input
                      type="text"
                      value={venueText}
                      onChange={(e) => setVenueText(e.target.value)}
                      placeholder="e.g. Building 2, Room 401"
                      className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: ATTENDEES & CHECK-IN                                    */}
          {/* ============================================================== */}
          {activeTab === 'attendees' && (
            <div className="space-y-4 animate-in fade-in-50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Attendee Guest List
                  </h4>
                  <p className="text-xs text-stone-500">
                    Verify check-ins, inspect RSVP timestamps, and view confirmed attendees.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Search guests..."
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                      className="rounded-xl border border-stone-300 bg-white pl-8 pr-3 py-1.5 text-xs text-stone-800 placeholder:text-stone-400"
                    />
                  </div>
                  <div className="flex rounded-xl border border-stone-200 bg-stone-100 p-0.5 text-xs">
                    {(['all', 'going', 'attended'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setRosterFilter(mode)}
                        className={`rounded-lg px-2.5 py-1 font-semibold capitalize transition-all ${
                          rosterFilter === mode
                            ? 'bg-white text-stone-900 shadow-xs'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {loadingRoster ? (
                <div className="py-12 text-center text-xs text-stone-500">
                  Loading attendee roster...
                </div>
              ) : filteredRsvps.length === 0 ? (
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-8 text-center">
                  <Users className="mx-auto h-8 w-8 text-stone-400 mb-2" />
                  <p className="text-xs font-bold text-stone-700">No attendees match your filter</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    {rosterRsvps.length === 0
                      ? 'No registrations yet. Share this event with community members.'
                      : 'Try adjusting your search query or filter.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-xs">
                  {filteredRsvps.map((rsvp) => (
                    <div
                      key={rsvp.id}
                      className="flex items-center justify-between p-3.5 hover:bg-stone-50/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800 text-xs">
                          {rsvp.profile?.display_name?.slice(0, 2).toUpperCase() || 'MB'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-stone-900">
                              {rsvp.profile?.display_name || rsvp.profile?.username || 'Community Member'}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                                rsvp.status === 'going'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-stone-100 text-stone-600 border-stone-200'
                              }`}
                            >
                              {rsvp.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500">
                            Registered {new Date(rsvp.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleAttendance(rsvp.user_id, Boolean(rsvp.attended))}
                          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                            rsvp.attended
                              ? 'bg-emerald-800 text-white shadow-xs'
                              : 'border border-stone-300 bg-white text-stone-700 hover:border-emerald-700'
                          }`}
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>{rsvp.attended ? 'Attended ✓' : 'Mark Attended'}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: HOST CONTROLS & STATUS                                  */}
          {/* ============================================================== */}
          {activeTab === 'host_controls' && (
            <div className="space-y-5 animate-in fade-in-50">
              <div>
                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">
                  Live Room Controls
                </h4>
                <div className="space-y-2">
                  {[
                    {
                      id: 'recordLive',
                      label: 'Record this live',
                      desc: 'Capture session recording for members to re-watch',
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
                      desc: 'Minimizes microphone feedback in large audiences',
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
                      id: 'hideLocationFromNonAttendees',
                      label: 'Hide location from non-attendees',
                      desc: 'Only guests who have clicked RSVP will see the link/address',
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

              {/* Capacity Limit */}
              <div className="border-t border-stone-200/80 pt-4">
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Registration Capacity Limit
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="Unlimited seats"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="w-full sm:w-48 rounded-2xl border border-stone-300 bg-white px-3.5 py-2 text-xs text-stone-800"
                />
                <p className="mt-1 text-[11px] text-stone-500">
                  Leave blank for unlimited community attendance.
                </p>
              </div>

              {/* Automated Reminders */}
              <div className="border-t border-stone-200/80 pt-4 space-y-2">
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Automated Pre-Event Reminders
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="flex items-center gap-2 rounded-xl border border-stone-200 p-2.5 text-xs text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remind24h}
                      onChange={(e) => setRemind24h(e.target.checked)}
                      className="rounded-md border-stone-300 text-emerald-800"
                    />
                    <span>24 hours before</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-stone-200 p-2.5 text-xs text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remind1h}
                      onChange={(e) => setRemind1h(e.target.checked)}
                      className="rounded-md border-stone-300 text-emerald-800"
                    />
                    <span>1 hour before</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-stone-200 p-2.5 text-xs text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remind10m}
                      onChange={(e) => setRemind10m(e.target.checked)}
                      className="rounded-md border-stone-300 text-emerald-800"
                    />
                    <span>10 mins before</span>
                  </label>
                </div>
              </div>

              {/* Danger Zone / Cancel Event */}
              <div className="border-t border-rose-200 pt-4">
                <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-1">
                  Cancel or Archive Event
                </h4>
                <p className="text-xs text-stone-500 mb-3">
                  Cancelling will notify all registered attendees and stop new registrations.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEvent}
                  className="rounded-xl border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Cancel This Event
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="border-t border-stone-200 bg-stone-50 px-6 py-4 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-stone-500 hover:text-stone-800"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={loading || !title.trim()}
            onClick={() => handleSaveSettings()}
            className="rounded-xl bg-emerald-800 px-6 text-white hover:bg-emerald-900 shadow-xs text-xs font-semibold"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
