-- ============================================================================
-- Migration 0037: Live Cohort Attendance & Gated Session Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.course_live_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT course_live_attendance_unique_session UNIQUE (course_id, user_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_course_live_attendance_course_date
    ON public.course_live_attendance (course_id, session_date);

CREATE INDEX IF NOT EXISTS idx_course_live_attendance_user
    ON public.course_live_attendance (user_id);

CREATE INDEX IF NOT EXISTS idx_course_live_attendance_circle
    ON public.course_live_attendance (circle_id);

-- Enable RLS
ALTER TABLE public.course_live_attendance ENABLE ROW LEVEL SECURITY;

-- 1. Circle staff (owner, admin, moderator) can view all attendance records in their circle
CREATE POLICY "Circle staff can view live attendance"
    ON public.course_live_attendance
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.circle_memberships cm
            WHERE cm.circle_id = course_live_attendance.circle_id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('owner', 'admin', 'moderator')
              AND cm.status = 'active'
        )
    );

-- 2. Students can view their own attendance records
CREATE POLICY "Users can view their own live attendance"
    ON public.course_live_attendance
    FOR SELECT
    USING (user_id = auth.uid());

-- 3. Authenticated enrolled users can insert their attendance
CREATE POLICY "Enrolled students can record attendance"
    ON public.course_live_attendance
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND (
            EXISTS (
                SELECT 1 FROM public.course_enrollments ce
                WHERE ce.course_id = course_live_attendance.course_id
                  AND ce.student_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM public.circle_memberships cm
                WHERE cm.circle_id = course_live_attendance.circle_id
                  AND cm.user_id = auth.uid()
                  AND cm.status = 'active'
            )
        )
    );

-- 4. Role table grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.course_live_attendance TO anon, authenticated, service_role;

-- 5. Expand member_xp_points activity_type check to include live_cohort_attendance
ALTER TABLE public.member_xp_points
  DROP CONSTRAINT IF EXISTS member_xp_points_activity_type_check;

ALTER TABLE public.member_xp_points
  ADD CONSTRAINT member_xp_points_activity_type_check
  CHECK (activity_type IN (
    'lesson_completed',
    'assignment_submitted',
    'assignment_approved',
    'lesson_comment',
    'discussion_post',
    'live_cohort_attendance'
  ));
