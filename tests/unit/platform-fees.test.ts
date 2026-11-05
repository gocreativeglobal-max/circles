import { describe, it, expect } from 'vitest';
import {
  PLATFORM_TIERS,
  calculatePlatformFee,
} from '../../src/features/finances/platform-fee-constants';

describe('Circles Tiered Platform Fees', () => {
  describe('Tier Definitions', () => {
    it('defines Free / Starter tier at 10% fee and $0/month', () => {
      const free = PLATFORM_TIERS.free;
      expect(free.platformFeePercentage).toBe(10);
      expect(free.monthlyPriceUsd).toBe(0);
      expect(free.badge).toContain('10%');
    });

    it('defines Pro Creator tier at 5% fee and $29/month', () => {
      const pro = PLATFORM_TIERS.pro;
      expect(pro.platformFeePercentage).toBe(5);
      expect(pro.monthlyPriceUsd).toBe(29);
      expect(pro.badge).toContain('5%');
    });

    it('defines Platinum High-Volume tier at 2% fee and $99/month', () => {
      const platinum = PLATFORM_TIERS.platinum;
      expect(platinum.platformFeePercentage).toBe(2);
      expect(platinum.monthlyPriceUsd).toBe(99);
      expect(platinum.badge).toContain('2%');
    });

    it('defines Enterprise tier with custom platform fee and negotiable contract', () => {
      const enterprise = PLATFORM_TIERS.enterprise;
      expect(enterprise.monthlyPriceUsd).toBe(0);
      expect(enterprise.badge).toContain('Custom');
    });
  });

  describe('Platform Fee Calculations', () => {
    it('calculates 10% platform fee for Free tier', () => {
      // $100.00 gross (10,000 cents)
      const res = calculatePlatformFee('free', 10000);
      expect(res.planTier).toBe('free');
      expect(res.feePercentage).toBe(10);
      expect(res.feeCents).toBe(1000); // $10.00
      expect(res.creatorNetCents).toBe(9000); // $90.00
    });

    it('calculates 5% platform fee for Pro tier', () => {
      // $100.00 gross (10,000 cents)
      const res = calculatePlatformFee('pro', 10000);
      expect(res.planTier).toBe('pro');
      expect(res.feePercentage).toBe(5);
      expect(res.feeCents).toBe(500); // $5.00
      expect(res.creatorNetCents).toBe(9500); // $95.00
    });

    it('calculates 2% platform fee for Platinum tier', () => {
      // $100.00 gross (10,000 cents)
      const res = calculatePlatformFee('platinum', 10000);
      expect(res.planTier).toBe('platinum');
      expect(res.feePercentage).toBe(2);
      expect(res.feeCents).toBe(200); // $2.00
      expect(res.creatorNetCents).toBe(9800); // $98.00
    });

    it('calculates Enterprise tier with custom fee percentage', () => {
      // $100.00 gross with 1.5% custom fee
      const res = calculatePlatformFee('enterprise', 10000, 1.5);
      expect(res.planTier).toBe('enterprise');
      expect(res.feePercentage).toBe(1.5);
      expect(res.feeCents).toBe(150); // $1.50
      expect(res.creatorNetCents).toBe(9850); // $98.50
    });

    it('uses default Enterprise fee percentage (1%) when no custom rate is provided', () => {
      const res = calculatePlatformFee('enterprise', 10000, null);
      expect(res.planTier).toBe('enterprise');
      expect(res.feePercentage).toBe(1);
      expect(res.feeCents).toBe(100);
      expect(res.creatorNetCents).toBe(9900);
    });

    it('handles rounding accurately for odd cents', () => {
      // $49.99 (4999 cents) on Free (10%)
      // 4999 * 0.10 = 499.9 -> rounds to 500 cents ($5.00)
      // Net: 4999 - 500 = 4499 cents ($44.99)
      const resFree = calculatePlatformFee('free', 4999);
      expect(resFree.feeCents).toBe(500);
      expect(resFree.creatorNetCents).toBe(4499);

      // $49.99 (4999 cents) on Platinum (2%)
      // 4999 * 0.02 = 99.98 -> rounds to 100 cents ($1.00)
      // Net: 4999 - 100 = 4899 cents ($48.99)
      const resPlat = calculatePlatformFee('platinum', 4999);
      expect(resPlat.feeCents).toBe(100);
      expect(resPlat.creatorNetCents).toBe(4899);
    });

    it('handles zero or negative amounts safely', () => {
      const zero = calculatePlatformFee('free', 0);
      expect(zero.feeCents).toBe(0);
      expect(zero.creatorNetCents).toBe(0);

      const negative = calculatePlatformFee('pro', -500);
      expect(negative.feeCents).toBe(0);
      expect(negative.creatorNetCents).toBe(0);
    });
  });
});
