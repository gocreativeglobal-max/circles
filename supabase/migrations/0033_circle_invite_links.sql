-- 0033_circle_invite_links.sql
-- Shareable community invite links with configurable roles, expiration, and max uses.

CREATE TABLE IF NOT EXISTS public.circle_invite_links (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  max_uses INT DEFAULT NULL,
  uses_count INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circle_invite_links_code ON public.circle_invite_links(code);
CREATE INDEX IF NOT EXISTS idx_circle_invite_links_circle ON public.circle_invite_links(circle_id);

CREATE TABLE IF NOT EXISTS public.circle_invite_link_uses (
  id UUID PRIMARY KEY,
  invite_link_id UUID NOT NULL REFERENCES public.circle_invite_links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(invite_link_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_invite_link_uses_circle ON public.circle_invite_link_uses(circle_id, user_id);

-- Enable RLS
ALTER TABLE public.circle_invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_invite_link_uses ENABLE ROW LEVEL SECURITY;

-- circle_invite_links policies
DROP POLICY IF EXISTS circle_invite_links_select ON public.circle_invite_links;
CREATE POLICY circle_invite_links_select ON public.circle_invite_links
  FOR SELECT TO authenticated, anon
  USING (
    public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    OR (NOT is_revoked AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR uses_count < max_uses))
  );

DROP POLICY IF EXISTS circle_invite_links_insert ON public.circle_invite_links;
CREATE POLICY circle_invite_links_insert ON public.circle_invite_links
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
      OR public.is_active_circle_member(circle_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS circle_invite_links_update ON public.circle_invite_links;
CREATE POLICY circle_invite_links_update ON public.circle_invite_links
  FOR UPDATE TO authenticated
  USING (
    public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS circle_invite_links_delete ON public.circle_invite_links;
CREATE POLICY circle_invite_links_delete ON public.circle_invite_links
  FOR DELETE TO authenticated
  USING (
    public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
    OR created_by = auth.uid()
  );

-- circle_invite_link_uses policies
DROP POLICY IF EXISTS circle_invite_link_uses_select ON public.circle_invite_link_uses;
CREATE POLICY circle_invite_link_uses_select ON public.circle_invite_link_uses
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  );

DROP POLICY IF EXISTS circle_invite_link_uses_insert ON public.circle_invite_link_uses;
CREATE POLICY circle_invite_link_uses_insert ON public.circle_invite_link_uses
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

-- Allow discovering a Circle when a visitor possesses a valid invite link code
CREATE OR REPLACE FUNCTION public.can_discover_circle(target_circle_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.circles c
    WHERE c.id = target_circle_id
      AND (
        c.visibility IN ('public', 'discoverable_approval')
        OR (check_user_id IS NOT NULL AND c.owner_id = check_user_id)
        OR (check_user_id IS NOT NULL AND public.is_active_circle_member(c.id, check_user_id))
        OR (check_user_id IS NOT NULL AND public.is_platform_admin(check_user_id))
        OR (check_user_id IS NOT NULL AND public.has_pending_circle_invite(c.id, check_user_id))
        OR EXISTS (
          SELECT 1 FROM public.circle_invite_links l
          WHERE l.circle_id = c.id
            AND NOT l.is_revoked
            AND (l.expires_at IS NULL OR l.expires_at > NOW())
        )
      )
  );
$$;
