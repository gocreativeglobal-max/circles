-- 0041_course_requirements.sql
-- Add requirements array column to courses table

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS requirements JSONB NOT NULL DEFAULT '[]'::jsonb;
