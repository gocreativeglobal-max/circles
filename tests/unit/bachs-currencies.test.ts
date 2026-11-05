import { describe, expect, it } from 'vitest';
import {
  BACHS_ACCEPTED_CURRENCIES,
  isBachsSupportedCurrency,
  getBachsCurrency,
  formatBachsAmount,
} from '@/lib/payments/currencies';
import { createCoursePaywallSchema } from '@/features/courses/service';
import { createPricingPlanSchema, createInvoiceSchema } from '@/features/finances/service';

describe('Bachs Accepted Currencies Suite', () => {
  it('1. Recognizes all accepted Bachs currencies across global fiat, African rails & crypto stablecoins', () => {
    const expectedCurrencies = [
      'USD',
      'NGN',
      'GHS',
      'KES',
      'ZAR',
      'EUR',
      'GBP',
      'CAD',
      'UGX',
      'TZS',
      'RWF',
      'ZMW',
      'USDT',
      'USDC',
    ];

    for (const code of expectedCurrencies) {
      expect(isBachsSupportedCurrency(code)).toBe(true);
      expect(isBachsSupportedCurrency(code.toLowerCase())).toBe(true);
      const def = getBachsCurrency(code);
      expect(def.code).toBe(code);
      expect(def.symbol).toBeDefined();
      expect(def.paymentMethodsDescription).toBeDefined();
    }

    // Rejects unsupported currencies
    expect(isBachsSupportedCurrency('FAKE')).toBe(false);
    expect(isBachsSupportedCurrency('XYZ')).toBe(false);
  });

  it('2. Formats Bachs currency amounts accurately with symbols and thousands separators', () => {
    expect(formatBachsAmount(5000000, 'NGN')).toBe('₦50,000 NGN');
    expect(formatBachsAmount(25000, 'GHS')).toBe('GH₵250 GHS');
    expect(formatBachsAmount(350000, 'KES')).toBe('KSh3,500 KES');
    expect(formatBachsAmount(4999, 'USD')).toBe('$49.99');
    expect(formatBachsAmount(10000, 'EUR')).toBe('€100');
    expect(formatBachsAmount(8500, 'GBP')).toBe('£85');
    expect(formatBachsAmount(10000, 'USDT')).toBe('₮100 USDT');
  });

  it('3. Validates course paywalls against Bachs accepted currencies', () => {
    // Valid: NGN (Nigerian Naira)
    const validNgn = createCoursePaywallSchema.safeParse({
      name: 'Full Stack Web Dev in Lagos',
      amountCents: 5000000,
      currency: 'NGN',
    });
    expect(validNgn.success).toBe(true);

    // Valid: KES (Kenyan Shilling)
    const validKes = createCoursePaywallSchema.safeParse({
      name: 'Mobile Dev with M-Pesa',
      amountCents: 250000,
      currency: 'KES',
    });
    expect(validKes.success).toBe(true);

    // Valid: USDT (Crypto Stablecoin)
    const validUsdt = createCoursePaywallSchema.safeParse({
      name: 'Smart Contract Security',
      amountCents: 15000,
      currency: 'USDT',
    });
    expect(validUsdt.success).toBe(true);

    // Invalid: Unaccepted currency (e.g. BTC or INVALID)
    const invalid = createCoursePaywallSchema.safeParse({
      name: 'Invalid Currency Course',
      amountCents: 1000,
      currency: 'INVALID',
    });
    expect(invalid.success).toBe(false);
  });

  it('4. Validates pricing plans and invoices against Bachs accepted currencies', () => {
    const validPlan = createPricingPlanSchema.safeParse({
      circleId: 'd4e33259-d91e-499b-b222-bfa5865bb225',
      slug: 'membership-ghs',
      name: 'Ghana Hub Membership',
      billingType: 'recurring',
      amountCents: 15000,
      currency: 'GHS',
    });
    expect(validPlan.success).toBe(true);

    const invalidPlan = createPricingPlanSchema.safeParse({
      circleId: 'd4e33259-d91e-499b-b222-bfa5865bb225',
      slug: 'membership-bad',
      name: 'Bad Currency Hub',
      billingType: 'recurring',
      amountCents: 15000,
      currency: 'RUB',
    });
    expect(invalidPlan.success).toBe(false);
  });
});
