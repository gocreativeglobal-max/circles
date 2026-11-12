/**
 * Helper utilities for Live Cohort courses on Circles
 */

export interface MeetingPlatformInfo {
  platform: 'zoom' | 'google_meet' | 'microsoft_teams' | 'youtube_live' | 'custom';
  name: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  defaultPlaceholder: string;
}

export function detectMeetingPlatform(url?: string | null): MeetingPlatformInfo {
  if (!url || !url.trim()) {
    return {
      platform: 'custom',
      name: 'Live Video Link',
      badgeBg: 'bg-stone-100',
      badgeText: 'text-stone-700',
      badgeBorder: 'border-stone-200',
      defaultPlaceholder: 'https://zoom.us/j/... or https://meet.google.com/...',
    };
  }

  const lower = url.toLowerCase().trim();

  if (lower.includes('zoom.us')) {
    return {
      platform: 'zoom',
      name: 'Zoom Meeting',
      badgeBg: 'bg-blue-600',
      badgeText: 'text-white',
      badgeBorder: 'border-blue-700',
      defaultPlaceholder: 'https://zoom.us/j/123456789',
    };
  }

  if (lower.includes('meet.google.com')) {
    return {
      platform: 'google_meet',
      name: 'Google Meet',
      badgeBg: 'bg-emerald-600',
      badgeText: 'text-white',
      badgeBorder: 'border-emerald-700',
      defaultPlaceholder: 'https://meet.google.com/abc-defg-hij',
    };
  }

  if (lower.includes('teams.microsoft.com') || lower.includes('teams.live.com')) {
    return {
      platform: 'microsoft_teams',
      name: 'Microsoft Teams',
      badgeBg: 'bg-indigo-600',
      badgeText: 'text-white',
      badgeBorder: 'border-indigo-700',
      defaultPlaceholder: 'https://teams.microsoft.com/l/meetup-join/...',
    };
  }

  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return {
      platform: 'youtube_live',
      name: 'YouTube Live',
      badgeBg: 'bg-red-600',
      badgeText: 'text-white',
      badgeBorder: 'border-red-700',
      defaultPlaceholder: 'https://youtube.com/live/...',
    };
  }

  return {
    platform: 'custom',
    name: 'Live Classroom',
    badgeBg: 'bg-stone-900',
    badgeText: 'text-white',
    badgeBorder: 'border-stone-950',
    defaultPlaceholder: 'https://your-classroom-link.com/...',
  };
}

export function formatCohortDateRange(
  startDate?: string | null,
  endDate?: string | null
): string | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return null;

  const startFormatted = start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (!endDate) {
    return `Starts ${startFormatted}`;
  }

  const end = new Date(endDate);
  if (isNaN(end.getTime())) return `Starts ${startFormatted}`;

  const endFormatted = end.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `${startFormatted} – ${endFormatted}`;
}

export function generateGoogleCalendarUrl({
  title,
  description,
  startDate,
  endDate,
  meetingUrl,
}: {
  title: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  meetingUrl?: string | null;
}): string {
  const start = startDate ? new Date(startDate) : new Date();
  const end = endDate ? new Date(endDate) : new Date(start.getTime() + 60 * 60 * 1000);

  const formatIsoForGcal = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const datesParam = `${formatIsoForGcal(start)}/${formatIsoForGcal(end)}`;
  const textParam = encodeURIComponent(title);
  const detailsParam = encodeURIComponent(
    `${description || 'Live cohort session on Circles.'}\n\nJoin Live Room: ${meetingUrl || ''}`
  );
  const locationParam = encodeURIComponent(meetingUrl || 'Live Online Classroom');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${textParam}&dates=${datesParam}&details=${detailsParam}&location=${locationParam}`;
}

export interface DayOfWeekOption {
  key: string;
  short: string;
  label: string;
  letter: string;
}

export const DAYS_OF_WEEK: DayOfWeekOption[] = [
  { key: 'mon', short: 'Mon', label: 'Monday', letter: 'M' },
  { key: 'tue', short: 'Tue', label: 'Tuesday', letter: 'T' },
  { key: 'wed', short: 'Wed', label: 'Wednesday', letter: 'W' },
  { key: 'thu', short: 'Thu', label: 'Thursday', letter: 'T' },
  { key: 'fri', short: 'Fri', label: 'Friday', letter: 'F' },
  { key: 'sat', short: 'Sat', label: 'Saturday', letter: 'S' },
  { key: 'sun', short: 'Sun', label: 'Sunday', letter: 'S' },
];

export function parseDaysFromSchedule(scheduleDescription?: string | null): string[] {
  if (!scheduleDescription) return [];
  const lower = scheduleDescription.toLowerCase();
  const matched: string[] = [];

  if (lower.includes('everyday') || lower.includes('every day') || lower.includes('daily')) {
    return DAYS_OF_WEEK.map((d) => d.key);
  }
  if (lower.includes('weekday') || lower.includes('mon-fri') || lower.includes('mon – fri')) {
    return ['mon', 'tue', 'wed', 'thu', 'fri'];
  }
  if (lower.includes('weekend')) {
    return ['sat', 'sun'];
  }

  DAYS_OF_WEEK.forEach((d) => {
    if (lower.includes(d.key) || lower.includes(d.label.toLowerCase())) {
      matched.push(d.key);
    }
  });

  return matched;
}

export function formatTime12h(time24?: string): string {
  if (!time24) return '';
  // If already contains am/pm, return as is
  if (/am|pm/i.test(time24)) return time24;
  const parts = time24.split(':');
  if (parts.length < 2) return time24;
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return time24;
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes} ${period}`;
}

export function formatWeeklySchedule({
  selectedDays,
  time,
  timezone,
}: {
  selectedDays: string[];
  time?: string;
  timezone?: string;
}): string {
  if (selectedDays.length === 0) return '';

  let daysLabel = '';
  if (selectedDays.length === 7) {
    daysLabel = 'Daily (Every day)';
  } else if (
    selectedDays.length === 5 &&
    ['mon', 'tue', 'wed', 'thu', 'fri'].every((d) => selectedDays.includes(d))
  ) {
    daysLabel = 'Every Weekday (Mon–Fri)';
  } else if (
    selectedDays.length === 2 &&
    selectedDays.includes('sat') &&
    selectedDays.includes('sun')
  ) {
    daysLabel = 'Weekends (Sat & Sun)';
  } else {
    const sorted = DAYS_OF_WEEK.filter((d) => selectedDays.includes(d.key)).map((d) => d.short);
    daysLabel = `Every ${sorted.join(', ')}`;
  }

  const timeFormatted = time ? formatTime12h(time) : '';
  const timePart = timeFormatted ? ` at ${timeFormatted}` : '';
  const tzPart = timezone ? ` ${timezone}` : '';

  return `${daysLabel}${timePart}${tzPart}`.trim();
}

