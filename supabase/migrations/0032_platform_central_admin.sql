-- ============================================================================
-- Migration 0032: Circles Central Admin & Global Feature Flags
-- Stores platform-wide settings and feature flags (with custom_features_builder
-- disabled by default so Central Admin can enable it later).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_settings_select ON public.platform_settings;
CREATE POLICY platform_settings_select ON public.platform_settings
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS platform_settings_write ON public.platform_settings;
CREATE POLICY platform_settings_write ON public.platform_settings
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;

INSERT INTO public.platform_settings (key, value)
VALUES (
  'feature_flags',
  '{
    "custom_features_builder": false,
    "global_public_feed": true,
    "marketplace_checkout": true,
    "causes_crowdfunding": true,
    "allow_circle_creation": true
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
