import { describe, it, expect } from 'vitest';
import {
  PLATFORM_TIERS,
  calculatePlatformFee,
  formatBytes,
  isTierFeatureAllowed,
} from '../../src/features/finances/platform-fee-constants';
import { assertCircleTierEntitlement } from '../../src/features/finances/platform-fees';

describe('Circles Tiered Platform Fees, Storage & Feature Gating', () => {
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
      expect(free.adPolicy).toBe('Circles Ad-Supported (Platform Ads)');
    });

    it('defines Starter Creator tier at 7% fee, $15/month, and 10 GB storage', () => {
      const starter = PLATFORM_TIERS.starter;
      expect(starter.platformFeePercentage).toBe(7);
      expect(starter.monthlyPriceUsd).toBe(15);
      expect(starter.badge).toContain('7%');
      expect(starter.storageFormatted).toBe('10 GB');
      expect(starter.storageBytes).toBe(10 * 1024 * 1024 * 1024);
      expect(starter.maxFileUploadBytes).toBe(50 * 1024 * 1024);
      expect(starter.allFeaturesUnlocked).toBe(true);
      expect(starter.adPolicy).toBe('100% Ad-Free for members');
    });

    it('defines Pro Creator tier at 5% fee, $50/month, and 50 GB storage', () => {
      const pro = PLATFORM_TIERS.pro;
      expect(pro.platformFeePercentage).toBe(5);
      expect(pro.monthlyPriceUsd).toBe(50);
      expect(pro.badge).toContain('5%');
      expect(pro.storageFormatted).toBe('50 GB');
      expect(pro.storageBytes).toBe(50 * 1024 * 1024 * 1024);
      expect(pro.maxFileUploadBytes).toBe(100 * 1024 * 1024);
      expect(pro.allFeaturesUnlocked).toBe(true);
      expect(pro.adPolicy).toBe('100% Ad-Free for members');
    });

    it('defines Platinum High-Volume tier at 3% fee, $250/month, and 250 GB storage', () => {
      const platinum = PLATFORM_TIERS.platinum;
      expect(platinum.platformFeePercentage).toBe(3);
      expect(platinum.monthlyPriceUsd).toBe(250);
      expect(platinum.badge).toContain('3%');
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

  describe('The Premium Feature Gates', () => {
    it('gates Ad-Free Experience to Starter and above', () => {
      expect(isTierFeatureAllowed('free', 'ad_free_experience')).toBe(false);
      expect(isTierFeatureAllowed('starter', 'ad_free_experience')).toBe(true);
      expect(isTierFeatureAllowed('pro', 'ad_free_experience')).toBe(true);
      expect(isTierFeatureAllowed('platinum', 'ad_free_experience')).toBe(true);
    });

    it('gates Custom Domain Mapping to Pro and above', () => {
      expect(isTierFeatureAllowed('free', 'custom_domain')).toBe(false);
      expect(isTierFeatureAllowed('starter', 'custom_domain')).toBe(false);
      expect(isTierFeatureAllowed('pro', 'custom_domain')).toBe(true);
      expect(isTierFeatureAllowed('platinum', 'custom_domain')).toBe(true);
    });

    it('gates White-Label Emails to Pro and above', () => {
      expect(isTierFeatureAllowed('free', 'white_label_emails')).toBe(false);
      expect(isTierFeatureAllowed('starter', 'white_label_emails')).toBe(false);
      expect(isTierFeatureAllowed('pro', 'white_label_emails')).toBe(true);
      expect(isTierFeatureAllowed('platinum', 'white_label_emails')).toBe(true);
    });

    it('gates Direct Accounting ERP Sync strictly to Platinum and Enterprise', () => {
      expect(isTierFeatureAllowed('free', 'direct_erp_sync')).toBe(false);
      expect(isTierFeatureAllowed('starter', 'direct_erp_sync')).toBe(false);
      expect(isTierFeatureAllowed('pro', 'direct_erp_sync')).toBe(false);
      expect(isTierFeatureAllowed('platinum', 'direct_erp_sync')).toBe(true);
    });

    it('enforces tier entitlement assertions with informative upgrade errors', () => {
      // Free circle attempting ad-free experience
      expect(() => assertCircleTierEntitlement('free', 'ad_free_experience')).toThrow(
        /not included in your circle's Free \/ Basic plan.*upgrade to Starter \(\$15\/mo\)/i
      );

      // Starter circle attempting custom domain mapping
      expect(() => assertCircleTierEntitlement('starter', 'custom_domain')).toThrow(
        /not included in your circle's Starter Creator plan.*upgrade to Pro \(\$50\/mo\)/i
      );

      // Pro circle attempting Direct ERP Sync
      expect(() => assertCircleTierEntitlement('pro', 'direct_erp_sync')).toThrow(
        /not included in your circle's Pro Creator plan.*upgrade to Platinum \(\$250\/mo\)/i
      );

      // Permitted cases do not throw
      expect(() => assertCircleTierEntitlement('starter', 'ad_free_experience')).not.toThrow();
      expect(() => assertCircleTierEntitlement('pro', 'custom_domain')).not.toThrow();
      expect(() => assertCircleTierEntitlement('platinum', 'direct_erp_sync')).not.toThrow();
      expect(() => assertCircleTierEntitlement('enterprise', 'direct_erp_sync')).not.toThrow();
    });
  });

  describe('Byte Formatting Helper', () => {
    it('formats byte quantities into readable strings', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(500 * 1024 * 1024)).toBe('500.0 MB');
      expect(formatBytes(10 * 1024 * 1024 * 1024)).toBe('10.0 GB');
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

    it('calculates 7% platform fee for Starter tier', () => {
      const res = calculatePlatformFee('starter', 10000);
      expect(res.planTier).toBe('starter');
      expect(res.feePercentage).toBe(7);
      expect(res.feeCents).toBe(700);
      expect(res.creatorNetCents).toBe(9300);
    });

    it('calculates 5% platform fee for Pro tier', () => {
      const res = calculatePlatformFee('pro', 10000);
      expect(res.planTier).toBe('pro');
      expect(res.feePercentage).toBe(5);
      expect(res.feeCents).toBe(500);
      expect(res.creatorNetCents).toBe(9500);
    });

    it('calculates 3% platform fee for Platinum tier', () => {
      const res = calculatePlatformFee('platinum', 10000);
      expect(res.planTier).toBe('platinum');
      expect(res.feePercentage).toBe(3);
      expect(res.feeCents).toBe(300);
      expect(res.creatorNetCents).toBe(9700);
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
      expect(resPlat.feeCents).toBe(150);
      expect(resPlat.creatorNetCents).toBe(4849);
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
