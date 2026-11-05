-- ============================================================================
-- Migration 0020: Lesson Image & Thumbnail Support
-- ============================================================================

ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT CHECK (thumbnail_url IS NULL OR char_length(thumbnail_url) <= 2048);
