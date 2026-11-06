-- Migration 0024: Add optional link_url to job_opportunities
ALTER TABLE public.job_opportunities
  ADD COLUMN IF NOT EXISTS link_url TEXT;

COMMENT ON COLUMN public.job_opportunities.link_url IS 'Optional external application, company, or project link for the opportunity.';
