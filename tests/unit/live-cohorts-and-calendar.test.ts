import { describe, it, expect } from 'vitest';
import {
  detectMeetingPlatform,
  generateGoogleCalendarUrl,
  generateIcsFileContent,
  calculateLiveSessionStatus,
  formatWeeklySchedule,
  parseDaysFromSchedule,
} from '../../src/lib/courses/cohort-helpers';

describe('Live Cohorts, Meeting Platform Detection & Calendar Sync', () => {
  describe('Meeting Platform Detection', () => {
    it('detects Google Meet URLs correctly', () => {
      const res = detectMeetingPlatform('https://meet.google.com/abc-defg-hij');
      expect(res.platform).toBe('google_meet');
      expect(res.name).toBe('Google Meet');
      expect(res.badgeBg).toContain('emerald');
    });

    it('detects Zoom URLs correctly', () => {
      const res = detectMeetingPlatform('https://zoom.us/j/9876543210');
      expect(res.platform).toBe('zoom');
      expect(res.name).toBe('Zoom Meeting');
      expect(res.badgeBg).toContain('blue');
    });

    it('detects Microsoft Teams URLs correctly', () => {
      const res = detectMeetingPlatform('https://teams.microsoft.com/l/meetup-join/19%3ameeting');
      expect(res.platform).toBe('microsoft_teams');
      expect(res.name).toBe('Microsoft Teams');
    });

    it('detects YouTube Live stream URLs', () => {
      const res = detectMeetingPlatform('https://youtube.com/live/xyz123');
      expect(res.platform).toBe('youtube_live');
      expect(res.name).toBe('YouTube Live');
    });

    it('handles custom video URLs gracefully', () => {
      const res = detectMeetingPlatform('https://custom-classroom.stream/room/123');
      expect(res.platform).toBe('custom');
      expect(res.name).toBe('Live Classroom');
    });

    it('handles empty or missing URLs safely', () => {
      const res = detectMeetingPlatform(null);
      expect(res.platform).toBe('custom');
      expect(res.name).toBe('Live Video Link');
    });
  });

  describe('Google Calendar URL Generator', () => {
    it('generates a valid, encoded Google Calendar template URL', () => {
      const url = generateGoogleCalendarUrl({
        title: 'Fullstack Mastery Cohort 1',
        description: 'Session 1: Advanced TypeScript Architecture',
        startDate: '2026-11-20T18:00:00Z',
        endDate: '2026-11-20T19:30:00Z',
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
      });

      expect(url).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE');
      expect(url).toContain('text=Fullstack%20Mastery%20Cohort%201');
      expect(url).toContain('location=https%3A%2F%2Fmeet.google.com%2Fabc-defg-hij');
      expect(url).toContain('20261120T180000Z/20261120T193000Z');
    });
  });

  describe('iCalendar (.ics) Generator', () => {
    it('generates standard RFC 5545 iCalendar content', () => {
      const ics = generateIcsFileContent({
        title: 'Design Systems Workshop',
        description: 'Building accessible design tokens with Tailwind',
        startDate: '2026-12-01T14:00:00Z',
        endDate: '2026-12-01T15:30:00Z',
        meetingUrl: 'https://meet.google.com/xyz-abcd-efg',
      });

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('SUMMARY:Design Systems Workshop');
      expect(ics).toContain('LOCATION:https://meet.google.com/xyz-abcd-efg');
      expect(ics).toContain('DTSTART:20261201T140000Z');
      expect(ics).toContain('DTEND:20261201T153000Z');
      expect(ics).toContain('END:VEVENT');
      expect(ics).toContain('END:VCALENDAR');
    });
  });

  describe('Live Session Real-time State & Countdown Calculator (Luma-Style)', () => {
    it('calculates "live" state when current time is during the scheduled session', () => {
      const now = new Date('2026-11-15T18:30:00Z');
      const status = calculateLiveSessionStatus({
        startDate: '2026-11-15T18:00:00Z',
        endDate: '2026-11-15T19:30:00Z',
        now,
      });

      expect(status.badgeState).toBe('live');
      expect(status.isLiveNow).toBe(true);
      expect(status.isDoorsOpen).toBe(true);
      expect(status.countdownText).toContain('Live now');
    });

    it('calculates "doors_open" state within 30 minutes before class start', () => {
      const now = new Date('2026-11-15T17:45:00Z'); // 15 mins before 18:00
      const status = calculateLiveSessionStatus({
        startDate: '2026-11-15T18:00:00Z',
        endDate: '2026-11-15T19:30:00Z',
        now,
      });

      expect(status.badgeState).toBe('doors_open');
      expect(status.isLiveNow).toBe(false);
      expect(status.isDoorsOpen).toBe(true);
      expect(status.countdownText).toContain('Doors open');
      expect(status.countdownText).toContain('15m');
    });

    it('calculates "upcoming" countdown for future dates', () => {
      const now = new Date('2026-11-13T18:00:00Z');
      const status = calculateLiveSessionStatus({
        startDate: '2026-11-15T18:00:00Z',
        endDate: '2026-11-15T19:30:00Z',
        now,
      });

      expect(status.badgeState).toBe('upcoming');
      expect(status.isLiveNow).toBe(false);
      expect(status.isDoorsOpen).toBe(false);
      expect(status.countdownText).toBe('Starts in 2 days');
    });

    it('calculates "ended" state for past sessions', () => {
      const now = new Date('2026-11-16T10:00:00Z');
      const status = calculateLiveSessionStatus({
        startDate: '2026-11-15T18:00:00Z',
        endDate: '2026-11-15T19:30:00Z',
        now,
      });

      expect(status.badgeState).toBe('ended');
      expect(status.isLiveNow).toBe(false);
      expect(status.isDoorsOpen).toBe(false);
      expect(status.countdownText).toBe('Session concluded');
    });

    it('handles unscheduled courses gracefully', () => {
      const status = calculateLiveSessionStatus({
        startDate: null,
        scheduleDescription: 'Every Tuesday & Thursday at 6pm EST',
      });

      expect(status.badgeState).toBe('upcoming');
      expect(status.isLiveNow).toBe(false);
      expect(status.countdownText).toBe('Every Tuesday & Thursday at 6pm EST');
    });
  });

  describe('Schedule Helpers', () => {
    it('parses days of week from schedule descriptions', () => {
      const days = parseDaysFromSchedule('Every Mon, Wed and Fri at 5 PM');
      expect(days).toEqual(['mon', 'wed', 'fri']);
    });

    it('formats weekly recurring schedules into human-readable strings', () => {
      const formatted = formatWeeklySchedule({
        selectedDays: ['mon', 'wed', 'fri'],
        time: '18:00',
        timezone: 'EST',
      });
      expect(formatted).toBe('Every Mon, Wed, Fri at 6:00 PM EST');
    });
  });
});
