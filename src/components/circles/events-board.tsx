'use client';

import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Globe,
  Lock,
  MapPin,
  Plus,
  Search,
  UserCheck,
  Video,
  X,
} from 'lucide-react';
import {
  CircleEventItem,
  CircleMembership,
  CircleRole,
  CircleSpace,
  EventRsvpItem,
} from '@/types/domain';
import { Button } from '@/components/ui/button';
import { EventCreationWizardModal } from '@/components/circles/event-creation-wizard-modal';
import { EventSettingsModal } from '@/components/circles/event-settings-modal';

function getMeetingPlatformLabel(ev: CircleEventItem): string {
  const hc = ev.host_controls as Record<string, unknown> | undefined;
  const savedChannel = hc?.meeting_channel;
  if (savedChannel === 'google_meet') return 'Google Meet';
  if (savedChannel === 'zoom') return 'Zoom';
  if (savedChannel === 'teams') return 'Microsoft Teams';
  if (savedChannel === 'youtube') return 'YouTube Live';
  if (savedChannel === 'custom') return 'Online Meeting';

  const url = (ev.meeting_url || '').toLowerCase();
  if (url.includes('meet.google.com')) return 'Google Meet';
  if (url.includes('zoom.us') || ev.location_type === 'zoom') return 'Zoom';
  if (url.includes('teams.microsoft.com') || url.includes('teams.live.com')) return 'Microsoft Teams';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube Live';
  if (ev.location_type === 'in_person') return 'In-Person';
  if (ev.location_type === 'hybrid') return 'Hybrid';
  return 'Online Meeting';
}

export interface EventsBoardProps {
  circleId: string;
  circleSlug?: string;
  circleName?: string;
  initialEvents: CircleEventItem[];
  canCreateEvent: boolean;
  isMember: boolean;
  currentUserId?: string | null;
  currentUserRole?: CircleRole | null;
  spaces?: CircleSpace[];
  members?: CircleMembership[];
}

export function EventsBoard({
  circleId,
  circleSlug = 'community',
  circleName = 'Circles Community',
  initialEvents,
  canCreateEvent,
  isMember,
  currentUserId,
  currentUserRole,
  members = [],
}: EventsBoardProps) {
  const [events, setEvents] = useState<CircleEventItem[]>(initialEvents);
  const [timeframe, setTimeframe] = useState<'upcoming' | 'past' | 'my_rsvps'>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Calendar month state
  const [calendarDate, setCalendarDate] = useState(() => new Date());

  // Event Detail Modal state
  const [selectedEventDetail, setSelectedEventDetail] = useState<CircleEventItem | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Creation Wizard & Settings Modal state
  const [createWizardOpen, setCreateWizardOpen] = useState(false);
  const [settingsModalEvent, setSettingsModalEvent] = useState<CircleEventItem | null>(null);

  // Roster / Check-in Drawer state
  const [rosterEvent, setRosterEvent] = useState<CircleEventItem | null>(null);
  const [rosterRsvps, setRosterRsvps] = useState<EventRsvpItem[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');

  const isStaff = currentUserRole ? ['owner', 'admin', 'moderator'].includes(currentUserRole) : false;

  function handleOpenCreate() {
    setCreateWizardOpen(true);
  }

  function handleOpenEdit(ev: CircleEventItem) {
    setSettingsModalEvent(ev);
  }

  function handleEventCreated(newEvent: CircleEventItem) {
    setEvents((prev) => [newEvent, ...prev]);
  }

  function handleEventUpdated(updatedEvent: CircleEventItem) {
    setEvents((prev) => prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)));
    if (selectedEventDetail?.id === updatedEvent.id) {
      setSelectedEventDetail(updatedEvent);
    }
  }

  // Cancel Event
  async function handleCancelEvent(eventId: string) {
    if (!window.confirm('Are you sure you want to cancel this event? Attendees will be notified.')) {
      return;
    }
    try {
      const res = await fetch(`/api/circles/${circleId}/events`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, status: 'cancelled' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel event.');
      }
      setEvents((prev) => prev.map((e) => (e.id === eventId ? data.event : e)));
      if (selectedEventDetail?.id === eventId) {
        setSelectedEventDetail(data.event);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel event.');
    }
  }

  // RSVP Register or Cancel
  async function handleRsvp(eventId: string, action: 'register' | 'cancel') {
    try {
      const res = await fetch(`/api/circles/${circleId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rsvp', rsvpAction: action, eventId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to update RSVP.');
      }
      if (data.event) {
        setEvents((prev) => prev.map((e) => (e.id === eventId ? data.event : e)));
        if (selectedEventDetail?.id === eventId) {
          setSelectedEventDetail(data.event);
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to update RSVP.');
    }
  }

  // Open Roster & Fetch RSVPs
  async function handleOpenRoster(ev: CircleEventItem) {
    setRosterEvent(ev);
    setLoadingRoster(true);
    setRosterRsvps([]);
    try {
      const res = await fetch(`/api/circles/${circleId}/events?eventId=${ev.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch attendees.');
      setRosterRsvps(data.rsvps || []);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load attendees.');
    } finally {
      setLoadingRoster(false);
    }
  }

  // Check-in Toggle for Host
  async function handleToggleAttendance(targetUserId: string, currentAttended: boolean) {
    if (!rosterEvent) return;
    const nextAttended = !currentAttended;
    try {
      const res = await fetch(`/api/circles/${circleId}/events`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'attendance',
          eventId: rosterEvent.id,
          targetUserId,
          attended: nextAttended,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update attendance.');
      setRosterRsvps((prev) =>
        prev.map((r) =>
          r.user_id === targetUserId
            ? {
                ...r,
                attended: nextAttended,
                checked_in_at: nextAttended ? new Date().toISOString() : null,
              }
            : r
        )
      );
      if (data.event) {
        setEvents((prev) => prev.map((e) => (e.id === rosterEvent.id ? data.event : e)));
        setRosterEvent(data.event);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Attendance update failed.');
    }
  }

  // Calendar sync helpers
  function getGoogleCalendarUrl(ev: CircleEventItem): string {
    const formatGCalDate = (isoStr: string) =>
      new Date(isoStr).toISOString().replace(/-|:|\.\d\d\d/g, '');
    const start = formatGCalDate(ev.starts_at);
    const end = formatGCalDate(ev.ends_at);
    const details = encodeURIComponent(
      `${ev.description || ''}\n\nCommunity: ${circleName}\nEvent: /circles/${circleSlug}/events`
    );
    const titleEnc = encodeURIComponent(ev.title);
    const locationEnc = encodeURIComponent(
      ev.location_type === 'in_person'
        ? ev.venue_text || 'In-person'
        : ev.meeting_url || ev.venue_text || getMeetingPlatformLabel(ev)
    );
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titleEnc}&dates=${start}/${end}&details=${details}&location=${locationEnc}`;
  }

  function downloadIcsFile(ev: CircleEventItem) {
    const formatIcsDate = (isoStr: string) =>
      new Date(isoStr).toISOString().replace(/-|:|\.\d\d\d/g, '');
    const start = formatIcsDate(ev.starts_at);
    const end = formatIcsDate(ev.ends_at);
    const now = formatIcsDate(new Date().toISOString());

    const loc =
      ev.location_type === 'in_person'
        ? ev.venue_text || 'In-Person'
        : ev.meeting_url || ev.venue_text || getMeetingPlatformLabel(ev);

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Circles Platform//Circle.so Events//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${ev.id}@circles-platform`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${ev.title.replace(/\n/g, ' ')}`,
      `DESCRIPTION:${(ev.description || '').replace(/\n/g, '\\n')}\\n\\nCommunity: ${circleName}`,
      `LOCATION:${loc}`,
      `STATUS:${ev.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ev.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Filtered Events
  const filteredEvents = useMemo(() => {
    const nowMs = Date.now();
    return events.filter((ev) => {
      // Timeframe
      const endsMs = new Date(ev.ends_at).getTime();
      if (timeframe === 'upcoming') {
        if (endsMs < nowMs && ev.status !== 'published') return false;
        if (ev.status === 'cancelled') return false;
      } else if (timeframe === 'past') {
        if (endsMs >= nowMs && ev.status !== 'completed') return false;
      } else if (timeframe === 'my_rsvps') {
        if (!ev.viewer_rsvp_status || ev.viewer_rsvp_status === 'cancelled') return false;
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const matchesDesc = (ev.description || '').toLowerCase().includes(q);
        const matchesHost = (ev.host?.display_name || ev.organizer?.display_name || '')
          .toLowerCase()
          .includes(q);
        if (!matchesTitle && !matchesDesc && !matchesHost) {
          return false;
        }
      }

      return true;
    });
  }, [events, timeframe, searchQuery]);

  // Calendar Days generator
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [calendarDate]);

  function formatTime(isoStr: string) {
    return new Date(isoStr).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function formatDateComponents(isoStr: string) {
    const d = new Date(isoStr);
    return {
      month: d.toLocaleDateString([], { month: 'short' }).toUpperCase(),
      day: d.getDate(),
      weekday: d.toLocaleDateString([], { weekday: 'short' }).toUpperCase(),
      fullDate: d.toLocaleDateString([], {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    };
  }

  return (
    <div className="space-y-6">
      {/* 1. Header with Circle.so Aesthetic */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-7 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
              Events
            </h1>
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-mono font-bold text-stone-900 border border-stone-200">
              {filteredEvents.length} {filteredEvents.length === 1 ? 'EVENT' : 'EVENTS'}
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-stone-500 font-normal">
            Workshops, community calls, livestreams, and in-person meetups with RSVP sync.
          </p>
        </div>

        {canCreateEvent && (
          <Button
            type="button"
            onClick={handleOpenCreate}
            className="rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800 transition-all self-start sm:self-auto"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New Event
          </Button>
        )}
      </div>

      {/* 2. Controls & Filter Bar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Timeframe Tabs */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-stone-200/90 bg-stone-100/70 p-1">
            <button
              type="button"
              onClick={() => setTimeframe('upcoming')}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                timeframe === 'upcoming'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Upcoming
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('past')}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                timeframe === 'past'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              Past
            </button>
            <button
              type="button"
              onClick={() => setTimeframe('my_rsvps')}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                timeframe === 'my_rsvps'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              My RSVPs
            </button>
          </div>

          {/* Search & List/Calendar view toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events or hosts..."
                className="w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-black focus:outline-none"
              />
            </div>

            {/* List vs Calendar Toggle */}
            <div className="flex items-center rounded-xl border border-stone-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  viewMode === 'list'
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  viewMode === 'calendar'
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Calendar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Events Content (List Mode or Calendar Mode) */}
      {viewMode === 'calendar' ? (
        /* Calendar View */
        <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-stone-900" />
              <h2 className="text-base font-bold text-stone-900">
                {calendarDate.toLocaleDateString([], { month: 'long', year: 'numeric' })}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))
                }
                className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
              >
                <X className="h-4 w-4 rotate-45" />
              </button>
              <button
                type="button"
                onClick={() => setCalendarDate(new Date())}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-600 hover:bg-stone-100"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() =>
                  setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))
                }
                className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-stone-200 mt-4 rounded-2xl overflow-hidden border border-stone-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div
                key={d}
                className="bg-stone-50 p-2 text-center text-[11px] font-mono font-bold text-stone-500"
              >
                {d}
              </div>
            ))}
            {calendarDays.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="bg-white min-h-[90px] p-2" />;
              }
              const dateStr = day.toISOString().slice(0, 10);
              const dayEvents = filteredEvents.filter(
                (e) => new Date(e.starts_at).toISOString().slice(0, 10) === dateStr
              );
              const isToday = new Date().toDateString() === day.toDateString();

              return (
                <div
                  key={dateStr}
                  onClick={() => dayEvents.length > 0 && setSelectedEventDetail(dayEvents[0])}
                  className={`bg-white min-h-[90px] p-2 transition-colors flex flex-col justify-between ${
                    dayEvents.length > 0 ? 'cursor-pointer hover:bg-stone-100/40' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        isToday ? 'bg-black text-white' : 'text-stone-700'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-bold text-stone-900">
                        {dayEvents.length} ev
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 mt-1">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        className="truncate rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-900 border border-stone-200/50"
                      >
                        {formatTime(ev.starts_at)} {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="text-[9px] text-stone-400">
                        +{dayEvents.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : filteredEvents.length === 0 ? (
        /* Empty State */
        <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center shadow-xs">
          <CalendarIcon className="mx-auto h-10 w-10 text-stone-300" />
          <h3 className="mt-4 text-base font-bold text-stone-900">No Events Found</h3>
          <p className="mt-1 text-xs sm:text-sm text-stone-500 max-w-sm mx-auto">
            {timeframe === 'upcoming'
              ? 'There are no upcoming events scheduled right now. Host an online call or in-person meetup!'
              : 'No past events match your current filters.'}
          </p>
          {canCreateEvent && (
            <Button
              type="button"
              onClick={handleOpenCreate}
              className="mt-5 rounded-xl bg-black px-4 text-xs font-semibold text-white hover:bg-zinc-800 shadow-xs"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Schedule Event
            </Button>
          )}
        </div>
      ) : (
        /* Event Cards Grid / List */
        <div className="space-y-4">
          {filteredEvents.map((ev) => {
            const dateComp = formatDateComponents(ev.starts_at);
            const isGoing = ev.viewer_rsvp_status === 'going';
            const isWaitlisted = ev.viewer_rsvp_status === 'waitlisted';
            const hostUser = ev.host || ev.organizer;
            const platformLabel = getMeetingPlatformLabel(ev);

            return (
              <div
                key={ev.id}
                className="group relative overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-xs hover:border-black/40 hover:shadow-md transition-all duration-200 flex flex-col md:flex-row"
              >
                {/* Left Banner or Cover Image */}
                <div
                  onClick={() => setSelectedEventDetail(ev)}
                  className="relative md:w-64 lg:w-72 shrink-0 bg-stone-100 overflow-hidden cursor-pointer"
                >
                  {ev.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ev.cover_image_url}
                      alt={ev.title}
                      className="h-44 md:h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="h-44 md:h-full w-full bg-gradient-to-br from-zinc-800 via-stone-850 to-stone-900 flex items-center justify-center p-6 text-white text-center">
                      <div>
                        {ev.location_type === 'in_person' ? (
                          <MapPin className="h-8 w-8 mx-auto text-stone-300 mb-2" />
                        ) : (
                          <Video className="h-8 w-8 mx-auto text-stone-300 mb-2" />
                        )}
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-white/70 block">
                          {platformLabel}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Date Pill Overlay on Cover */}
                  <div className="absolute top-3 left-3 flex flex-col items-center overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-md">
                    <span className="w-full bg-black px-2.5 py-0.5 text-center text-[9px] font-mono font-bold tracking-wider text-white">
                      {dateComp.month}
                    </span>
                    <span className="px-2.5 py-1 text-base font-extrabold text-stone-900 leading-none">
                      {dateComp.day}
                    </span>
                  </div>
                </div>

                {/* Right / Middle Content */}
                <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between">
                  <div>
                    {/* Top Meta Line: Location / Channel badge & Repeat indicator */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {ev.location_type === 'in_person' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-mono font-bold text-amber-800 border border-amber-200">
                          <MapPin className="h-3 w-3 text-amber-600" />
                          In-Person
                        </span>
                      ) : ev.location_type === 'hybrid' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-mono font-bold text-stone-900 border border-stone-200">
                          <Globe className="h-3 w-3 text-stone-700" />
                          Hybrid · {platformLabel}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-mono font-bold text-sky-800 border border-sky-200">
                          <Video className="h-3 w-3 text-sky-600" />
                          {platformLabel}
                        </span>
                      )}

                      {/* Repeat rule */}
                      {ev.repeat_frequency && ev.repeat_frequency !== 'none' && (
                        <span className="text-[10px] font-mono text-stone-400 capitalize">
                          · Repeats {ev.repeat_frequency}
                        </span>
                      )}
                    </div>

                    {/* Event Title */}
                    <h3
                      onClick={() => setSelectedEventDetail(ev)}
                      className="text-base sm:text-lg font-bold text-stone-900 group-hover:text-stone-900 transition-colors cursor-pointer"
                    >
                      {ev.title}
                    </h3>

                    {/* Date & Time Line */}
                    <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-stone-500">
                      <Clock className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                      <span>
                        {dateComp.fullDate} · {formatTime(ev.starts_at)} – {formatTime(ev.ends_at)}{' '}
                        ({ev.timezone || 'UTC'})
                      </span>
                    </div>

                    {/* Description excerpt */}
                    {ev.description && (
                      <p className="mt-2 text-xs sm:text-sm text-stone-600 line-clamp-2 leading-relaxed">
                        {ev.description}
                      </p>
                    )}
                  </div>

                  {/* Bottom Footer: Host & Social Proof Facepile & 1-Click RSVP */}
                  <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
                    {/* Host Avatar & Name */}
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-200 text-stone-800 font-bold text-xs border border-stone-300 overflow-hidden shrink-0">
                        {hostUser?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={hostUser.avatar_url}
                            alt={hostUser.display_name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          (hostUser?.display_name || 'H').slice(0, 1)
                        )}
                      </div>
                      <div className="leading-tight">
                        <span className="text-[11px] font-bold text-stone-900 block">
                          {hostUser?.display_name || 'Event Host'}
                        </span>
                        <span className="text-[10px] text-stone-400 font-mono">Host</span>
                      </div>
                    </div>

                    {/* Attendees Facepile & 1-Click RSVP Action */}
                    <div className="flex items-center gap-3">
                      {/* Facepile avatars */}
                      {ev.attendees && ev.attendees.length > 0 && (
                        <div className="flex items-center -space-x-2 overflow-hidden">
                          {ev.attendees.slice(0, 4).map((att, i) => (
                            <div
                              key={att.user_id || i}
                              className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-stone-200 overflow-hidden text-[9px] font-bold flex items-center justify-center text-stone-700"
                              title={att.display_name}
                            >
                              {att.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={att.avatar_url}
                                  alt={att.display_name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                (att.display_name || 'A').slice(0, 1)
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <span className="text-xs font-semibold text-stone-600">
                        {ev.going_count || 0} attending
                      </span>

                      {/* 1-Click RSVP Button */}
                      {isMember && (
                        <div>
                          {isGoing ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleRsvp(ev.id, 'cancel')}
                              className="h-8 rounded-xl border-black bg-stone-100 text-stone-900 text-xs font-semibold hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 transition-all"
                            >
                              <Check className="mr-1 h-3.5 w-3.5 text-stone-900" />
                              Going
                            </Button>
                          ) : isWaitlisted ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleRsvp(ev.id, 'cancel')}
                              className="h-8 rounded-xl border-amber-500 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 transition-all"
                            >
                              Waitlisted
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleRsvp(ev.id, 'register')}
                              className="h-8 rounded-xl bg-stone-900 px-3.5 text-xs font-semibold text-white hover:bg-black transition-all shadow-xs"
                            >
                              RSVP
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. EVENT DETAIL MODAL                                                     */}
      {/* ========================================================================= */}
      {selectedEventDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-stone-200 bg-white shadow-2xl">
            {/* Modal Hero Cover Image */}
            <div className="relative h-56 sm:h-64 w-full bg-stone-900 overflow-hidden">
              {selectedEventDetail.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedEventDetail.cover_image_url}
                  alt={selectedEventDetail.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-zinc-900 via-stone-900 to-black flex items-center justify-center">
                  {selectedEventDetail.location_type === 'in_person' ? (
                    <MapPin className="h-12 w-12 text-stone-400" />
                  ) : (
                    <Video className="h-12 w-12 text-stone-400" />
                  )}
                </div>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedEventDetail(null)}
                className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/80 transition-colors backdrop-blur-md"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Top Meta Tag on Cover */}
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <span className="rounded-full bg-black text-white px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider shadow-md">
                  {selectedEventDetail.location_type === 'hybrid'
                    ? `Hybrid · ${getMeetingPlatformLabel(selectedEventDetail)}`
                    : getMeetingPlatformLabel(selectedEventDetail)}
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-7 space-y-6">
              {/* Title & Calendar Pill */}
              <div className="flex items-start gap-4">
                <div className="hidden sm:flex flex-col items-center overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs shrink-0">
                  <span className="w-full bg-black px-3 py-1 text-center text-[10px] font-mono font-bold tracking-wider text-white">
                    {formatDateComponents(selectedEventDetail.starts_at).month}
                  </span>
                  <span className="px-3 py-1.5 text-xl font-extrabold text-stone-900 leading-none">
                    {formatDateComponents(selectedEventDetail.starts_at).day}
                  </span>
                  <span className="pb-1 text-[9px] font-mono text-stone-400">
                    {formatDateComponents(selectedEventDetail.starts_at).weekday}
                  </span>
                </div>

                <div className="flex-1">
                  <h2 className="text-xl sm:text-2xl font-bold text-stone-900">
                    {selectedEventDetail.title}
                  </h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-medium text-stone-500">
                    <Clock className="h-3.5 w-3.5 text-stone-400" />
                    <span>
                      {formatDateComponents(selectedEventDetail.starts_at).fullDate} ·{' '}
                      {formatTime(selectedEventDetail.starts_at)} –{' '}
                      {formatTime(selectedEventDetail.ends_at)} (
                      {selectedEventDetail.timezone || 'UTC'})
                    </span>
                  </div>
                </div>
              </div>

              {/* RSVP & Add to Calendar Action Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                <div className="flex items-center gap-3">
                  {isMember && (
                    <>
                      {selectedEventDetail.viewer_rsvp_status === 'going' ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-900 border border-stone-300">
                            <CheckCircle2 className="h-4 w-4 text-stone-900" />
                            You are Going!
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleRsvp(selectedEventDetail.id, 'cancel')}
                            className="h-8 text-xs font-semibold text-stone-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 transition-all"
                          >
                            Can&apos;t go
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => handleRsvp(selectedEventDetail.id, 'register')}
                          className="h-9 rounded-xl bg-black px-5 text-xs font-bold text-white hover:bg-zinc-800 shadow-xs"
                        >
                          RSVP: I&apos;m Going
                        </Button>
                      )}
                    </>
                  )}
                  <span className="text-xs font-semibold text-stone-600">
                    {selectedEventDetail.going_count || 0} Attendees
                  </span>
                </div>

                {/* Add to Calendar Button */}
                <div className="flex items-center gap-2">
                  <a
                    href={getGoogleCalendarUrl(selectedEventDetail)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors shadow-2xs"
                  >
                    <CalendarIcon className="h-3.5 w-3.5 text-stone-500" />
                    Google Cal
                  </a>
                  <button
                    type="button"
                    onClick={() => downloadIcsFile(selectedEventDetail)}
                    className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors shadow-2xs"
                  >
                    <Download className="h-3.5 w-3.5 text-stone-500" />
                    .ICS
                  </button>
                </div>
              </div>

              {/* Location Widget */}
              <div className="rounded-2xl border border-stone-200/90 bg-white p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-stone-900" />
                    Location & Access
                  </h4>
                  {selectedEventDetail.host_controls?.hide_location_from_non_attendees && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-200">
                      <Lock className="h-2.5 w-2.5" />
                      Attendee-only link
                    </span>
                  )}
                </div>

                {selectedEventDetail.location_hidden ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-center">
                    <Lock className="mx-auto h-5 w-5 text-amber-700 mb-1" />
                    <p className="text-xs font-bold text-amber-900">
                      Location Hidden from Non-Attendees
                    </p>
                    <p className="mt-0.5 text-xs text-amber-700">
                      RSVP &quot;Going&quot; to this event to reveal the meeting link or venue address.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedEventDetail.location_type !== 'in_person' && (
                      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shrink-0">
                            <Video className="h-5 w-5" />
                          </div>
                          <div className="truncate">
                            <span className="text-xs font-bold text-stone-900 block truncate">
                              {getMeetingPlatformLabel(selectedEventDetail)}
                            </span>
                            <span className="text-[11px] text-stone-500 font-mono truncate block">
                              {selectedEventDetail.meeting_url || 'Meeting link will be shared before start'}
                            </span>
                          </div>
                        </div>

                        {selectedEventDetail.meeting_url && (
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={selectedEventDetail.meeting_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-700 shadow-xs inline-flex items-center gap-1"
                            >
                              Join {getMeetingPlatformLabel(selectedEventDetail)}
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(selectedEventDetail.meeting_url || '');
                                setCopiedLink(true);
                                setTimeout(() => setCopiedLink(false), 2000);
                              }}
                              className="rounded-xl border border-stone-200 bg-white p-2 text-stone-600 hover:bg-stone-100"
                              title="Copy Meeting Link"
                            >
                              {copiedLink ? (
                                <Check className="h-4 w-4 text-stone-700" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {(selectedEventDetail.location_type === 'in_person' ||
                      selectedEventDetail.location_type === 'hybrid') && (
                      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <MapPin className="h-6 w-6 text-amber-600 shrink-0" />
                          <div>
                            <span className="text-xs font-bold text-stone-900 block">
                              Physical Venue
                            </span>
                            <span className="text-xs text-stone-600">
                              {selectedEventDetail.venue_text || 'Venue address will be shared soon'}
                            </span>
                          </div>
                        </div>
                        {selectedEventDetail.venue_text && (
                          <a
                            href={`https://maps.google.com/?q=${encodeURIComponent(
                              selectedEventDetail.venue_text
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs inline-flex items-center gap-1 shrink-0"
                          >
                            Maps
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Host Profile Box */}
              <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-200 text-stone-800 font-bold text-sm border border-stone-300 overflow-hidden">
                    {selectedEventDetail.host?.avatar_url || selectedEventDetail.organizer?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={
                          selectedEventDetail.host?.avatar_url ||
                          selectedEventDetail.organizer?.avatar_url ||
                          ''
                        }
                        alt="Host"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (
                        selectedEventDetail.host?.display_name ||
                        selectedEventDetail.organizer?.display_name ||
                        'H'
                      ).slice(0, 1)
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">
                      {selectedEventDetail.host?.display_name ||
                        selectedEventDetail.organizer?.display_name}
                    </span>
                    <span className="text-[11px] text-stone-500 font-mono">
                      Host · @
                      {selectedEventDetail.host?.username ||
                        selectedEventDetail.organizer?.username ||
                        'host'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedEventDetail.description && (
                <div className="space-y-2">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500">
                    About this Event
                  </h4>
                  <div className="text-xs sm:text-sm text-stone-700 whitespace-pre-wrap leading-relaxed font-normal">
                    {selectedEventDetail.description}
                  </div>
                </div>
              )}

              {/* Staff / Organizer Controls */}
              {(isStaff ||
                selectedEventDetail.organizer_id === currentUserId ||
                selectedEventDetail.host_id === currentUserId) && (
                <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedEventDetail(null);
                        handleOpenEdit(selectedEventDetail);
                      }}
                      className="rounded-xl text-xs font-semibold"
                    >
                      <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                      Event Settings
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenRoster(selectedEventDetail)}
                      className="rounded-xl text-xs font-semibold"
                    >
                      <UserCheck className="mr-1.5 h-3.5 w-3.5 text-stone-900" />
                      Check-in Roster
                    </Button>
                  </div>

                  {selectedEventDetail.status !== 'cancelled' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCancelEvent(selectedEventDetail.id)}
                      className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    >
                      Cancel Event
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CREATE EVENT 3-STEP WIZARD MODAL                                       */}
      {/* ========================================================================= */}
      <EventCreationWizardModal
        isOpen={createWizardOpen}
        onClose={() => setCreateWizardOpen(false)}
        circleId={circleId}
        circleSlug={circleSlug}
        members={members}
        currentUserId={currentUserId}
        onEventCreated={handleEventCreated}
      />

      {/* ========================================================================= */}
      {/* 6. EVENT SETTINGS & MANAGEMENT MODAL (FOR EXISTING EVENTS)                */}
      {/* ========================================================================= */}
      {settingsModalEvent && (
        <EventSettingsModal
          isOpen={Boolean(settingsModalEvent)}
          onClose={() => setSettingsModalEvent(null)}
          circleId={circleId}
          circleSlug={circleSlug}
          event={settingsModalEvent}
          members={members}
          currentUserId={currentUserId}
          onEventUpdated={handleEventUpdated}
          onEventCancelled={handleEventUpdated}
        />
      )}
      {/* ========================================================================= */}
      {/* 6. CHECK-IN / ATTENDANCE ROSTER DRAWER                                    */}
      {/* ========================================================================= */}
      {rosterEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="relative max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Event Check-in Roster
                </h3>
                <p className="text-xs text-stone-500 truncate max-w-sm">
                  {rosterEvent.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRosterEvent(null)}
                className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              type="text"
              value={rosterSearch}
              onChange={(e) => setRosterSearch(e.target.value)}
              placeholder="Search registered attendees..."
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-900 focus:border-black focus:bg-white focus:outline-none"
            />

            {loadingRoster ? (
              <div className="py-8 text-center text-xs text-stone-400">Loading roster...</div>
            ) : rosterRsvps.length === 0 ? (
              <div className="py-8 text-center text-xs text-stone-500">
                No RSVPs recorded yet for this event.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {rosterRsvps
                  .filter((r) =>
                    (r.profile?.display_name || r.profile?.username || '')
                      .toLowerCase()
                      .includes(rosterSearch.toLowerCase())
                  )
                  .map((rsvp) => (
                    <div
                      key={rsvp.id}
                      className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50/60 p-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-200 text-stone-700 text-xs font-bold overflow-hidden">
                          {rsvp.profile?.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={rsvp.profile.avatar_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            (rsvp.profile?.display_name || 'U').slice(0, 1)
                          )}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-stone-900 block leading-tight">
                            {rsvp.profile?.display_name || rsvp.profile?.username || 'Member'}
                          </span>
                          <span className="text-[10px] text-stone-400 font-mono">
                            {rsvp.status}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleToggleAttendance(rsvp.user_id, Boolean(rsvp.attended))
                        }
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                          rsvp.attended
                            ? 'bg-black text-white'
                            : 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        {rsvp.attended ? 'Attended ✓' : 'Mark Attended'}
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
