-- Migration 0027: Circle.so-Style Rich Events, Live Rooms, Host Controls & Topics
-- Adds topics, custom host assignment, repeat rules, live room views, and privacy/host controls.

-- 1. Alter location_type check constraint to support native 'live_room' and 'zoom'
ALTER TABLE public.circle_events
  DROP CONSTRAINT IF EXISTS circle_events_location_type_check;

ALTER TABLE public.circle_events
  ADD CONSTRAINT circle_events_location_type_check
  CHECK (location_type IN ('in_person', 'online', 'hybrid', 'live_room', 'zoom'));

-- 2. Add Circle.so rich event attributes
ALTER TABLE public.circle_events
  ADD COLUMN IF NOT EXISTS topics TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS host_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS repeat_frequency TEXT NOT NULL DEFAULT 'none'
    CHECK (repeat_frequency IN ('none', 'weekly', 'biweekly', 'monthly')),
  ADD COLUMN IF NOT EXISTS live_room_default_view TEXT NOT NULL DEFAULT 'gallery'
    CHECK (live_room_default_view IN ('gallery', 'speaker')),
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'community'
    CHECK (visibility IN ('community', 'space_members', 'secret')),
  ADD COLUMN IF NOT EXISTS host_controls JSONB NOT NULL DEFAULT '{
    "record_live": false,
    "auto_post_recording": false,
    "mute_on_entry": false,
    "hide_attendees": false,
    "disable_chat": false,
    "disable_live_link_sharing": false,
    "hide_location_from_non_attendees": false
  }'::jsonb;

-- 3. Indexes for fast filtering by host, space, and repeat frequency
CREATE INDEX IF NOT EXISTS idx_circle_events_host ON public.circle_events(host_id) WHERE host_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_circle_events_space ON public.circle_events(space_id) WHERE space_id IS NOT NULL;

COMMENT ON COLUMN public.circle_events.topics IS 'Array of up to 5 topic tags associated with this event.';
COMMENT ON COLUMN public.circle_events.host_id IS 'Designated event host profile (defaults to event creator).';
COMMENT ON COLUMN public.circle_events.host_controls IS 'Circle.so style host toggles: recording, mute on entry, hidden attendees, chat controls, and attendee-only location.';
