'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Disc,
  Download,
  Edit3,
  ExternalLink,
  Globe,
  LayoutGrid,
  Lock,
  MapPin,
  MessageSquareOff,
  MicOff,
  Plus,
  Radio,
  Search,
  Sliders,
  Tag,
  Trash2,
  UserCheck,
  Users,
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
import { ImageUploader } from '@/components/ui/image-uploader';

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
  spaces = [],
  members = [],
}: EventsBoardProps) {
  const [events, setEvents] = useState<CircleEventItem[]>(initialEvents);
  const [timeframe, setTimeframe] = useState<'upcoming' | 'past' | 'my_rsvps'>('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpaceId, setSelectedSpaceId] = useState<'all' | string>('all');
  const [selectedTopic, setSelectedTopic] = useState<'all' | string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Calendar month state
  const [calendarDate, setCalendarDate] = useState(() => new Date());

  // Event Detail Modal state
  const [selectedEventDetail, setSelectedEventDetail] = useState<CircleEventItem | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Form modal state (Create / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<
    'overview' | 'people' | 'basic_info' | 'notifications' | 'payment' | 'reminders' | 'advanced'
  >('overview');

  // Circle.so Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [hostId, setHostId] = useState<string>('');
  const [spaceId, setSpaceId] = useState<string>('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [repeatFrequency, setRepeatFrequency] = useState<
    'none' | 'weekly' | 'biweekly' | 'monthly'
  >('none');
  const [repeatDays, setRepeatDays] = useState<string[]>(['Sun']);
  const [repeatEnds, setRepeatEnds] = useState<'never' | 'on_date' | 'after_occurrences'>('never');
  const [repeatEndDate, setRepeatEndDate] = useState<string>('');
  const [repeatOccurrences, setRepeatOccurrences] = useState<number>(10);
  const [locationType, setLocationType] = useState<
    'live_room' | 'zoom' | 'in_person' | 'online'
  >('live_room');
  const [liveRoomDefaultView, setLiveRoomDefaultView] = useState<'gallery' | 'speaker'>('gallery');
  const [venueText, setVenueText] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [visibility, setVisibility] = useState<'community' | 'space_members' | 'secret'>('community');
  const [capacity, setCapacity] = useState<string>('');
  const [registrationClosesAt, setRegistrationClosesAt] = useState<string>('');
  const [eventStatus, setEventStatus] = useState<
    'draft' | 'published' | 'cancelled' | 'completed'
  >('published');

  // Notifications
  const [notifyOnPublish, setNotifyOnPublish] = useState<boolean>(true);
  const [notifyOnUpdate, setNotifyOnUpdate] = useState<boolean>(false);
  const [announcementMessage, setAnnouncementMessage] = useState<string>('');

  // Payment
  const [isPaidEvent, setIsPaidEvent] = useState<boolean>(false);
  const [ticketPrice, setTicketPrice] = useState<string>('0');
  const [currency, setCurrency] = useState<'BACHS' | 'USD' | 'EUR' | 'GBP'>('BACHS');
  const [memberDiscountPercent, setMemberDiscountPercent] = useState<number>(0);
  const [freeForMembers, setFreeForMembers] = useState<boolean>(false);

  // Reminders
  const [remind24h, setRemind24h] = useState<boolean>(true);
  const [remind1h, setRemind1h] = useState<boolean>(true);
  const [remind10m, setRemind10m] = useState<boolean>(true);
  const [customReminderNote, setCustomReminderNote] = useState<string>('');

  // Host Controls
  const [recordLive, setRecordLive] = useState(false);
  const [autoPostRecording, setAutoPostRecording] = useState(false);
  const [muteOnEntry, setMuteOnEntry] = useState(false);
  const [hideAttendees, setHideAttendees] = useState(false);
  const [disableChat, setDisableChat] = useState(false);
  const [disableLiveLinkSharing, setDisableLiveLinkSharing] = useState(false);
  const [hideLocationFromNonAttendees, setHideLocationFromNonAttendees] = useState(false);

  // Roster / Check-in Drawer state
  const [rosterEvent, setRosterEvent] = useState<CircleEventItem | null>(null);
  const [rosterRsvps, setRosterRsvps] = useState<EventRsvpItem[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStaff = currentUserRole ? ['owner', 'admin', 'moderator'].includes(currentUserRole) : false;

  // Extract all distinct topics across events for filter pill bar
  const allAvailableTopics = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      e.topics?.forEach((t) => set.add(t));
    });
    return Array.from(set);
  }, [events]);

  // Currently active event in edit modal
  const currentEditingEvent = useMemo(() => {
    if (!editingEventId) return null;
    return events.find((e) => e.id === editingEventId) ?? null;
  }, [events, editingEventId]);

  // Open Create Modal
  function handleOpenCreate() {
    setEditingEventId(null);
    setActiveModalTab('basic_info');
    setEventStatus('published');
    setTitle('');
    setDescription('');
    setCoverImageUrl('');
    setTopics([]);
    setTopicInput('');
    setHostId(currentUserId || '');
    setSpaceId('');
    setRepeatFrequency('none');
    setRepeatDays(['Sun']);
    setRepeatEnds('never');
    setRepeatEndDate('');
    setRepeatOccurrences(10);
    setLocationType('live_room');
    setLiveRoomDefaultView('gallery');
    setVenueText('');
    setMeetingUrl('');
    setVisibility('community');

    // Default Host Controls
    setRecordLive(false);
    setAutoPostRecording(false);
    setMuteOnEntry(false);
    setHideAttendees(false);
    setDisableChat(false);
    setDisableLiveLinkSharing(false);
    setHideLocationFromNonAttendees(false);

    // Notifications, Payment, Reminders, Capacity
    setNotifyOnPublish(true);
    setNotifyOnUpdate(false);
    setAnnouncementMessage('');
    setIsPaidEvent(false);
    setTicketPrice('0');
    setCurrency('BACHS');
    setMemberDiscountPercent(0);
    setFreeForMembers(false);
    setRemind24h(true);
    setRemind1h(true);
    setRemind10m(true);
    setCustomReminderNote('');
    setCapacity('');
    setRegistrationClosesAt('');

    setRosterRsvps([]);
    setRosterEvent(null);

    const now = Date.now();
    const start = new Date(now + 86400_000);
    const end = new Date(now + 90000_000); // 1 hr duration
    setStartsAt(start.toISOString().slice(0, 16));
    setEndsAt(end.toISOString().slice(0, 16));
    setModalOpen(true);
  }

  // Open Edit Modal
  function handleOpenEdit(ev: CircleEventItem) {
    setEditingEventId(ev.id);
    setActiveModalTab('overview');
    setEventStatus(ev.status || 'published');
    setTitle(ev.title);
    setDescription(ev.description || '');
    setCoverImageUrl(ev.cover_image_url || '');
    setTopics(ev.topics || []);
    setTopicInput('');
    setHostId(ev.host_id || ev.organizer_id);
    setSpaceId(ev.space_id || '');
    setRepeatFrequency(ev.repeat_frequency || 'none');
    setLocationType(
      ev.location_type === 'zoom'
        ? 'zoom'
        : ev.location_type === 'in_person'
        ? 'in_person'
        : ev.location_type === 'online'
        ? 'online'
        : 'live_room'
    );
    setLiveRoomDefaultView(ev.live_room_default_view || 'gallery');
    setVenueText(ev.venue_text || '');
    setMeetingUrl(ev.meeting_url || '');
    setVisibility(ev.visibility || 'community');

    const controls = (ev.host_controls || {}) as Record<string, unknown>;
    setRecordLive(Boolean(controls.record_live));
    setAutoPostRecording(Boolean(controls.auto_post_recording));
    setMuteOnEntry(Boolean(controls.mute_on_entry));
    setHideAttendees(Boolean(controls.hide_attendees));
    setDisableChat(Boolean(controls.disable_chat));
    setDisableLiveLinkSharing(Boolean(controls.disable_live_link_sharing));
    setHideLocationFromNonAttendees(Boolean(controls.hide_location_from_non_attendees));

    // Extended options
    setRepeatDays(
      Array.isArray(controls.repeat_days) ? (controls.repeat_days as string[]) : ['Sun']
    );
    setRepeatEnds(
      (controls.repeat_ends as 'never' | 'on_date' | 'after_occurrences') || 'never'
    );
    setRepeatEndDate(
      typeof controls.repeat_end_date === 'string' ? controls.repeat_end_date : ''
    );
    setRepeatOccurrences(
      typeof controls.repeat_occurrences === 'number' ? controls.repeat_occurrences : 10
    );

    setNotifyOnPublish(controls.notify_on_publish !== false);
    setNotifyOnUpdate(Boolean(controls.notify_on_update));
    setAnnouncementMessage(
      typeof controls.announcement_message === 'string'
        ? controls.announcement_message
        : ''
    );

    setIsPaidEvent(Boolean(controls.is_paid));
    setTicketPrice(
      typeof controls.ticket_price === 'string' || typeof controls.ticket_price === 'number'
        ? String(controls.ticket_price)
        : '0'
    );
    setCurrency((controls.currency as 'BACHS' | 'USD' | 'EUR' | 'GBP') || 'BACHS');
    setMemberDiscountPercent(
      typeof controls.member_discount === 'number' ? controls.member_discount : 0
    );
    setFreeForMembers(Boolean(controls.free_for_members));

    setRemind24h(controls.remind_24h !== false);
    setRemind1h(controls.remind_1h !== false);
    setRemind10m(controls.remind_10m !== false);
    setCustomReminderNote(
      typeof controls.reminder_note === 'string' ? controls.reminder_note : ''
    );

    setCapacity(ev.capacity ? String(ev.capacity) : '');
    setRegistrationClosesAt(
      ev.registration_closes_at
        ? new Date(ev.registration_closes_at).toISOString().slice(0, 16)
        : ''
    );

    setStartsAt(new Date(ev.starts_at).toISOString().slice(0, 16));
    setEndsAt(new Date(ev.ends_at).toISOString().slice(0, 16));
    setModalOpen(true);

    // Fetch roster so People tab is instantly populated
    handleOpenRoster(ev);
  }

  function handleCloseModal() {
    setModalOpen(false);
    setEditingEventId(null);
    setError(null);
  }

  // Topic tag handling (up to 5 topics)
  function handleAddTopic(topicToAdd: string) {
    const clean = topicToAdd.trim().replace(/^#/, '');
    if (!clean) return;
    if (topics.length >= 5) return;
    if (!topics.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setTopics([...topics, clean]);
    }
    setTopicInput('');
  }

  function handleRemoveTopic(indexToRemove: number) {
    setTopics(topics.filter((_, i) => i !== indexToRemove));
  }

  // Save Event (Create or Edit)
  async function handleSaveEvent(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const isEdit = Boolean(editingEventId);
      const url = `/api/circles/${circleId}/events`;
      const method = isEdit ? 'PATCH' : 'POST';

      const parsedCapacity = capacity.trim() ? parseInt(capacity.trim(), 10) : null;
      const parsedRegClose = registrationClosesAt.trim()
        ? new Date(registrationClosesAt.trim()).toISOString()
        : null;

      const payload = {
        ...(isEdit ? { eventId: editingEventId } : {}),
        title,
        description,
        coverImageUrl: coverImageUrl.trim() ? coverImageUrl.trim() : null,
        topics,
        hostId: hostId || null,
        spaceId: spaceId || null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        repeatFrequency,
        locationType,
        liveRoomDefaultView,
        venueText,
        meetingUrl: meetingUrl.trim() ? meetingUrl.trim() : null,
        visibility,
        capacity: parsedCapacity,
        registrationClosesAt: parsedRegClose,
        hostControls: {
          record_live: recordLive,
          auto_post_recording: autoPostRecording,
          mute_on_entry: muteOnEntry,
          hide_attendees: hideAttendees,
          disable_chat: disableChat,
          disable_live_link_sharing: disableLiveLinkSharing,
          hide_location_from_non_attendees: hideLocationFromNonAttendees,
          // Extended Circle.so settings
          repeat_days: repeatDays,
          repeat_ends: repeatEnds,
          repeat_end_date: repeatEndDate,
          repeat_occurrences: repeatOccurrences,
          notify_on_publish: notifyOnPublish,
          notify_on_update: notifyOnUpdate,
          announcement_message: announcementMessage,
          is_paid: isPaidEvent,
          ticket_price: ticketPrice,
          currency: currency,
          member_discount: memberDiscountPercent,
          free_for_members: freeForMembers,
          remind_24h: remind24h,
          remind_1h: remind1h,
          remind_10m: remind10m,
          reminder_note: customReminderNote,
        },
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${isEdit ? 'update' : 'create'} event.`);
      }

      if (isEdit) {
        setEvents((prev) => prev.map((item) => (item.id === editingEventId ? data.event : item)));
        if (selectedEventDetail?.id === editingEventId) {
          setSelectedEventDetail(data.event);
        }
      } else {
        setEvents((prev) => [data.event, ...prev]);
      }
      handleCloseModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save event.');
    } finally {
      setLoading(false);
    }
  }

  // Cancel Event
  async function handleCancelEvent(eventId: string) {
    if (!window.confirm('Are you sure you want to cancel this event? Attendees will be notified.')) {
      return;
    }
    setError(null);
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
      setError(err instanceof Error ? err.message : 'Failed to cancel event.');
    }
  }

  // RSVP Register or Cancel
  async function handleRsvp(eventId: string, action: 'register' | 'cancel') {
    setError(null);
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
      setError(err instanceof Error ? err.message : 'Unable to update RSVP.');
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
      ev.location_type === 'live_room'
        ? `Live Room (Circle.so)`
        : ev.location_type === 'zoom' || ev.location_type === 'online'
        ? ev.meeting_url || 'Online Meeting'
        : ev.venue_text || 'In-person'
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
      ev.location_type === 'live_room'
        ? 'Live Room'
        : (ev.location_type === 'zoom' || ev.location_type === 'online' ? ev.meeting_url : ev.venue_text) ||
          'Online';

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

      // Space
      if (selectedSpaceId !== 'all' && ev.space_id !== selectedSpaceId) {
        return false;
      }

      // Topic
      if (selectedTopic !== 'all' && (!ev.topics || !ev.topics.includes(selectedTopic))) {
        return false;
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const matchesDesc = (ev.description || '').toLowerCase().includes(q);
        const matchesHost = (ev.host?.display_name || ev.organizer?.display_name || '')
          .toLowerCase()
          .includes(q);
        const matchesTopic = ev.topics?.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesHost && !matchesTopic) {
          return false;
        }
      }

      return true;
    });
  }, [events, timeframe, selectedSpaceId, selectedTopic, searchQuery]);

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
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-800 border border-emerald-200/60">
              {filteredEvents.length} {filteredEvents.length === 1 ? 'EVENT' : 'EVENTS'}
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-stone-500 font-normal">
            Live rooms, workshops, community calls, and meetups with RSVP sync.
          </p>
        </div>

        {canCreateEvent && (
          <Button
            type="button"
            onClick={handleOpenCreate}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-800 transition-all self-start sm:self-auto"
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

          {/* Search, Space filter & List/Calendar view toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:w-60">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events, topics, hosts..."
                className="w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            {/* Space Dropdown */}
            {spaces.length > 0 && (
              <select
                value={selectedSpaceId}
                onChange={(e) => setSelectedSpaceId(e.target.value)}
                className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 focus:outline-none"
              >
                <option value="all">All Spaces</option>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    #{s.name}
                  </option>
                ))}
              </select>
            )}

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

        {/* Topic Filter Pills Bar */}
        {allAvailableTopics.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
            <span className="text-[11px] font-mono uppercase font-bold text-stone-400 mr-1 flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Topics:
            </span>
            <button
              type="button"
              onClick={() => setSelectedTopic('all')}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
                selectedTopic === 'all'
                  ? 'bg-emerald-800 text-white font-semibold'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              All
            </button>
            {allAvailableTopics.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTopic(t)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
                  selectedTopic === t
                    ? 'bg-emerald-800 text-white font-semibold'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Main Events Content (List Mode or Calendar Mode) */}
      {viewMode === 'calendar' ? (
        /* Calendar View */
        <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-emerald-700" />
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
                    dayEvents.length > 0 ? 'cursor-pointer hover:bg-emerald-50/40' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        isToday ? 'bg-emerald-700 text-white' : 'text-stone-700'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-bold text-emerald-800">
                        {dayEvents.length} ev
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 mt-1">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        className="truncate rounded bg-emerald-100/70 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900 border border-emerald-200/50"
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
              ? 'There are no upcoming events scheduled right now. Host a live room or meetup!'
              : 'No past events match your current filters.'}
          </p>
          {canCreateEvent && (
            <Button
              type="button"
              onClick={handleOpenCreate}
              className="mt-5 rounded-xl bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-800 shadow-xs"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Schedule Event
            </Button>
          )}
        </div>
      ) : (
        /* Circle.so Style Event Cards Grid / List */
        <div className="space-y-4">
          {filteredEvents.map((ev) => {
            const dateComp = formatDateComponents(ev.starts_at);
            const isGoing = ev.viewer_rsvp_status === 'going';
            const isWaitlisted = ev.viewer_rsvp_status === 'waitlisted';
            const hostUser = ev.host || ev.organizer;

            return (
              <div
                key={ev.id}
                className="group relative overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-xs hover:border-emerald-700/40 hover:shadow-md transition-all duration-200 flex flex-col md:flex-row"
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
                    <div className="h-44 md:h-full w-full bg-gradient-to-br from-emerald-800 via-stone-800 to-stone-900 flex items-center justify-center p-6 text-white text-center">
                      <div>
                        <Radio className="h-8 w-8 mx-auto text-emerald-400/80 mb-2" />
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-white/70 block">
                          {ev.location_type === 'live_room' ? 'Circle Live Room' : 'Community Event'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Circle.so Date Pill Overlay on Mobile / Cover */}
                  <div className="absolute top-3 left-3 flex flex-col items-center overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-md">
                    <span className="w-full bg-emerald-800 px-2.5 py-0.5 text-center text-[9px] font-mono font-bold tracking-wider text-white">
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
                    {/* Top Meta Line: Space pill, Location badge, Repeat indicator */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {ev.space_name && (
                        <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-stone-700 border border-stone-200">
                          #{ev.space_name}
                        </span>
                      )}

                      {/* Location Type Pill */}
                      {ev.location_type === 'live_room' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-mono font-bold text-emerald-800 border border-emerald-200">
                          <Radio className="h-3 w-3 text-emerald-600 animate-pulse" />
                          Live Room
                        </span>
                      )}
                      {ev.location_type === 'zoom' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-mono font-bold text-sky-800 border border-sky-200">
                          <Video className="h-3 w-3 text-sky-600" />
                          Zoom
                        </span>
                      )}
                      {ev.location_type === 'in_person' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-mono font-bold text-amber-800 border border-amber-200">
                          <MapPin className="h-3 w-3 text-amber-600" />
                          In-Person
                        </span>
                      )}
                      {ev.location_type === 'online' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-mono font-bold text-indigo-800 border border-indigo-200">
                          <Globe className="h-3 w-3 text-indigo-600" />
                          Online
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
                      className="text-base sm:text-lg font-bold text-stone-900 group-hover:text-emerald-800 transition-colors cursor-pointer"
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

                    {/* Topics Tags */}
                    {ev.topics && ev.topics.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {ev.topics.map((t) => (
                          <span
                            key={t}
                            className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-mono font-medium text-stone-600"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bottom Footer: Host & Social Proof Facepile & Circle.so RSVP */}
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

                      {/* Circle.so 1-Click RSVP Button */}
                      {isMember && (
                        <div>
                          {isGoing ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleRsvp(ev.id, 'cancel')}
                              className="h-8 rounded-xl border-emerald-600 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 transition-all"
                            >
                              <Check className="mr-1 h-3.5 w-3.5 text-emerald-700" />
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
      {/* 4. CIRCLE.SO EVENT DETAIL MODAL                                           */}
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
                <div className="h-full w-full bg-gradient-to-br from-emerald-900 via-stone-900 to-black flex items-center justify-center">
                  <Radio className="h-12 w-12 text-emerald-400/60" />
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
                {selectedEventDetail.space_name && (
                  <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-stone-900 shadow-md backdrop-blur-md">
                    #{selectedEventDetail.space_name}
                  </span>
                )}
                <span className="rounded-full bg-emerald-700 text-white px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider shadow-md">
                  {selectedEventDetail.location_type.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-7 space-y-6">
              {/* Title & Calendar Pill */}
              <div className="flex items-start gap-4">
                <div className="hidden sm:flex flex-col items-center overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs shrink-0">
                  <span className="w-full bg-emerald-800 px-3 py-1 text-center text-[10px] font-mono font-bold tracking-wider text-white">
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

              {/* Topics Pills */}
              {selectedEventDetail.topics && selectedEventDetail.topics.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {selectedEventDetail.topics.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-mono font-semibold text-stone-700 border border-stone-200"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {/* RSVP & Add to Calendar Action Row */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                <div className="flex items-center gap-3">
                  {isMember && (
                    <>
                      {selectedEventDetail.viewer_rsvp_status === 'going' ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-900 border border-emerald-300">
                            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                            You are Going!
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRsvp(selectedEventDetail.id, 'cancel')}
                            className="h-8 text-xs text-stone-500 hover:text-rose-600"
                          >
                            Can&apos;t go
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => handleRsvp(selectedEventDetail.id, 'register')}
                          className="h-9 rounded-xl bg-emerald-700 px-5 text-xs font-bold text-white hover:bg-emerald-800 shadow-xs"
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
                    <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                    Location & Access
                  </h4>
                  {selectedEventDetail.live_room_default_view && (
                    <span className="text-[11px] font-mono text-stone-400 capitalize">
                      Default view: {selectedEventDetail.live_room_default_view}
                    </span>
                  )}
                </div>

                {selectedEventDetail.location_hidden ? (
                  /* Location Hidden notice from host controls */
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-center">
                    <Lock className="mx-auto h-5 w-5 text-amber-700 mb-1" />
                    <p className="text-xs font-bold text-amber-900">Location Hidden from Non-Attendees</p>
                    <p className="mt-0.5 text-xs text-amber-700">
                      RSVP &quot;Going&quot; to this event to reveal the live room and meeting links.
                    </p>
                  </div>
                ) : (
                  <div>
                    {selectedEventDetail.location_type === 'live_room' && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white shrink-0">
                            <Radio className="h-5 w-5 animate-pulse" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-emerald-950 block">
                              Circles Native Live Room
                            </span>
                            <span className="text-[11px] text-emerald-800">
                              Direct high-definition audio & video in your browser
                            </span>
                          </div>
                        </div>

                        <Button
                          type="button"
                          className="rounded-xl bg-emerald-800 text-white text-xs font-semibold px-4 py-2 hover:bg-emerald-900 shadow-xs"
                          onClick={() =>
                            alert(
                              `Joining Live Room for "${selectedEventDetail.title}" (Default View: ${
                                selectedEventDetail.live_room_default_view || 'Gallery'
                              }).`
                            )
                          }
                        >
                          Join Live Room
                        </Button>
                      </div>
                    )}

                    {(selectedEventDetail.location_type === 'zoom' ||
                      selectedEventDetail.location_type === 'online') && (
                      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shrink-0">
                            <Video className="h-5 w-5" />
                          </div>
                          <div className="truncate">
                            <span className="text-xs font-bold text-stone-900 block truncate">
                              {selectedEventDetail.location_type === 'zoom'
                                ? 'Zoom Meeting'
                                : 'Virtual Meeting Link'}
                            </span>
                            <span className="text-[11px] text-stone-500 font-mono truncate block">
                              {selectedEventDetail.meeting_url || 'Meeting URL provided upon start'}
                            </span>
                          </div>
                        </div>

                        {selectedEventDetail.meeting_url && (
                          <div className="flex items-center gap-2">
                            <a
                              href={selectedEventDetail.meeting_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-700 shadow-xs inline-flex items-center gap-1"
                            >
                              Open Meeting
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
                                <Check className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedEventDetail.location_type === 'in_person' && (
                      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 flex items-center justify-between">
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
                            className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs inline-flex items-center gap-1"
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

              {/* Host Controls Badges & Transparency */}
              {selectedEventDetail.host_controls && (
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-500 block">
                    Host Session Rules
                  </span>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {selectedEventDetail.host_controls.record_live && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 font-medium text-rose-800 border border-rose-200">
                        <Disc className="h-3 w-3 text-rose-600" />
                        Will be recorded
                      </span>
                    )}
                    {selectedEventDetail.host_controls.mute_on_entry && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 font-medium text-stone-700 border border-stone-200">
                        <MicOff className="h-3 w-3" />
                        Mute upon entry
                      </span>
                    )}
                    {selectedEventDetail.host_controls.disable_chat ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 font-medium text-stone-700 border border-stone-200">
                        <MessageSquareOff className="h-3 w-3" />
                        Chat disabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 font-medium text-stone-700 border border-stone-200">
                        Chat enabled
                      </span>
                    )}
                    {selectedEventDetail.host_controls.hide_location_from_non_attendees && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 font-medium text-amber-800 border border-amber-200">
                        <Lock className="h-3 w-3" />
                        Attendee-only location
                      </span>
                    )}
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
                      Edit Event
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenRoster(selectedEventDetail)}
                      className="rounded-xl text-xs font-semibold"
                    >
                      <UserCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-700" />
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
      {/* 5. CIRCLE.SO CREATE & EDIT EVENT MODAL (7 TABS: OVERVIEW, PEOPLE, ETC.)    */}
      {/* ========================================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs animate-in fade-in">
          <div className="relative flex flex-col max-h-[94vh] w-full max-w-4xl rounded-3xl border border-stone-200 bg-white shadow-2xl overflow-hidden">
            {/* STICKY TOP MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-stone-200/80 bg-stone-50/80 px-6 py-4 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-xs">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-stone-900 truncate max-w-md">
                      {editingEventId ? title || 'Edit Event' : 'Create an Event'}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                        eventStatus === 'published'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : eventStatus === 'cancelled'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-stone-100 text-stone-600 border-stone-200'
                      }`}
                    >
                      {eventStatus === 'published' && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      )}
                      {eventStatus === 'published'
                        ? 'Published'
                        : eventStatus === 'cancelled'
                        ? 'Cancelled'
                        : 'Draft'}
                    </span>
                    {spaceId && (
                      <span className="hidden sm:inline-block rounded-full bg-stone-200/60 px-2 py-0.5 text-[11px] font-mono text-stone-700">
                        #{spaces.find((s) => s.id === spaceId)?.name || 'Space'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 font-normal">
                    {editingEventId
                      ? 'Manage attendee roster, live room controls, payments, and reminders.'
                      : 'Schedule gatherings, live rooms, guest RSVPs, and automated reminders.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {editingEventId && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/circles/${circleSlug}/events`
                        );
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }
                    }}
                    className="hidden sm:inline-flex rounded-xl text-xs gap-1.5"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Link
                      </>
                    )}
                  </Button>
                )}
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-full p-2 text-stone-400 hover:bg-stone-200/60 hover:text-stone-700 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* HORIZONTAL TAB BAR (CIRCLE.SO STYLE 7 TABS) */}
            <div className="flex items-center overflow-x-auto border-b border-stone-200/80 bg-white px-6 scrollbar-none">
              {[
                { id: 'overview', label: 'Overview', icon: LayoutGrid },
                {
                  id: 'people',
                  label: 'People',
                  icon: Users,
                  badge: editingEventId ? (rosterRsvps.length || currentEditingEvent?.going_count || 0) : null,
                },
                { id: 'basic_info', label: 'Basic info', icon: CalendarIcon },
                { id: 'notifications', label: 'Notifications', icon: Bell },
                { id: 'payment', label: 'Payment', icon: CreditCard },
                { id: 'reminders', label: 'Reminders', icon: Clock },
                { id: 'advanced', label: 'Advanced', icon: Sliders },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeModalTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      setActiveModalTab(
                        tab.id as
                          | 'overview'
                          | 'people'
                          | 'basic_info'
                          | 'notifications'
                          | 'payment'
                          | 'reminders'
                          | 'advanced'
                      )
                    }
                    className={`relative flex items-center gap-2 whitespace-nowrap py-3.5 px-3 text-xs sm:text-sm font-semibold transition-colors border-b-2 -mb-[2px] ${
                      isActive
                        ? 'border-emerald-800 text-emerald-950'
                        : 'border-transparent text-stone-500 hover:text-stone-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    {tab.badge !== null && tab.badge !== undefined && (
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono font-bold ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {error && (
              <div className="mx-6 mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* SCROLLABLE TAB CONTENT PANE */}
            <form onSubmit={handleSaveEvent} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
              {/* ======================================================== */}
              {/* TAB 1: OVERVIEW                                          */}
              {/* ======================================================== */}
              {activeModalTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in-50">
                  {/* Hero Card */}
                  <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-900 via-stone-950 to-black text-white p-6 shadow-md">
                    <div className="absolute top-0 right-0 h-40 w-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="relative z-10 flex flex-col sm:flex-row justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-mono uppercase text-emerald-300">
                            {locationType === 'live_room' ? 'Live Room' : locationType}
                          </span>
                          <span className="text-xs text-stone-400">
                            {startsAt
                              ? new Date(startsAt).toLocaleDateString(undefined, {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Date not set'}
                          </span>
                        </div>
                        <h4 className="text-xl font-extrabold text-white">
                          {title || 'Untitled Community Event'}
                        </h4>
                        <p className="text-xs text-stone-300 line-clamp-2 max-w-xl">
                          {description || 'No description provided yet.'}
                        </p>
                      </div>

                      <div className="flex sm:flex-col justify-end items-end gap-2">
                        {locationType === 'live_room' && (
                          <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 border border-emerald-500/30">
                            <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                            Live Room Ready
                          </div>
                        )}
                        {currentEditingEvent && (
                          <button
                            type="button"
                            onClick={() => downloadIcsFile(currentEditingEvent)}
                            className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-white"
                          >
                            <Download className="h-3 w-3" />
                            Add to Calendar (.ics)
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stat Counters Grid */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                      <span className="text-xs font-medium text-stone-500">RSVPs Going</span>
                      <p className="mt-1 text-2xl font-black text-stone-900">
                        {currentEditingEvent?.going_count || rosterRsvps.filter((r) => r.status === 'going').length}
                      </p>
                      <span className="text-[10px] text-emerald-700 font-medium">Confirmed guests</span>
                    </div>

                    <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                      <span className="text-xs font-medium text-stone-500">Waitlist</span>
                      <p className="mt-1 text-2xl font-black text-stone-900">
                        {currentEditingEvent?.waitlisted_count || rosterRsvps.filter((r) => r.status === 'waitlisted').length}
                      </p>
                      <span className="text-[10px] text-amber-700 font-medium">Auto-promoted if spot opens</span>
                    </div>

                    <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                      <span className="text-xs font-medium text-stone-500">Checked In</span>
                      <p className="mt-1 text-2xl font-black text-stone-900">
                        {currentEditingEvent?.attended_count || rosterRsvps.filter((r) => r.attended).length}
                      </p>
                      <span className="text-[10px] text-stone-500 font-medium">Verified attendance</span>
                    </div>

                    <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                      <span className="text-xs font-medium text-stone-500">Capacity</span>
                      <p className="mt-1 text-2xl font-black text-stone-900">
                        {capacity ? capacity : 'Unlimited'}
                      </p>
                      <span className="text-[10px] text-stone-500 font-medium">
                        {capacity ? 'Enforced with waitlist' : 'Open attendance'}
                      </span>
                    </div>
                  </div>

                  {/* Summary & Quick Jump Cards */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-stone-200 p-4 space-y-3 bg-white">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-900">Host & Space</span>
                        <button
                          type="button"
                          onClick={() => setActiveModalTab('basic_info')}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          Edit
                        </button>
                      </div>
                      <div className="text-xs text-stone-600 space-y-1">
                        <p>
                          <strong className="text-stone-800">Host:</strong>{' '}
                          {members.find((m) => m.user_id === hostId)?.profile?.display_name || 'Designated Host'}
                        </p>
                        <p>
                          <strong className="text-stone-800">Space:</strong>{' '}
                          {spaces.find((s) => s.id === spaceId)?.name || 'General Community'}
                        </p>
                        <p>
                          <strong className="text-stone-800">Repeat:</strong>{' '}
                          {repeatFrequency === 'none'
                            ? 'Does not repeat'
                            : `${repeatFrequency} on ${repeatDays.join(', ')}`}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-stone-200 p-4 space-y-3 bg-white">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-900">Attendee Roster</span>
                        <button
                          type="button"
                          onClick={() => setActiveModalTab('people')}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          Manage People →
                        </button>
                      </div>
                      <p className="text-xs text-stone-500">
                        {rosterRsvps.length > 0
                          ? `${rosterRsvps.length} members have registered for this event. View guest list, verify check-in, or export attendance.`
                          : 'No RSVPs yet. Share your event link with Circle members to start collecting registrations.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 2: PEOPLE (ATTENDEE ROSTER & CHECK-IN)               */}
              {/* ======================================================== */}
              {activeModalTab === 'people' && (
                <div className="space-y-4 animate-in fade-in-50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-stone-900">
                        Attendee Roster &amp; Check-in
                      </h4>
                      <p className="text-xs text-stone-500">
                        Manage registered guests, verify check-ins, and inspect RSVP status.
                      </p>
                    </div>

                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-stone-400" />
                      <input
                        type="text"
                        value={rosterSearch}
                        onChange={(e) => setRosterSearch(e.target.value)}
                        placeholder="Search attendees..."
                        className="rounded-xl border border-stone-200 bg-stone-50 pl-8 pr-3 py-1.5 text-xs text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  {loadingRoster ? (
                    <div className="py-12 text-center text-xs text-stone-400">
                      Loading guest list...
                    </div>
                  ) : rosterRsvps.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center">
                      <Users className="mx-auto h-8 w-8 text-stone-400" />
                      <h5 className="mt-2 text-sm font-bold text-stone-800">No RSVPs recorded yet</h5>
                      <p className="mt-1 text-xs text-stone-500 max-w-sm mx-auto">
                        Once members RSVP to this event, their names, registration timestamps, and check-in buttons will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white overflow-hidden max-h-96 overflow-y-auto">
                      {rosterRsvps
                        .filter((r) =>
                          (r.profile?.display_name || r.profile?.username || '')
                            .toLowerCase()
                            .includes(rosterSearch.toLowerCase())
                        )
                        .map((rsvp) => (
                          <div
                            key={rsvp.id}
                            className="flex items-center justify-between p-3.5 hover:bg-stone-50/60 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-200 text-stone-700 text-xs font-bold overflow-hidden">
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
                                <div className="flex items-center gap-2 text-[10px] text-stone-400">
                                  <span>@{rsvp.profile?.username || 'member'}</span>
                                  <span>•</span>
                                  <span
                                    className={`font-semibold uppercase font-mono ${
                                      rsvp.status === 'going'
                                        ? 'text-emerald-700'
                                        : rsvp.status === 'waitlisted'
                                        ? 'text-amber-700'
                                        : 'text-rose-700'
                                    }`}
                                  >
                                    {rsvp.status}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                handleToggleAttendance(rsvp.user_id, Boolean(rsvp.attended))
                              }
                              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                                rsvp.attended
                                  ? 'bg-emerald-700 text-white shadow-xs'
                                  : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-100'
                              }`}
                            >
                              {rsvp.attended ? 'Attended ✓' : 'Mark Attended'}
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 3: BASIC INFO                                        */}
              {/* ======================================================== */}
              {activeModalTab === 'basic_info' && (
                <div className="space-y-6 animate-in fade-in-50">
                  {/* Cover Image Upload */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      Event Cover Image
                    </label>
                    <ImageUploader
                      circleId={circleId}
                      value={coverImageUrl}
                      onChange={(val: string | string[]) =>
                        setCoverImageUrl(Array.isArray(val) ? val[0] || '' : val)
                      }
                      aspectRatio="video"
                    />
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700">
                        Event Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Super Sunday Live Workshop"
                        className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700">
                        Description &amp; Agenda
                      </label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Provide session agenda, preparation steps, or key takeaways..."
                        className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Topics Tags */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-stone-700">
                        Topics (Tags)
                      </label>
                      <span className="text-[10px] font-mono text-stone-400">
                        Choose up to 5 topics ({topics.length}/5)
                      </span>
                    </div>

                    {topics.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {topics.map((t, idx) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-mono font-medium text-emerald-900 border border-emerald-200"
                          >
                            #{t}
                            <button
                              type="button"
                              onClick={() => handleRemoveTopic(idx)}
                              className="text-emerald-700 hover:text-rose-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {topics.length < 5 && (
                      <div className="mt-1.5 flex items-center gap-2">
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
                          placeholder="Add topic (e.g. ama, workshop, onboarding) and press Enter..."
                          className="flex-1 rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-1.5 text-xs text-stone-800 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddTopic(topicInput)}
                          disabled={!topicInput.trim()}
                          className="rounded-xl text-xs"
                        >
                          Add
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Host & Space Selector */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t border-stone-100">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700">Host *</label>
                      <select
                        value={hostId}
                        onChange={(e) => setHostId(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                      >
                        {members.length > 0 ? (
                          members.map((m) => (
                            <option key={m.user_id} value={m.user_id}>
                              {m.profile?.display_name || m.profile?.username || 'Member'} ({m.role})
                            </option>
                          ))
                        ) : (
                          <option value={currentUserId || ''}>You (Current User)</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700">Space</label>
                      <select
                        value={spaceId}
                        onChange={(e) => setSpaceId(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                      >
                        <option value="">General Community</option>
                        {spaces.map((s) => (
                          <option key={s.id} value={s.id}>
                            #{s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="space-y-4 pt-2 border-t border-stone-100">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700">
                          Start Date &amp; Time *
                        </label>
                        <input
                          type="datetime-local"
                          required
                          value={startsAt}
                          onChange={(e) => setStartsAt(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-stone-700">
                          End Date &amp; Time *
                        </label>
                        <input
                          type="datetime-local"
                          required
                          value={endsAt}
                          onChange={(e) => setEndsAt(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* REPEAT & EXTENDED OPTIONS */}
                    <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700">
                          Repeat Schedule
                        </label>
                        <select
                          value={repeatFrequency}
                          onChange={(e) =>
                            setRepeatFrequency(
                              e.target.value as 'none' | 'weekly' | 'biweekly' | 'monthly'
                            )
                          }
                          className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
                        >
                          <option value="none">Does not repeat</option>
                          <option value="weekly">Repeats weekly</option>
                          <option value="biweekly">Repeats every 2 weeks (Bi-weekly)</option>
                          <option value="monthly">Repeats monthly</option>
                        </select>
                      </div>

                      {/* Day of Week Selector when weekly/biweekly */}
                      {(repeatFrequency === 'weekly' || repeatFrequency === 'biweekly') && (
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">
                            Repeat on Days:
                          </label>
                          <div className="flex gap-1.5">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => {
                              const isSelected = repeatDays.includes(d);
                              return (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      if (repeatDays.length > 1) {
                                        setRepeatDays(repeatDays.filter((x) => x !== d));
                                      }
                                    } else {
                                      setRepeatDays([...repeatDays, d]);
                                    }
                                  }}
                                  className={`h-8 w-9 rounded-lg text-xs font-bold transition-all ${
                                    isSelected
                                      ? 'bg-emerald-800 text-white shadow-xs'
                                      : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
                                  }`}
                                >
                                  {d.slice(0, 1)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Repeat Ends */}
                      {repeatFrequency !== 'none' && (
                        <div className="space-y-2 pt-2 border-t border-stone-200/60">
                          <label className="block text-[11px] font-semibold text-stone-600">
                            Repeat Ends:
                          </label>
                          <div className="flex flex-wrap gap-3 text-xs text-stone-700">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="repeatEnds"
                                checked={repeatEnds === 'never'}
                                onChange={() => setRepeatEnds('never')}
                                className="text-emerald-700"
                              />
                              <span>Never</span>
                            </label>
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="repeatEnds"
                                checked={repeatEnds === 'on_date'}
                                onChange={() => setRepeatEnds('on_date')}
                                className="text-emerald-700"
                              />
                              <span>On date</span>
                            </label>
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="repeatEnds"
                                checked={repeatEnds === 'after_occurrences'}
                                onChange={() => setRepeatEnds('after_occurrences')}
                                className="text-emerald-700"
                              />
                              <span>After N occurrences</span>
                            </label>
                          </div>

                          {repeatEnds === 'on_date' && (
                            <input
                              type="date"
                              value={repeatEndDate}
                              onChange={(e) => setRepeatEndDate(e.target.value)}
                              className="mt-1 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900"
                            />
                          )}

                          {repeatEnds === 'after_occurrences' && (
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={repeatOccurrences}
                                onChange={(e) => setRepeatOccurrences(parseInt(e.target.value, 10) || 1)}
                                className="w-20 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900"
                              />
                              <span className="text-xs text-stone-500">occurrences</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Location & Room */}
                  <div className="space-y-4 pt-2 border-t border-stone-100">
                    <label className="block text-xs font-semibold text-stone-700">
                      Location &amp; Room Format *
                    </label>

                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {[
                        { key: 'live_room', label: 'Live room', icon: Radio },
                        { key: 'zoom', label: 'Zoom', icon: Video },
                        { key: 'in_person', label: 'In-person', icon: MapPin },
                        { key: 'online', label: 'Custom link', icon: Globe },
                      ].map((loc) => {
                        const Icon = loc.icon;
                        const isSelected = locationType === loc.key;
                        return (
                          <button
                            key={loc.key}
                            type="button"
                            onClick={() =>
                              setLocationType(
                                loc.key as 'live_room' | 'zoom' | 'in_person' | 'online'
                              )
                            }
                            className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3.5 text-center transition-all ${
                              isSelected
                                ? 'border-emerald-800 bg-emerald-50/80 text-emerald-950 font-bold shadow-xs'
                                : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            <span className="text-xs">{loc.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {locationType === 'live_room' && (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Default Live Room View
                        </label>
                        <div className="flex gap-4">
                          <label className="inline-flex items-center gap-2 text-xs font-medium text-stone-800 cursor-pointer">
                            <input
                              type="radio"
                              name="defaultView"
                              checked={liveRoomDefaultView === 'gallery'}
                              onChange={() => setLiveRoomDefaultView('gallery')}
                              className="text-emerald-700"
                            />
                            <span>Gallery (Grid view)</span>
                          </label>
                          <label className="inline-flex items-center gap-2 text-xs font-medium text-stone-800 cursor-pointer">
                            <input
                              type="radio"
                              name="defaultView"
                              checked={liveRoomDefaultView === 'speaker'}
                              onChange={() => setLiveRoomDefaultView('speaker')}
                              className="text-emerald-700"
                            />
                            <span>Speaker view</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {(locationType === 'zoom' || locationType === 'online') && (
                      <div>
                        <label className="block text-xs font-semibold text-stone-700">
                          Meeting Link (URL) *
                        </label>
                        <input
                          type="url"
                          value={meetingUrl}
                          onChange={(e) => setMeetingUrl(e.target.value)}
                          placeholder="https://zoom.us/j/... or https://meet.google.com/..."
                          className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                        />
                      </div>
                    )}

                    {locationType === 'in_person' && (
                      <div>
                        <label className="block text-xs font-semibold text-stone-700">
                          Physical Venue Address *
                        </label>
                        <input
                          type="text"
                          value={venueText}
                          onChange={(e) => setVenueText(e.target.value)}
                          placeholder="e.g. 100 Main St, Room 402, New York, NY"
                          className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs sm:text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Visibility */}
                  <div className="space-y-2 pt-2 border-t border-stone-100">
                    <label className="block text-xs font-semibold text-stone-700">
                      Audience Visibility
                    </label>
                    <select
                      value={visibility}
                      onChange={(e) =>
                        setVisibility(e.target.value as 'community' | 'space_members' | 'secret')
                      }
                      className="w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                    >
                      <option value="community">Community (All Circle members)</option>
                      <option value="space_members">Space members only</option>
                      <option value="secret">Secret / Invite only</option>
                    </select>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 4: NOTIFICATIONS                                     */}
              {/* ======================================================== */}
              {activeModalTab === 'notifications' && (
                <div className="space-y-6 animate-in fade-in-50">
                  <div>
                    <h4 className="text-sm font-bold text-stone-900">
                      Notification Preferences
                    </h4>
                    <p className="text-xs text-stone-500">
                      Configure automated member announcements and event change notifications.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50/50 p-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyOnPublish}
                        onChange={(e) => setNotifyOnPublish(e.target.checked)}
                        className="mt-0.5 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-stone-900 block">
                          Broadcast notification upon publishing
                        </span>
                        <span className="text-stone-500 leading-relaxed block mt-0.5">
                          Sends an in-app community alert to active Circle members letting them know this event has been announced.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50/50 p-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyOnUpdate}
                        onChange={(e) => setNotifyOnUpdate(e.target.checked)}
                        className="mt-0.5 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-stone-900 block">
                          Notify confirmed attendees of schedule changes
                        </span>
                        <span className="text-stone-500 leading-relaxed block mt-0.5">
                          Automatically alerts confirmed RSVPs if the date, time, venue, or live room link is modified.
                        </span>
                      </div>
                    </label>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Custom Announcement Note (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={announcementMessage}
                        onChange={(e) => setAnnouncementMessage(e.target.value)}
                        placeholder="e.g. Join us for a hands-on Q&amp;A with special guests! Bring your project questions."
                        className="w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                      />
                    </div>

                    {/* Preview Card */}
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-800 block">
                        Preview: Member Notification
                      </span>
                      <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-xs">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-800 text-white text-xs">
                          <Bell className="h-3.5 w-3.5" />
                        </div>
                        <div className="text-xs">
                          <p className="font-bold text-stone-900">
                            New event scheduled: {title || 'Super Sunday Live'}
                          </p>
                          <p className="text-stone-500 mt-0.5">
                            {announcementMessage || 'RSVP now to save your spot in this community gathering.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 5: PAYMENT & TICKETING                               */}
              {/* ======================================================== */}
              {activeModalTab === 'payment' && (
                <div className="space-y-6 animate-in fade-in-50">
                  <div>
                    <h4 className="text-sm font-bold text-stone-900">
                      Payment &amp; Ticketing Access
                    </h4>
                    <p className="text-xs text-stone-500">
                      Configure paid tickets, token pricing, or free community registration.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPaidEvent(false)}
                      className={`flex flex-col items-start p-4 rounded-2xl border text-left transition-all ${
                        !isPaidEvent
                          ? 'border-emerald-800 bg-emerald-50/80 shadow-xs'
                          : 'border-stone-200 bg-white hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold text-stone-900">Free Event</span>
                        {!isPaidEvent && <Check className="h-4 w-4 text-emerald-700" />}
                      </div>
                      <p className="text-xs text-stone-500 mt-1">
                        Any eligible Circle member can RSVP and attend at no cost.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPaidEvent(true)}
                      className={`flex flex-col items-start p-4 rounded-2xl border text-left transition-all ${
                        isPaidEvent
                          ? 'border-emerald-800 bg-emerald-50/80 shadow-xs'
                          : 'border-stone-200 bg-white hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold text-stone-900">Paid Ticket</span>
                        {isPaidEvent && <Check className="h-4 w-4 text-emerald-700" />}
                      </div>
                      <p className="text-xs text-stone-500 mt-1">
                        Attendees must purchase a ticket or redeem community tokens.
                      </p>
                    </button>
                  </div>

                  {isPaidEvent && (
                    <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 space-y-4 animate-in fade-in-50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-stone-700">
                            Ticket Price *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={ticketPrice}
                            onChange={(e) => setTicketPrice(e.target.value)}
                            placeholder="e.g. 25.00"
                            className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700">
                            Currency
                          </label>
                          <select
                            value={currency}
                            onChange={(e) =>
                              setCurrency(e.target.value as 'BACHS' | 'USD' | 'EUR' | 'GBP')
                            }
                            className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-emerald-600 focus:outline-none"
                          >
                            <option value="BACHS">BACHS (Community tokens)</option>
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-3 pt-3 border-t border-stone-200/60">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={freeForMembers}
                            onChange={(e) => setFreeForMembers(e.target.checked)}
                            className="rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
                          />
                          <span className="text-xs font-medium text-stone-800">
                            Free for Core / Tiered subscribers
                          </span>
                        </label>

                        <div>
                          <label className="block text-xs font-semibold text-stone-700">
                            Member Discount (%):
                          </label>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={memberDiscountPercent}
                              onChange={(e) =>
                                setMemberDiscountPercent(parseInt(e.target.value, 10) || 0)
                              }
                              className="w-24 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900"
                            />
                            <span className="text-xs text-stone-500">% discount for active members</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 6: REMINDERS                                         */}
              {/* ======================================================== */}
              {activeModalTab === 'reminders' && (
                <div className="space-y-6 animate-in fade-in-50">
                  <div>
                    <h4 className="text-sm font-bold text-stone-900">
                      Automated Pre-Event Reminders
                    </h4>
                    <p className="text-xs text-stone-500">
                      Configure automated reminder blasts delivered to confirmed attendees.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50/50 p-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={remind24h}
                        onChange={(e) => setRemind24h(e.target.checked)}
                        className="mt-0.5 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-stone-900 block">24 hours before event</span>
                        <span className="text-stone-500 leading-relaxed block mt-0.5">
                          Sends an in-app and email reminder with calendar link and agenda.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50/50 p-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={remind1h}
                        onChange={(e) => setRemind1h(e.target.checked)}
                        className="mt-0.5 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-stone-900 block">1 hour before event</span>
                        <span className="text-stone-500 leading-relaxed block mt-0.5">
                          Direct nudge with 1-click &quot;Join Live Room&quot; shortcut.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50/50 p-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={remind10m}
                        onChange={(e) => setRemind10m(e.target.checked)}
                        className="mt-0.5 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-stone-900 block">10 minutes before event</span>
                        <span className="text-stone-500 leading-relaxed block mt-0.5">
                          High-priority notification letting attendees know the room is opening.
                        </span>
                      </div>
                    </label>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Custom Reminder Guidance Note
                      </label>
                      <textarea
                        rows={2}
                        value={customReminderNote}
                        onChange={(e) => setCustomReminderNote(e.target.value)}
                        placeholder="e.g. Please test your camera and microphone beforehand. Notes will be shared in the chat."
                        className="w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3.5 py-2 text-xs text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* TAB 7: ADVANCED (HOST CONTROLS & CAPACITY)                */}
              {/* ======================================================== */}
              {activeModalTab === 'advanced' && (
                <div className="space-y-6 animate-in fade-in-50">
                  <div>
                    <h4 className="text-sm font-bold text-stone-900">
                      Host Controls &amp; Registration Limits
                    </h4>
                    <p className="text-xs text-stone-500">
                      Live room permissions, privacy toggles, registration limits, and event lifecycle.
                    </p>
                  </div>

                  {/* 7 Circle.so Host Controls */}
                  <div className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50/50 p-4">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-stone-500 block">
                      Live Room &amp; Session Controls
                    </span>

                    <div className="space-y-2.5">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={recordLive}
                          onChange={(e) => setRecordLive(e.target.checked)}
                          className="mt-0.5 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
                        />
                        <div className="text-xs">
                          <span className="font-semibold text-stone-900 block">Record this live</span>
                          <span className="text-stone-500">
                            Automatically captures video and audio stream for replay.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={autoPostRecording}
                          onChange={(e) => setAutoPostRecording(e.target.checked)}
                          className="mt-0.5 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
                        />
                        <div className="text-xs">
                          <span className="font-semibold text-stone-900 block">
                            Automatically post recording to event
                          </span>
                          <span className="text-stone-500">
                            Attaches the recorded replay directly to this event page once finished.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={muteOnEntry}
                          onChange={(e) => setMuteOnEntry(e.target.checked)}
                          className="mt-0.5 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
                        />
                        <div className="text-xs">
                          <span className="font-semibold text-stone-900 block">
                            Mute participants upon entry
                          </span>
                          <span className="text-stone-500">
                            Keeps joining attendees muted to prevent sudden background noise.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={hideAttendees}
                          onChange={(e) => setHideAttendees(e.target.checked)}
                          className="mt-0.5 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
                        />
                        <div className="text-xs">
                          <span className="font-semibold text-stone-900 block">
                            Hide participants list
                          </span>
                          <span className="text-stone-500">
                            Only hosts can see who is attending or registered.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={disableChat}
                          onChange={(e) => setDisableChat(e.target.checked)}
                          className="mt-0.5 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
                        />
                        <div className="text-xs">
                          <span className="font-semibold text-stone-900 block">Disable chat</span>
                          <span className="text-stone-500">
                            Disables attendee in-room text chat during the presentation.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={disableLiveLinkSharing}
                          onChange={(e) => setDisableLiveLinkSharing(e.target.checked)}
                          className="mt-0.5 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
                        />
                        <div className="text-xs">
                          <span className="font-semibold text-stone-900 block">
                            Disable live link sharing
                          </span>
                          <span className="text-stone-500">
                            Restricts joining strictly to authenticated Circle community members.
                          </span>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={hideLocationFromNonAttendees}
                          onChange={(e) => setHideLocationFromNonAttendees(e.target.checked)}
                          className="mt-0.5 rounded border-stone-300 text-emerald-800 focus:ring-emerald-700"
                        />
                        <div className="text-xs">
                          <span className="font-semibold text-stone-900 block">
                            Hide location from non-attendees
                          </span>
                          <span className="text-stone-500">
                            Meeting URLs and venue address are revealed only after RSVPing &quot;Going&quot;.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Capacity & Registration Deadline */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700">
                        Max Capacity Limit
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={capacity}
                        onChange={(e) => setCapacity(e.target.value)}
                        placeholder="Leave blank for unlimited"
                        className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                      />
                      <span className="text-[10px] text-stone-400 mt-0.5 block">
                        Waitlist is automatically activated when capacity is reached.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700">
                        Registration Closes At
                      </label>
                      <input
                        type="datetime-local"
                        value={registrationClosesAt}
                        onChange={(e) => setRegistrationClosesAt(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-stone-200 bg-stone-50/60 px-3 py-2 text-xs sm:text-sm text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                      />
                      <span className="text-[10px] text-stone-400 mt-0.5 block">
                        RSVP buttons lock once this deadline is reached.
                      </span>
                    </div>
                  </div>

                  {/* Danger Zone: Cancel Event */}
                  {editingEventId && currentEditingEvent?.status !== 'cancelled' && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 space-y-2">
                      <span className="text-xs font-bold text-rose-800 block">Danger Zone</span>
                      <p className="text-xs text-rose-600">
                        Cancelling will notify registered attendees and freeze further RSVPs.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCancelEvent(editingEventId)}
                        className="rounded-xl text-xs text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Cancel this Event
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* STICKY FOOTER ACTIONS */}
              <div className="sticky -bottom-6 sm:-bottom-8 -mx-6 sm:-mx-8 border-t border-stone-200 bg-stone-50 px-6 py-4 flex items-center justify-between shadow-xs">
                <Button type="button" variant="ghost" size="sm" onClick={handleCloseModal}>
                  Close
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={loading || !title.trim()}
                    className="rounded-xl bg-emerald-800 px-6 text-white hover:bg-emerald-900 shadow-xs font-semibold"
                  >
                    {loading
                      ? 'Saving...'
                      : editingEventId
                      ? 'Save Changes'
                      : 'Publish Event'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
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
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
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
                            ? 'bg-emerald-700 text-white'
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
