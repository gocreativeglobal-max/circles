export type PlatformPlanTier = 'free' | 'pro' | 'platinum' | 'enterprise';

export interface PlatformTierDefinition {
  tier: PlatformPlanTier;
  name: string;
  badge: string;
  platformFeePercentage: number;
  monthlyPriceUsd: number;
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
    description: 'Zero upfront cost. Perfect for launching courses and community validation.',
    features: [
      'Unlimited members & spaces',
      'Course studio & flexible lessons',
      'Bachs global payments & mobile money',
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
    description: 'For growing creators and academies scaling their monthly revenue.',
    features: [
      'Everything in Starter',
      'Reduced 5% platform fee',
      'Advanced quiz analytics & dripped cohorts',
      'Custom branding & white-label emails',
      'Priority support',
    ],
  },
  platinum: {
    tier: 'platinum',
    name: 'Platinum High-Volume',
    badge: '2% Platform Fee',
    platformFeePercentage: 2,
    monthlyPriceUsd: 99,
    description: 'For established academies and high-volume membership communities.',
    features: [
      'Everything in Pro',
      'Lowest 2% platform fee',
      'Dedicated account manager',
      'Direct ERP & automated payouts via Bachs',
      'Highest member concurrency limits',
    ],
  },
  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise / Custom',
    badge: 'Custom Fee',
    platformFeePercentage: 1, // Negotiable default
    monthlyPriceUsd: 0, // Custom contract
    description: 'Tailored solutions for universities, institutions, and global organizations.',
    features: [
      'Custom negotiated platform fee rate',
      'Custom domain & dedicated infrastructure',
      'SLA guarantees & 24/7 phone support',
      'Bespoke integration & data export',
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
