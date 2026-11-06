import { describe, it, expect } from 'vitest';
import {
  PLATFORM_TIERS,
  calculatePlatformFee,
  formatBytes,
} from '../../src/features/finances/platform-fee-constants';

describe('Circles Tiered Platform Fees & Storage Quotas', () => {
  describe('Tier Definitions & Storage Allocations', () => {
    it('defines Free / Starter tier at 10% fee, $0/month, and 500 MB storage', () => {
      const free = PLATFORM_TIERS.free;
      expect(free.platformFeePercentage).toBe(10);
      expect(free.monthlyPriceUsd).toBe(0);
      expect(free.badge).toContain('10%');
      expect(free.storageFormatted).toBe('500 MB');
      expect(free.storageBytes).toBe(500 * 1024 * 1024);
      expect(free.maxFileUploadBytes).toBe(10 * 1024 * 1024);
      expect(free.allFeaturesUnlocked).toBe(true);
      expect(free.adPolicy).toBe('Platform-supported ads');
    });

    it('defines Pro Creator tier at 5% fee, $29/month, and 50 GB storage', () => {
      const pro = PLATFORM_TIERS.pro;
      expect(pro.platformFeePercentage).toBe(5);
      expect(pro.monthlyPriceUsd).toBe(29);
      expect(pro.badge).toContain('5%');
      expect(pro.storageFormatted).toBe('50 GB');
      expect(pro.storageBytes).toBe(50 * 1024 * 1024 * 1024);
      expect(pro.maxFileUploadBytes).toBe(100 * 1024 * 1024);
      expect(pro.allFeaturesUnlocked).toBe(true);
      expect(pro.adPolicy).toBe('100% Ad-Free for members');
    });

    it('defines Platinum High-Volume tier at 2% fee, $99/month, and 250 GB storage', () => {
      const platinum = PLATFORM_TIERS.platinum;
      expect(platinum.platformFeePercentage).toBe(2);
      expect(platinum.monthlyPriceUsd).toBe(99);
      expect(platinum.badge).toContain('2%');
      expect(platinum.storageFormatted).toBe('250 GB');
      expect(platinum.storageBytes).toBe(250 * 1024 * 1024 * 1024);
      expect(platinum.maxFileUploadBytes).toBe(500 * 1024 * 1024);
      expect(platinum.allFeaturesUnlocked).toBe(true);
    });

    it('defines Enterprise tier with custom platform fee and 1 TB+ storage', () => {
      const enterprise = PLATFORM_TIERS.enterprise;
      expect(enterprise.monthlyPriceUsd).toBe(0);
      expect(enterprise.badge).toContain('Custom');
      expect(enterprise.storageFormatted).toBe('1 TB+');
      expect(enterprise.storageBytes).toBe(1024 * 1024 * 1024 * 1024);
      expect(enterprise.allFeaturesUnlocked).toBe(true);
    });
  });

  describe('Byte Formatting Helper', () => {
    it('formats byte quantities into readable strings', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(500 * 1024 * 1024)).toBe('500.0 MB');
      expect(formatBytes(50 * 1024 * 1024 * 1024)).toBe('50.0 GB');
    });
  });

  describe('Platform Fee Calculations', () => {
    it('calculates 10% platform fee for Free tier', () => {
      const res = calculatePlatformFee('free', 10000);
      expect(res.planTier).toBe('free');
      expect(res.feePercentage).toBe(10);
      expect(res.feeCents).toBe(1000);
      expect(res.creatorNetCents).toBe(9000);
    });

    it('calculates 5% platform fee for Pro tier', () => {
      const res = calculatePlatformFee('pro', 10000);
      expect(res.planTier).toBe('pro');
      expect(res.feePercentage).toBe(5);
      expect(res.feeCents).toBe(500);
      expect(res.creatorNetCents).toBe(9500);
    });

    it('calculates 2% platform fee for Platinum tier', () => {
      const res = calculatePlatformFee('platinum', 10000);
      expect(res.planTier).toBe('platinum');
      expect(res.feePercentage).toBe(2);
      expect(res.feeCents).toBe(200);
      expect(res.creatorNetCents).toBe(9800);
    });

    it('calculates Enterprise tier with custom fee percentage', () => {
      const res = calculatePlatformFee('enterprise', 10000, 1.5);
      expect(res.planTier).toBe('enterprise');
      expect(res.feePercentage).toBe(1.5);
      expect(res.feeCents).toBe(150);
      expect(res.creatorNetCents).toBe(9850);
    });

    it('uses default Enterprise fee percentage (1%) when no custom rate is provided', () => {
      const res = calculatePlatformFee('enterprise', 10000, null);
      expect(res.planTier).toBe('enterprise');
      expect(res.feePercentage).toBe(1);
      expect(res.feeCents).toBe(100);
      expect(res.creatorNetCents).toBe(9900);
    });

    it('handles rounding accurately for odd cents', () => {
      const resFree = calculatePlatformFee('free', 4999);
      expect(resFree.feeCents).toBe(500);
      expect(resFree.creatorNetCents).toBe(4499);

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
