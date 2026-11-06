import { ListingActionType } from '@/types/domain';

function formatAmount(val: number): string {
  const hasDecimals = !Number.isInteger(val);
  return val.toLocaleString(undefined, {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export function formatListingPrice(item: {
  transaction_type?: string | null;
  pricing_unit?: string | null;
  price_amount?: number | null;
  price_min?: number | null;
  price_max?: number | null;
  rate_interval?: string | null;
  price_currency?: string | null;
}): string {
  const currency = item.price_currency || 'USD';
  const sym = currency === 'USD' ? '$' : `${currency} `;

  const transType =
    item.transaction_type ||
    (item.pricing_unit === 'free'
      ? 'free'
      : item.pricing_unit === 'negotiable'
      ? 'negotiable'
      : item.pricing_unit && ['hourly', 'daily', 'monthly'].includes(item.pricing_unit)
      ? 'rate'
      : 'fixed');

  if (transType === 'free') {
    return 'FREE';
  }

  if (transType === 'negotiable') {
    return item.price_amount !== null && item.price_amount !== undefined
      ? `${sym}${formatAmount(Number(item.price_amount))} (Negotiable)`
      : 'Negotiable';
  }

  if (transType === 'range') {
    if (item.price_min != null && item.price_max != null) {
      return `${sym}${formatAmount(Number(item.price_min))} – ${sym}${formatAmount(Number(item.price_max))}`;
    }
    if (item.price_min != null) {
      return `From ${sym}${formatAmount(Number(item.price_min))}`;
    }
    if (item.price_max != null) {
      return `Up to ${sym}${formatAmount(Number(item.price_max))}`;
    }
    return 'Price upon request';
  }

  if (transType === 'rate') {
    const interval =
      item.rate_interval ||
      (item.pricing_unit === 'hourly'
        ? 'hourly'
        : item.pricing_unit === 'daily'
        ? 'daily'
        : item.pricing_unit === 'monthly'
        ? 'monthly'
        : 'monthly');

    const intervalLabel =
      interval === 'hourly'
        ? '/hr'
        : interval === 'daily'
        ? '/day'
        : interval === 'weekly'
        ? '/wk'
        : interval === 'monthly'
        ? '/mo'
        : interval === 'annually'
        ? '/yr'
        : `/${interval}`;

    return item.price_amount !== null && item.price_amount !== undefined
      ? `${sym}${formatAmount(Number(item.price_amount))}${intervalLabel}`
      : `Rate (${intervalLabel})`;
  }

  // Fixed price
  return item.price_amount !== null && item.price_amount !== undefined
    ? `${sym}${formatAmount(Number(item.price_amount))}`
    : 'Price upon request';
}

export function getActionLabel(
  actionType?: ListingActionType | string | null,
  listingType?: string | null
): string {
  switch (actionType) {
    case 'booking':
      return listingType === 'rental' ? 'Borrow Item' : 'Book Appointment';
    case 'application':
      return 'Apply Now';
    case 'link':
      return 'Visit External Link';
    case 'inquiry':
    default:
      return 'Contact & Inquire';
  }
}

export const LISTING_PRESETS: Record<
  string,
  {
    name: string;
    description: string;
    defaultTransaction: 'free' | 'fixed' | 'rate' | 'range' | 'negotiable';
    defaultAction: ListingActionType;
    fields: Record<string, string>;
  }
> = {
  housing: {
    name: 'Housing & Sublets',
    description: 'Rooms, apartments, parking spaces, or sublets',
    defaultTransaction: 'rate',
    defaultAction: 'inquiry',
    fields: {
      Bedrooms: '1',
      Bathrooms: '1',
      'Lease Term': 'Month-to-month',
      'Available From': 'Immediately',
      Furnished: 'Yes',
      'Pet Friendly': 'Yes',
    },
  },
  job: {
    name: 'Jobs & Gigs',
    description: 'Campus gigs, internships, freelance, or full-time roles',
    defaultTransaction: 'range',
    defaultAction: 'application',
    fields: {
      Company: '',
      Role: '',
      Workplace: 'Remote',
      Commitment: 'Part-time',
      'Experience Level': 'Entry-level',
    },
  },
  rental: {
    name: 'Tool Lending & Gear',
    description: 'Tools, camping gear, cameras, and equipment sharing',
    defaultTransaction: 'rate',
    defaultAction: 'booking',
    fields: {
      'Security Deposit': '$0',
      'Max Lending Period': '3 days',
      'Pickup Location': 'Campus Center',
      Condition: 'Excellent',
    },
  },
  service: {
    name: 'Services & Lessons',
    description: 'Tutoring, tech repair, music lessons, or consulting',
    defaultTransaction: 'rate',
    defaultAction: 'booking',
    fields: {
      'Session Format': 'Online & In-person',
      'Experience': '3+ years',
      'Prerequisites': 'None',
    },
  },
  product: {
    name: 'Goods & Marketplace',
    description: 'Books, furniture, electronics, and supplies for sale or giveaway',
    defaultTransaction: 'fixed',
    defaultAction: 'inquiry',
    fields: {
      Brand: '',
      Model: '',
      Condition: 'Like New',
    },
  },
};
