export type PlatformPlanTier = 'free' | 'starter' | 'pro' | 'platinum' | 'enterprise';

export type GatedTierFeature =
  | 'ad_free_experience'
  | 'custom_domain'
  | 'white_label_emails'
  | 'direct_erp_sync'
  | 'priority_support';

export interface PlatformTierDefinition {
  tier: PlatformPlanTier;
  name: string;
  badge: string;
  platformFeePercentage: number;
  monthlyPriceUsd: number;
  maxCommunitiesAllowed: number;
  isAllInOneAccountPlan?: boolean;
  storageBytes: number;
  storageFormatted: string;
  maxFileUploadBytes: number;
  maxFileUploadFormatted: string;
  adPolicy: string;
  allFeaturesUnlocked: boolean;
  // Gated Premium Features (all ads handled exclusively by Circles):
  adFreeExperience: boolean;
  customDomainAllowed: boolean;
  whiteLabelEmailsAllowed: boolean;
  directErpSyncAllowed: boolean;
  prioritySupportAllowed: boolean;
  description: string;
  features: string[];
}

export const TIER_RANK: Record<PlatformPlanTier, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  platinum: 3,
  enterprise: 4,
};

export function getHigherTier(tierA: PlatformPlanTier, tierB: PlatformPlanTier): PlatformPlanTier {
  return (TIER_RANK[tierA] ?? 0) >= (TIER_RANK[tierB] ?? 0) ? tierA : tierB;
}

export const PLATFORM_TIERS: Record<PlatformPlanTier, PlatformTierDefinition> = {
  free: {
    tier: 'free',
    name: 'Free / Basic',
    badge: '10% Platform Fee',
    platformFeePercentage: 10,
    monthlyPriceUsd: 0,
    maxCommunitiesAllowed: 3,
    storageBytes: 500 * 1024 * 1024, // 500 MB
    storageFormatted: '500 MB',
    maxFileUploadBytes: 10 * 1024 * 1024, // 10 MB
    maxFileUploadFormatted: '10 MB',
    adPolicy: 'Circles Ad-Supported (Platform Ads)',
    allFeaturesUnlocked: true,
    adFreeExperience: false,
    customDomainAllowed: false,
    whiteLabelEmailsAllowed: false,
    directErpSyncAllowed: false,
    prioritySupportAllowed: false,
    description: 'Zero upfront cost. All core LMS & community features 100% unlocked for everyone.',
    features: [
      'Up to 3 communities under your account',
      'Unlimited members & discussion spaces',
      'Full Course Studio, quizzes & question banks',
      'Dripped content scheduling & cohort releases',
      'Bachs global payments & mobile money',
      'Transparent Community Treasury Ledger',
      '500 MB media storage (YouTube/Loom embeds free)',
      '10% platform fee on paid sales',
      'Circles ad-supported feed placements',
      'Standard community support',
    ],
  },
  starter: {
    tier: 'starter',
    name: 'Starter Creator',
    badge: '7% Platform Fee',
    platformFeePercentage: 7,
    monthlyPriceUsd: 15,
    maxCommunitiesAllowed: 5,
    storageBytes: 10 * 1024 * 1024 * 1024, // 10 GB
    storageFormatted: '10 GB',
    maxFileUploadBytes: 50 * 1024 * 1024, // 50 MB
    maxFileUploadFormatted: '50 MB',
    adPolicy: '100% Ad-Free for members',
    allFeaturesUnlocked: true,
    adFreeExperience: true,
    customDomainAllowed: false,
    whiteLabelEmailsAllowed: false,
    directErpSyncAllowed: false,
    prioritySupportAllowed: false,
    description: 'Entry creator plan. 100% ad-free community, 20x more storage, and reduced 7% platform fee.',
    features: [
      'All-in-One: Covers up to 5 communities',
      'Reduced platform fee: 7% on paid sales across all your communities',
      '10 GB high-capacity media storage',
      '100% Ad-Free experience for all circle members',
      '50 MB max single file upload',
      'Bachs global cards, bank transfers & mobile money',
      'Full Community Treasury & live analytics',
      'Community & email support',
    ],
  },
  pro: {
    tier: 'pro',
    name: 'Pro Creator',
    badge: '5% Platform Fee',
    platformFeePercentage: 5,
    monthlyPriceUsd: 50,
    maxCommunitiesAllowed: 10,
    storageBytes: 50 * 1024 * 1024 * 1024, // 50 GB
    storageFormatted: '50 GB',
    maxFileUploadBytes: 100 * 1024 * 1024, // 100 MB
    maxFileUploadFormatted: '100 MB',
    adPolicy: '100% Ad-Free for members',
    allFeaturesUnlocked: true,
    adFreeExperience: true,
    customDomainAllowed: true,
    whiteLabelEmailsAllowed: true,
    directErpSyncAllowed: false,
    prioritySupportAllowed: true,
    description: 'For growing creators. 5% fee, 50 GB native storage, custom domains, and white-label branding.',
    features: [
      'All-in-One: Covers up to 10 communities under one subscription',
      '5% platform fee on paid sales across all communities',
      '50 GB high-capacity native media storage',
      '100% Ad-Free experience for all circle members',
      'Custom domain mapping for each community (e.g. academy.yourbrand.com)',
      'White-label emails & custom branding (remove Circles badge)',
      '100 MB max single file upload',
      'Priority email support',
    ],
  },
  platinum: {
    tier: 'platinum',
    name: 'Platinum High-Volume / Network',
    badge: '3% Platform Fee',
    platformFeePercentage: 3,
    monthlyPriceUsd: 250,
    maxCommunitiesAllowed: 25,
    storageBytes: 250 * 1024 * 1024 * 1024, // 250 GB
    storageFormatted: '250 GB',
    maxFileUploadBytes: 500 * 1024 * 1024, // 500 MB
    maxFileUploadFormatted: '500 MB',
    adPolicy: '100% Ad-Free for members',
    allFeaturesUnlocked: true,
    adFreeExperience: true,
    customDomainAllowed: true,
    whiteLabelEmailsAllowed: true,
    directErpSyncAllowed: true,
    prioritySupportAllowed: true,
    description: 'For established academies and multi-community networks. Lowest 3% fee and 250 GB storage.',
    features: [
      'All-in-One: Covers up to 25 communities under one subscription',
      'Lowest platform fee: Reduced to 3% across all your circles',
      '250 GB enterprise media storage',
      '100% Ad-Free experience for all circle members',
      'Direct ERP & automated accounting sync (QuickBooks, Xero, Yardi)',
      'Automated payouts via Bachs settlement',
      'Highest member concurrency & active learner quotas',
      'Dedicated account manager',
    ],
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise / Custom',
    badge: 'Custom Fee',
    platformFeePercentage: 1, // Negotiable default
    monthlyPriceUsd: 0, // Custom contract
    maxCommunitiesAllowed: 99999,
    storageBytes: 1024 * 1024 * 1024 * 1024, // 1 TB
    storageFormatted: '1 TB+',
    maxFileUploadBytes: 2 * 1024 * 1024 * 1024, // 2 GB
    maxFileUploadFormatted: '2 GB',
    adPolicy: 'Strictly White-Label & Ad-Free',
    allFeaturesUnlocked: true,
    adFreeExperience: true,
    customDomainAllowed: true,
    whiteLabelEmailsAllowed: true,
    directErpSyncAllowed: true,
    prioritySupportAllowed: true,
    description: 'Tailored solutions for universities, institutions, and global organizations.',
    features: [
      'Unlimited communities under master enterprise agreement',
      'Custom negotiated platform fee rate',
      '1 TB+ pooled cloud storage (Custom S3/R2 direct)',
      'Custom domain & dedicated infrastructure',
      '100% Ad-Free & fully white-labeled',
      '99.9% uptime SLA & 24/7 phone/emergency support',
      'Bespoke ERP integrations & SSO/SAML',
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
 * Checks whether a specific gated feature is permitted for a given tier.
 */
export function isTierFeatureAllowed(
  tier: PlatformPlanTier,
  feature: GatedTierFeature
): boolean {
  const def = PLATFORM_TIERS[tier] || PLATFORM_TIERS.free;
  switch (feature) {
    case 'ad_free_experience':
      return def.adFreeExperience;
    case 'custom_domain':
      return def.customDomainAllowed;
    case 'white_label_emails':
      return def.whiteLabelEmailsAllowed;
    case 'direct_erp_sync':
      return def.directErpSyncAllowed;
    case 'priority_support':
      return def.prioritySupportAllowed;
    default:
      return false;
  }
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
