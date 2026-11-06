-- ============================================================================
-- Migration 0025: Universal & Customizable Listing Engine
-- ============================================================================

-- 1. Relax listing_type constraint to allow any dynamic type or category
ALTER TABLE public.marketplace_listings 
  DROP CONSTRAINT IF EXISTS marketplace_listings_listing_type_check;

ALTER TABLE public.marketplace_listings 
  ADD CONSTRAINT marketplace_listings_listing_type_check 
  CHECK (char_length(listing_type) BETWEEN 1 AND 40);

-- 2. Add Universal Listing columns to marketplace_listings
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS transaction_type TEXT NOT NULL DEFAULT 'fixed'
    CHECK (transaction_type IN ('free', 'fixed', 'rate', 'range', 'negotiable')),
  ADD COLUMN IF NOT EXISTS rate_interval TEXT
    CHECK (rate_interval IS NULL OR rate_interval IN ('hourly', 'daily', 'weekly', 'monthly', 'annually')),
  ADD COLUMN IF NOT EXISTS price_min NUMERIC(12, 2)
    CHECK (price_min IS NULL OR price_min >= 0),
  ADD COLUMN IF NOT EXISTS price_max NUMERIC(12, 2)
    CHECK (price_max IS NULL OR price_max >= 0),
  ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT 'inquiry'
    CHECK (action_type IN ('inquiry', 'booking', 'application', 'link')),
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 3. Backfill existing marketplace listings with unified transaction and action types
UPDATE public.marketplace_listings
SET 
  transaction_type = CASE 
    WHEN pricing_unit = 'free' THEN 'free'
    WHEN pricing_unit = 'negotiable' THEN 'negotiable'
    WHEN pricing_unit IN ('hourly', 'daily', 'monthly') THEN 'rate'
    ELSE 'fixed'
  END,
  rate_interval = CASE 
    WHEN pricing_unit IN ('hourly', 'daily', 'monthly') THEN pricing_unit
    ELSE NULL
  END,
  action_type = CASE 
    WHEN listing_type IN ('service', 'rental') THEN 'booking'
    ELSE 'inquiry'
  END
WHERE transaction_type = 'fixed' AND pricing_unit <> 'fixed';

-- 4. Migrate any existing job opportunities into the universal listings table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_opportunities') THEN
    INSERT INTO public.marketplace_listings (
      id,
      circle_id,
      seller_id,
      listing_type,
      category,
      title,
      description,
      price_amount,
      price_currency,
      pricing_unit,
      location,
      contact_preference,
      image_urls,
      status,
      transaction_type,
      action_type,
      action_url,
      custom_fields,
      tags,
      created_at,
      updated_at
    )
    SELECT
      j.id,
      j.circle_id,
      j.poster_id,
      'job',
      COALESCE(NULLIF(j.opportunity_type, ''), 'Jobs'),
      j.title,
      j.description,
      NULL,
      'USD',
      'negotiable',
      j.location,
      'in_app_inquiry',
      '[]'::jsonb,
      CASE WHEN j.status = 'open' THEN 'published' ELSE 'archived' END,
      CASE WHEN j.compensation_text IS NOT NULL AND j.compensation_text <> '' THEN 'range' ELSE 'negotiable' END,
      CASE WHEN j.link_url IS NOT NULL AND j.link_url <> '' THEN 'link' ELSE 'application' END,
      j.link_url,
      jsonb_strip_nulls(jsonb_build_object(
        'organization_name', j.organization_name,
        'opportunity_type', j.opportunity_type,
        'work_mode', j.work_mode,
        'requirements', j.requirements,
        'compensation_text', j.compensation_text,
        'application_deadline', j.application_deadline
      )),
      jsonb_build_array(j.opportunity_type, j.work_mode),
      j.created_at,
      j.updated_at
    FROM public.job_opportunities j
    ON CONFLICT (id, circle_id) DO NOTHING;
  END IF;
END $$;

-- 5. Helper Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_universal 
  ON public.marketplace_listings(circle_id, transaction_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_custom_fields 
  ON public.marketplace_listings USING GIN (custom_fields);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_tags 
  ON public.marketplace_listings USING GIN (tags);
