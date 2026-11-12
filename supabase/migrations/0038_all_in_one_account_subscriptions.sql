-- Migration: 0038_all_in_one_account_subscriptions.sql
-- Enables All-in-One Account-Wide Subscriptions for Creators

-- 1. Add subscription columns to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'starter', 'pro', 'platinum', 'enterprise')),
  ADD COLUMN IF NOT EXISTS plan_subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (plan_subscription_status IN ('active', 'past_due', 'cancelled', 'trial')),
  ADD COLUMN IF NOT EXISTS plan_current_period_end TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_max_communities INTEGER DEFAULT NULL;

-- 2. Index for subscription lookups
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier
  ON public.profiles(subscription_tier);

-- 3. Allow circle_id to be nullable in platform_revenue_ledger and invoices for account-wide subscriptions
ALTER TABLE public.platform_revenue_ledger
  ALTER COLUMN circle_id DROP NOT NULL;

ALTER TABLE public.invoices
  ALTER COLUMN circle_id DROP NOT NULL;

-- 4. Add user_id column to platform_revenue_ledger for account-level financial ledger tracking
ALTER TABLE public.platform_revenue_ledger
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_platform_rev_user
  ON public.platform_revenue_ledger(user_id, created_at DESC);
