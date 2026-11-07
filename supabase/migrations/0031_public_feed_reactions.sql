-- Allow any authenticated user who can read a Circle's content (e.g., Public Circles)
-- to react/like published posts, matching saved_items_all.
DROP POLICY IF EXISTS reactions_insert ON public.reactions;
CREATE POLICY reactions_insert ON public.reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'discussions')
  );
