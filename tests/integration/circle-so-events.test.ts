import { describe, expect, it } from 'vitest';
import { registerUser } from '@/features/auth/service';
import { createCircle } from '@/features/circles/service';
import { joinPublicCircle } from '@/features/memberships/service';
import { updateCircleCapability } from '@/features/capabilities/service';
import {
  createCircleEvent,
  listCircleEvents,
  rsvpToCircleEvent,
  updateCircleEvent,
} from '@/features/events/service';

describe('Circle.so Style Events & Live Room Controls', () => {
  it('Creates a rich Circle.so event with topics, host assignment, live room view, and privacy controls', async () => {
    const suffix = Date.now();
    const { user: organizer } = await registerUser({
      email: `circle-so-organizer-${suffix}@example.com`,
      username: `cso_org_${suffix}`,
      displayName: 'Circle Admin',
      password: 'Password123!',
    });

    const { user: designatedHost } = await registerUser({
      email: `circle-so-host-${suffix}@example.com`,
      username: `cso_host_${suffix}`,
      displayName: 'ukana ikpe',
      password: 'Password123!',
    });

    const { user: attendee } = await registerUser({
      email: `circle-so-attendee-${suffix}@example.com`,
      username: `cso_att_${suffix}`,
      displayName: 'Community Member',
      password: 'Password123!',
    });

    const circle = await createCircle(organizer.id, {
      name: `Circle.so Events Circle ${suffix}`,
      visibility: 'public',
      membershipPolicy: 'open',
      category: 'general',
    });

    await joinPublicCircle(designatedHost.id, circle.id);
    await joinPublicCircle(attendee.id, circle.id);
    await updateCircleCapability(organizer.id, circle.id, 'events', true);

    const startsAt = new Date(Date.now() + 86400_000).toISOString();
    const endsAt = new Date(Date.now() + 90000_000).toISOString();

    // 1. Create Event with Circle.so fields matching the user request
    const event = await createCircleEvent(organizer.id, {
      circleId: circle.id,
      title: 'Super sunday',
      description: 'super sunday mastermind & strategy session',
      topics: ['AI', 'Mastermind', 'Sunday'],
      hostId: designatedHost.id,
      startsAt,
      endsAt,
      repeatFrequency: 'weekly',
      locationType: 'live_room',
      liveRoomDefaultView: 'gallery',
      visibility: 'community',
      meetingUrl: 'https://joincircles.online/live/super-sunday',
      venueText: 'Live Room Stage A',
      hostControls: {
        record_live: true,
        auto_post_recording: true,
        mute_on_entry: true,
        hide_attendees: false,
        disable_chat: false,
        disable_live_link_sharing: true,
        hide_location_from_non_attendees: true,
      },
    });

    expect(event.id).toBeDefined();
    expect(event.title).toBe('Super sunday');
    expect(event.topics).toEqual(['AI', 'Mastermind', 'Sunday']);
    expect(event.repeat_frequency).toBe('weekly');
    expect(event.location_type).toBe('live_room');
    expect(event.live_room_default_view).toBe('gallery');
    expect(event.host_controls?.record_live).toBe(true);
    expect(event.host_controls?.mute_on_entry).toBe(true);

    // 2. Query event before RSVP: Attendee has location hidden because hide_location_from_non_attendees is true
    const eventsForAttendee = await listCircleEvents(attendee.id, circle.id);
    const queriedEv = eventsForAttendee.find((e) => e.id === event.id);
    expect(queriedEv).toBeDefined();
    expect(queriedEv?.location_hidden).toBe(true);
    expect(queriedEv?.meeting_url).toBeNull();
    expect(queriedEv?.venue_text).toBe('Location visible to registered attendees');
    expect(queriedEv?.host?.display_name).toBe('ukana ikpe');

    // 3. Attendee RSVPs Going -> Location is unlocked!
    await rsvpToCircleEvent(attendee.id, circle.id, event.id, 'register');
    const unlockedEvents = await listCircleEvents(attendee.id, circle.id);
    const unlockedEv = unlockedEvents.find((e) => e.id === event.id);
    expect(unlockedEv).toBeDefined();
    expect(unlockedEv?.location_hidden).toBe(false);
    expect(unlockedEv?.meeting_url).toBe('https://joincircles.online/live/super-sunday');
    expect(unlockedEv?.viewer_rsvp_status).toBe('going');
    expect(unlockedEv?.going_count).toBe(1);

    // 4. Update Event (e.g. change live room default view to speaker, add another topic)
    const updated = await updateCircleEvent(organizer.id, circle.id, event.id, {
      topics: ['AI', 'Mastermind', 'Sunday', 'Workshop'],
      liveRoomDefaultView: 'speaker',
      hostControls: {
        record_live: true,
        disable_chat: true,
      },
    });

    expect(updated.topics).toEqual(['AI', 'Mastermind', 'Sunday', 'Workshop']);
    expect(updated.live_room_default_view).toBe('speaker');
    expect(updated.host_controls?.disable_chat).toBe(true);
  });
});
