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
