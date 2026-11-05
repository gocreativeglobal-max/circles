-- ============================================================================
-- Migration 0019: Course Pacing Formats & Circle.so Course Studio Architecture
-- ============================================================================

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS pacing_format TEXT NOT NULL DEFAULT 'self_paced'
    CHECK (pacing_format IN ('self_paced', 'structured', 'scheduled')),
  ADD COLUMN IF NOT EXISTS schedule_type TEXT NOT NULL DEFAULT 'relative_drip'
    CHECK (schedule_type IN ('relative_drip', 'calendar_date')),
  ADD COLUMN IF NOT EXISTS cohort_start_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cohort_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS require_sequential_completion BOOLEAN NOT NULL DEFAULT false;

-- Permit instructors to view enrollments and completions for courses they teach
DROP POLICY IF EXISTS course_enrollments_select ON public.course_enrollments;
CREATE POLICY course_enrollments_select ON public.course_enrollments
  FOR SELECT TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      student_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_enrollments.course_id
          AND c.circle_id = course_enrollments.circle_id
          AND c.instructor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS course_completions_select ON public.course_lesson_completions;
CREATE POLICY course_completions_select ON public.course_lesson_completions
  FOR SELECT TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'learning_resources')
    AND (
      user_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
      OR EXISTS (
        SELECT 1 FROM public.courses c
        WHERE c.id = course_lesson_completions.course_id
          AND c.circle_id = course_lesson_completions.circle_id
          AND c.instructor_id = auth.uid()
      )
    )
  );
