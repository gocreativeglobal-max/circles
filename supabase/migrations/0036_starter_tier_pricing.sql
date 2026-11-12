-- Migration: 0036_starter_tier_pricing.sql
-- Allow 'starter' tier in public.circles(plan_tier) check constraint

ALTER TABLE public.circles
  DROP CONSTRAINT IF EXISTS circles_plan_tier_check;

ALTER TABLE public.circles
  ADD CONSTRAINT circles_plan_tier_check
  CHECK (plan_tier IN ('free', 'starter', 'pro', 'platinum', 'enterprise'));
