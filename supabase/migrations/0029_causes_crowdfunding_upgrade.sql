-- ============================================================================
-- Migration 0029: Causes & Crowdfunding Upgrade
-- Adds support for:
-- 1. Both Admin (Official) and Member-Submitted Causes (with optional approval workflow)
-- 2. Multi-currency support (3-4 char codes including NGN, KES, GHS, ZAR, USD, USDC, etc.)
-- 3. On-platform Donations from both Members & Non-Members + Anonymous Donations
-- 4. Automatic routing of funds: Official Causes -> Circle Treasury, Member Causes -> Member Wallet
-- ============================================================================

ALTER TABLE public.fundraising_campaigns
  DROP CONSTRAINT IF EXISTS fundraising_campaigns_currency_check,
  DROP CONSTRAINT IF EXISTS fundraising_campaigns_status_check;

ALTER TABLE public.fundraising_campaigns
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'community_project',
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS cause_type TEXT NOT NULL DEFAULT 'official' CHECK (cause_type IN ('official', 'member')),
  ADD COLUMN IF NOT EXISTS beneficiary_name TEXT,
  ADD COLUMN IF NOT EXISTS milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updates JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD CONSTRAINT fundraising_campaigns_currency_check CHECK (char_length(currency) BETWEEN 3 AND 4),
  ADD CONSTRAINT fundraising_campaigns_status_check CHECK (status IN ('pending_approval', 'active', 'completed', 'closed', 'rejected'));

ALTER TABLE public.fundraising_pledges
  ALTER COLUMN pledger_id DROP NOT NULL;

ALTER TABLE public.fundraising_pledges
  ADD COLUMN IF NOT EXISTS donor_name TEXT,
  ADD COLUMN IF NOT EXISTS donor_email TEXT,
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'card',
  ADD COLUMN IF NOT EXISTS platform_fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Update RLS policies on fundraising_campaigns so active members can submit causes
DROP POLICY IF EXISTS fundraising_campaigns_insert ON public.fundraising_campaigns;
CREATE POLICY fundraising_campaigns_insert ON public.fundraising_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND public.is_active_circle_member(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'fundraising_causes')
  );

DROP POLICY IF EXISTS fundraising_campaigns_update ON public.fundraising_campaigns;
CREATE POLICY fundraising_campaigns_update ON public.fundraising_campaigns
  FOR UPDATE TO authenticated
  USING (
    public.is_capability_enabled(circle_id, 'fundraising_causes')
    AND (
      creator_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
    )
  )
  WITH CHECK (
    public.is_capability_enabled(circle_id, 'fundraising_causes')
    AND (
      creator_id = auth.uid()
      OR public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
    )
  );

-- Update RLS policies on fundraising_pledges so both members and non-members can donate to readable causes
DROP POLICY IF EXISTS fundraising_pledges_insert ON public.fundraising_pledges;
CREATE POLICY fundraising_pledges_insert ON public.fundraising_pledges
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.can_read_circle_content(circle_id, auth.uid())
    AND public.is_capability_enabled(circle_id, 'fundraising_causes')
    AND (pledger_id IS NULL OR pledger_id = auth.uid())
  );

GRANT SELECT, INSERT ON public.fundraising_pledges TO anon, authenticated;
