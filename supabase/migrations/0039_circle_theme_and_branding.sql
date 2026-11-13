-- Migration: 0039_circle_theme_and_branding.sql
-- Enables custom community theme colors, branding presets, and layout appearance for all communities

ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS theme_settings JSONB NOT NULL DEFAULT '{"primaryColor":"#18181b","accentColor":"#2563eb","brandMode":"system","borderRadius":"md"}'::jsonb;
