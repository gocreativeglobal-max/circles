-- CIRCLES PLATFORM — BACHS SOLE PAYMENT PROCESSOR INTEGRATION
-- Migration: 0022_bachs_payment_processor.sql

-- 1. Extend invoices payment_method to support 'bachs' and set as default
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_payment_method_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_payment_method_check
  CHECK (payment_method IN ('bachs', 'stripe', 'bank_transfer', 'cash', 'manual_credit', 'external_erp', 'free_grant'));

ALTER TABLE public.invoices ALTER COLUMN payment_method SET DEFAULT 'bachs';
