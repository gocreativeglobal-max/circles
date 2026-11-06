-- ============================================================================
-- Migration 0028: Marketplace Monetization, Checkout Orders & Member Wallets
-- ============================================================================

-- 1. Relax price_currency length check to support 3-4 character currency codes (e.g. USD, NGN, USDT, USDC)
ALTER TABLE public.marketplace_listings
  DROP CONSTRAINT IF EXISTS marketplace_listings_price_currency_check;

ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_price_currency_check
  CHECK (char_length(price_currency) BETWEEN 3 AND 4);

-- 2. Extend action_type check constraint to include 'checkout' (On-platform purchase)
ALTER TABLE public.marketplace_listings
  DROP CONSTRAINT IF EXISTS marketplace_listings_action_type_check;

ALTER TABLE public.marketplace_listings
  ADD CONSTRAINT marketplace_listings_action_type_check
  CHECK (action_type IN ('inquiry', 'booking', 'application', 'link', 'checkout'));

-- 3. Marketplace Orders Table (Supports both members and non-members purchasing listings)
CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gross_amount_cents BIGINT NOT NULL CHECK (gross_amount_cents >= 0),
  platform_fee_cents BIGINT NOT NULL DEFAULT 0 CHECK (platform_fee_cents >= 0),
  circle_commission_cents BIGINT NOT NULL DEFAULT 0 CHECK (circle_commission_cents >= 0),
  seller_net_cents BIGINT NOT NULL DEFAULT 0 CHECK (seller_net_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency) BETWEEN 3 AND 4),
  payment_method TEXT NOT NULL DEFAULT 'bachs',
  payment_reference TEXT,
  buyer_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_orders_circle ON public.marketplace_orders(circle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer ON public.marketplace_orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_seller ON public.marketplace_orders(seller_id, created_at DESC);

-- 4. Member Wallet Transactions Table (Credits seller net payouts & tracks withdrawal requests)
CREATE TABLE IF NOT EXISTS public.member_wallet_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  circle_id UUID REFERENCES public.circles(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('sale_credit', 'withdrawal', 'refund_debit')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (char_length(currency) BETWEEN 3 AND 4),
  description TEXT NOT NULL DEFAULT '',
  payout_destination TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_member_wallet_user ON public.member_wallet_transactions(user_id, created_at DESC);

-- 5. Row-Level Security & Grants
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders FORCE ROW LEVEL SECURITY;

ALTER TABLE public.member_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_wallet_transactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketplace_orders_select ON public.marketplace_orders;
CREATE POLICY marketplace_orders_select ON public.marketplace_orders
  FOR SELECT TO authenticated
  USING (
    buyer_id = auth.uid() OR
    seller_id = auth.uid() OR
    public.has_circle_staff_role(circle_id, auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS marketplace_orders_insert ON public.marketplace_orders;
CREATE POLICY marketplace_orders_insert ON public.marketplace_orders
  FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS member_wallet_select ON public.member_wallet_transactions;
CREATE POLICY member_wallet_select ON public.member_wallet_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS member_wallet_insert ON public.member_wallet_transactions;
CREATE POLICY member_wallet_insert ON public.member_wallet_transactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.marketplace_orders TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.member_wallet_transactions TO authenticated, service_role;
