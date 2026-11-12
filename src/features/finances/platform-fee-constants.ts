export type PlatformPlanTier = 'free' | 'pro' | 'platinum' | 'enterprise';

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
    adPolicy: 'Circles Ad-Supported (Platform Ads)',
    allFeaturesUnlocked: true,
    adFreeExperience: false,
    customDomainAllowed: false,
    whiteLabelEmailsAllowed: false,
    directErpSyncAllowed: false,
    prioritySupportAllowed: false,
    description: 'Zero upfront cost. All core LMS & community features 100% unlocked for everyone.',
    features: [
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
  pro: {
    tier: 'pro',
    name: 'Pro Creator',
    badge: '5% Platform Fee',
    platformFeePercentage: 5,
    monthlyPriceUsd: 30,
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
    description: 'For growing creators. 50% lower fee, 100x more storage, and completely ad-free.',
    features: [
      'Everything in Starter (All software tools included)',
      '50% lower platform fee: Reduced to 5%',
      '50 GB high-capacity native media storage',
      '100% Ad-Free experience for all circle members',
      'Custom domain mapping (e.g. academy.yourbrand.com)',
      'White-label emails & custom branding (remove Circles badge)',
      'Priority email support',
    ],
  },
  platinum: {
    tier: 'platinum',
    name: 'Platinum High-Volume',
    badge: '3% Platform Fee',
    platformFeePercentage: 3,
    monthlyPriceUsd: 100,
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
    description: 'For established academies and high-volume communities. Lowest 3% fee and 250 GB storage.',
    features: [
      'Everything in Pro',
      'Lowest platform fee: Reduced to 3%',
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
