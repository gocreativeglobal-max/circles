-- 0040_live_cohort_capacity_and_replays.sql
-- Add capacity limit (seat caps) to courses, dedicated replay recording slots to course lessons, and enrollment update policy

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS max_seats INTEGER CHECK (max_seats IS NULL OR max_seats >= 1);

ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS replay_url TEXT;

DROP POLICY IF EXISTS course_enrollments_update ON public.course_enrollments;
CREATE POLICY course_enrollments_update ON public.course_enrollments
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());
