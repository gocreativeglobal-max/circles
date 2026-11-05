-- CIRCLES PLATFORM — PLATFORM FEE TIERS & MONETIZATION
-- Migration: 0023_platform_fee_tiers.sql

-- 1. Add plan tiers and custom fee overrides to circles table
ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_tier IN ('free', 'pro', 'platinum', 'enterprise')),
  ADD COLUMN IF NOT EXISTS custom_platform_fee_percentage NUMERIC(5, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS plan_subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (plan_subscription_status IN ('active', 'past_due', 'cancelled', 'trial')),
  ADD COLUMN IF NOT EXISTS plan_current_period_end TIMESTAMPTZ DEFAULT NULL;

-- 2. Add platform fee tracking columns to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creator_net_cents INTEGER NOT NULL DEFAULT 0;

-- 3. Create platform revenue ledger for financial reporting and audit
CREATE TABLE IF NOT EXISTS public.platform_revenue_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  plan_tier TEXT NOT NULL,
  gross_amount_cents INTEGER NOT NULL,
  platform_fee_percentage NUMERIC(5, 2) NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  creator_net_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimize lookup indices
CREATE INDEX IF NOT EXISTS idx_platform_rev_circle_created
  ON public.platform_revenue_ledger(circle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_circles_plan_tier
  ON public.circles(plan_tier);

-- Enable RLS on platform_revenue_ledger
ALTER TABLE public.platform_revenue_ledger ENABLE ROW LEVEL SECURITY;

-- Circle staff can view their circle's platform fee deductions
DROP POLICY IF EXISTS platform_rev_circle_staff_read ON public.platform_revenue_ledger;
CREATE POLICY platform_rev_circle_staff_read ON public.platform_revenue_ledger
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.circle_memberships cm
      WHERE cm.circle_id = platform_revenue_ledger.circle_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
        AND cm.status = 'active'
    )
  );
