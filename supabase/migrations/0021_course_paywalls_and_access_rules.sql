-- CIRCLES PLATFORM — COURSE PAYWALLS & MONETIZATION
-- Migration: 0021_course_paywalls_and_access_rules.sql

-- 1. Update courses access_rule check constraint to support 'paywall'
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_access_rule_check;
ALTER TABLE public.courses ADD CONSTRAINT courses_access_rule_check
  CHECK (access_rule IN ('open', 'members_only', 'paywall', 'min_level', 'staff_only'));

-- 2. Optimize lookup index for plan entitlements linked to courses
CREATE INDEX IF NOT EXISTS idx_plan_entitlements_course_target
  ON public.pricing_plan_entitlements(circle_id, target_type, target_id)
  WHERE target_type = 'course_access';

-- 3. Optimize lookup index for member course entitlements
CREATE INDEX IF NOT EXISTS idx_member_entitlements_course_access
  ON public.member_entitlements(circle_id, user_id, target_type, target_id, status)
  WHERE target_type = 'course_access';
