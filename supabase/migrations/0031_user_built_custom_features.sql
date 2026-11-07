-- ============================================================================
-- Migration 0031: User-Built Custom Features (No-Code Modules & Mini-Apps)
-- Enables Circle Admins and Members to build, propose, share, and use custom
-- features (Card directories, Walls, Kanban boards, and Embedded Mini-Apps)
-- with custom form fields, reactions, and optional Member Wallet payments/tips.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.circle_custom_modules (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug TEXT NOT NULL CHECK (char_length(slug) BETWEEN 1 AND 64),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  icon TEXT NOT NULL DEFAULT 'sparkles',
  layout_type TEXT NOT NULL DEFAULT 'cards' CHECK (layout_type IN ('cards', 'wall', 'board', 'embed')),
  embed_url TEXT,
  fields_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  board_columns JSONB NOT NULL DEFAULT '["Open", "In Progress", "Completed"]'::jsonb,
  reaction_label TEXT NOT NULL DEFAULT 'Upvote' CHECK (char_length(reaction_label) BETWEEN 1 AND 40),
  enable_payments BOOLEAN NOT NULL DEFAULT false,
  payment_label TEXT NOT NULL DEFAULT 'Support / Tip' CHECK (char_length(payment_label) BETWEEN 1 AND 40),
  default_currency TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(default_currency) BETWEEN 3 AND 4),
  posting_policy TEXT NOT NULL DEFAULT 'all_members' CHECK (posting_policy IN ('all_members', 'admins_only')),
  is_shared_template BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending_approval', 'active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (circle_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_circle_custom_modules_circle ON public.circle_custom_modules(circle_id, status);
CREATE INDEX IF NOT EXISTS idx_circle_custom_modules_shared ON public.circle_custom_modules(is_shared_template);

CREATE TABLE IF NOT EXISTS public.circle_custom_module_entries (
  id UUID PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.circle_custom_modules(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  body TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 8000),
  image_url TEXT,
  board_status TEXT NOT NULL DEFAULT 'Open',
  field_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_amount NUMERIC(12, 2),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency) BETWEEN 3 AND 4),
  upvoter_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  tips_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circle_custom_module_entries_module ON public.circle_custom_module_entries(module_id, created_at DESC);

ALTER TABLE public.circle_custom_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_custom_module_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS circle_custom_modules_select ON public.circle_custom_modules;
CREATE POLICY circle_custom_modules_select ON public.circle_custom_modules
  FOR SELECT TO anon, authenticated
  USING (
    is_shared_template = true
    OR public.can_read_circle_content(circle_id, auth.uid())
  );

DROP POLICY IF EXISTS circle_custom_modules_insert ON public.circle_custom_modules;
CREATE POLICY circle_custom_modules_insert ON public.circle_custom_modules
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
  );

DROP POLICY IF EXISTS circle_custom_modules_update ON public.circle_custom_modules;
CREATE POLICY circle_custom_modules_update ON public.circle_custom_modules
  FOR UPDATE TO authenticated
  USING (
    creator_id = auth.uid()
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
  )
  WITH CHECK (
    creator_id = auth.uid()
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS circle_custom_modules_delete ON public.circle_custom_modules;
CREATE POLICY circle_custom_modules_delete ON public.circle_custom_modules
  FOR DELETE TO authenticated
  USING (
    creator_id = auth.uid()
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS circle_custom_module_entries_select ON public.circle_custom_module_entries;
CREATE POLICY circle_custom_module_entries_select ON public.circle_custom_module_entries
  FOR SELECT TO anon, authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
  );

DROP POLICY IF EXISTS circle_custom_module_entries_insert ON public.circle_custom_module_entries;
CREATE POLICY circle_custom_module_entries_insert ON public.circle_custom_module_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
  );

DROP POLICY IF EXISTS circle_custom_module_entries_update ON public.circle_custom_module_entries;
CREATE POLICY circle_custom_module_entries_update ON public.circle_custom_module_entries
  FOR UPDATE TO authenticated
  USING (
    public.can_read_circle_content(circle_id, auth.uid())
  )
  WITH CHECK (
    public.can_read_circle_content(circle_id, auth.uid())
  );

DROP POLICY IF EXISTS circle_custom_module_entries_delete ON public.circle_custom_module_entries;
CREATE POLICY circle_custom_module_entries_delete ON public.circle_custom_module_entries
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_circle_staff_role(circle_id, auth.uid(), 'moderator')
  );

GRANT SELECT ON public.circle_custom_modules TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.circle_custom_modules TO authenticated;
GRANT SELECT ON public.circle_custom_module_entries TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.circle_custom_module_entries TO authenticated;
