-- 0034_course_reviews_and_ratings.sql
-- Real Course Reviews, Star Ratings (1-5), and Feedback

CREATE TABLE IF NOT EXISTS public.course_reviews (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_course_reviews_course_user UNIQUE (course_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_course_reviews_course_id ON public.course_reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_course_reviews_circle_id ON public.course_reviews(circle_id);
CREATE INDEX IF NOT EXISTS idx_course_reviews_user_id ON public.course_reviews(user_id);

-- Permissions & Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.course_reviews TO anon, authenticated, service_role;

-- Enable Row Level Security
ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_reviews FORCE ROW LEVEL SECURITY;

-- Select Policy: Authenticated users & guests can read reviews if circle is readable
DROP POLICY IF EXISTS course_reviews_select ON public.course_reviews;
CREATE POLICY course_reviews_select ON public.course_reviews
  FOR SELECT TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.circles c
      WHERE c.id = public.course_reviews.circle_id
        AND (
          c.visibility = 'public'
          OR public.is_active_circle_member(c.id, auth.uid())
          OR public.has_circle_staff_role(c.id, auth.uid(), 'moderator')
        )
    )
  );

-- Insert Policy: Enrolled students or active circle members can submit a review
DROP POLICY IF EXISTS course_reviews_insert ON public.course_reviews;
CREATE POLICY course_reviews_insert ON public.course_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      public.is_active_circle_member(circle_id, auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.course_enrollments e
        WHERE e.course_id = public.course_reviews.course_id
          AND e.student_id = auth.uid()
      )
    )
  );

-- Update Policy: Users can update their own review
DROP POLICY IF EXISTS course_reviews_update ON public.course_reviews;
CREATE POLICY course_reviews_update ON public.course_reviews
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Delete Policy: Author or circle staff can delete review
DROP POLICY IF EXISTS course_reviews_delete ON public.course_reviews;
CREATE POLICY course_reviews_delete ON public.course_reviews
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  );

-- Helper function to return total enrolled student count without exposing private enrollment rows
CREATE OR REPLACE FUNCTION public.get_course_enrolled_count(p_course_id UUID, p_circle_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.course_enrollments
  WHERE course_id = p_course_id AND circle_id = p_circle_id;
  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_course_enrolled_count(UUID, UUID) TO anon, authenticated, service_role;

