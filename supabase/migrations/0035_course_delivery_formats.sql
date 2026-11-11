-- 0035_course_delivery_formats.sql
-- Add course delivery format and live cohort metadata to courses

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS course_format TEXT NOT NULL DEFAULT 'video_on_demand'
    CHECK (course_format IN ('video_on_demand', 'live_cohort', 'text_and_labs', 'action_challenge')),
  ADD COLUMN IF NOT EXISTS cohort_meeting_url TEXT,
  ADD COLUMN IF NOT EXISTS cohort_schedule_description TEXT,
  ADD COLUMN IF NOT EXISTS challenge_duration_days INTEGER;
