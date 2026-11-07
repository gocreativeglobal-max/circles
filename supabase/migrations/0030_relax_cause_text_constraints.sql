-- Relax minimum character length checks on fundraising_campaigns so short titles/descriptions succeed
ALTER TABLE public.fundraising_campaigns
  DROP CONSTRAINT IF EXISTS fundraising_campaigns_title_check,
  DROP CONSTRAINT IF EXISTS fundraising_campaigns_description_check;

ALTER TABLE public.fundraising_campaigns
  ADD CONSTRAINT fundraising_campaigns_title_check CHECK (char_length(title) BETWEEN 1 AND 160),
  ADD CONSTRAINT fundraising_campaigns_description_check CHECK (char_length(description) <= 6000);
