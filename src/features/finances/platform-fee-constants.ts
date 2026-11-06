export type PlatformPlanTier = 'free' | 'pro' | 'platinum' | 'enterprise';

export interface PlatformTierDefinition {
  tier: PlatformPlanTier;
  name: string;
  badge: string;
  platformFeePercentage: number;
  monthlyPriceUsd: number;
  storageBytes: number;
  storageFormatted: string;
  maxFileUploadBytes: number;
  maxFileUploadFormatted: string;
  adPolicy: string;
  allFeaturesUnlocked: boolean;
  description: string;
  features: string[];
}

export const PLATFORM_TIERS: Record<PlatformPlanTier, PlatformTierDefinition> = {
  free: {
    tier: 'free',
    name: 'Free / Starter',
    badge: '10% Platform Fee',
    platformFeePercentage: 10,
    monthlyPriceUsd: 0,
    storageBytes: 500 * 1024 * 1024, // 500 MB
    storageFormatted: '500 MB',
    maxFileUploadBytes: 10 * 1024 * 1024, // 10 MB
    maxFileUploadFormatted: '10 MB',
    adPolicy: 'Platform-supported ads',
    allFeaturesUnlocked: true,
    description: 'Zero upfront cost. All core LMS & community features 100% unlocked for everyone.',
    features: [
      'Unlimited members & discussion spaces',
      'Full Course Studio, quizzes & question banks',
      'Dripped content scheduling & cohort releases',
      'Bachs global payments & mobile money',
      'Transparent Community Treasury Ledger',
      '500 MB media storage (YouTube/Loom embeds free)',
      '10% platform fee on paid sales',
      'Standard community support',
    ],
  },
  pro: {
    tier: 'pro',
    name: 'Pro Creator',
    badge: '5% Platform Fee',
    platformFeePercentage: 5,
    monthlyPriceUsd: 29,
    storageBytes: 50 * 1024 * 1024 * 1024, // 50 GB
    storageFormatted: '50 GB',
    maxFileUploadBytes: 100 * 1024 * 1024, // 100 MB
    maxFileUploadFormatted: '100 MB',
    adPolicy: '100% Ad-Free for members',
    allFeaturesUnlocked: true,
    description: 'For growing creators. 50% lower fee, 100x more storage, and completely ad-free.',
    features: [
      'Everything in Starter (All software tools included)',
      '50% lower platform fee: Reduced to 5%',
      '50 GB high-capacity native media storage',
      '100% Ad-Free experience for all circle members',
      'Custom branding & white-label transactional emails',
      'Priority email support',
    ],
  },
  platinum: {
    tier: 'platinum',
    name: 'Platinum High-Volume',
    badge: '2% Platform Fee',
    platformFeePercentage: 2,
    monthlyPriceUsd: 99,
    storageBytes: 250 * 1024 * 1024 * 1024, // 250 GB
    storageFormatted: '250 GB',
    maxFileUploadBytes: 500 * 1024 * 1024, // 500 MB
    maxFileUploadFormatted: '500 MB',
    adPolicy: 'Ad-Free + Sell Own Sponsors (Keep 100%)',
    allFeaturesUnlocked: true,
    description: 'For established academies and high-volume communities. Lowest 2% fee and 250 GB storage.',
    features: [
      'Everything in Pro',
      'Lowest platform fee: Reduced to 2%',
      '250 GB enterprise media storage',
      'Circle Sponsor Engine (Sell your own ads & keep 100%)',
      'Direct ERP & automated payouts via Bachs',
      'Dedicated account manager',
    ],
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise / Custom',
    badge: 'Custom Fee',
    platformFeePercentage: 1, // Negotiable default
    monthlyPriceUsd: 0, // Custom contract
    storageBytes: 1024 * 1024 * 1024 * 1024, // 1 TB
    storageFormatted: '1 TB+',
    maxFileUploadBytes: 2 * 1024 * 1024 * 1024, // 2 GB
    maxFileUploadFormatted: '2 GB',
    adPolicy: 'Strictly White-Label & Ad-Free',
    allFeaturesUnlocked: true,
    description: 'Tailored solutions for universities, institutions, and global organizations.',
    features: [
      'Custom negotiated platform fee rate',
      '1 TB+ pooled cloud storage (Custom S3/R2 direct)',
      'Custom domain & dedicated infrastructure',
      '99.9% uptime SLA & 24/7 phone/emergency support',
      'Bespoke ERP integrations (Xero, QuickBooks, Yardi)',
    ],
  },
};

export interface FeeCalculationResult {
  planTier: PlatformPlanTier;
  feePercentage: number;
  feeCents: number;
  creatorNetCents: number;
}

/**
 * Calculates the platform fee and net creator payout based on the Circle's subscription tier.
 */
export function calculatePlatformFee(
  tier: PlatformPlanTier,
  grossAmountCents: number,
  customFeePercentage?: number | null
): FeeCalculationResult {
  if (grossAmountCents <= 0) {
    return {
      planTier: tier,
      feePercentage: 0,
      feeCents: 0,
      creatorNetCents: 0,
    };
  }

  let feePercentage = PLATFORM_TIERS[tier]?.platformFeePercentage ?? 10;
  if (tier === 'enterprise' && customFeePercentage != null && customFeePercentage >= 0) {
    feePercentage = Number(customFeePercentage);
  }

  const feeCents = Math.round(grossAmountCents * (feePercentage / 100));
  const creatorNetCents = Math.max(0, grossAmountCents - feeCents);

  return {
    planTier: tier,
    feePercentage,
    feeCents,
    creatorNetCents,
  };
}

/**
 * Formats a raw byte count into human-readable representation.
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}
