-- ============================================================================
-- Migration 0018: Event Cover Image Support
-- ============================================================================

ALTER TABLE public.circle_events
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT CHECK (cover_image_url IS NULL OR char_length(cover_image_url) <= 2048);
