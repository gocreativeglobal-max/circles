import { describe, expect, it } from 'vitest';
import { formatListingPrice, getActionLabel, LISTING_PRESETS } from '@/features/marketplace/listing-helpers';
import {
  createListingSchema,
  normalizeMarketplaceSettings,
} from '@/features/marketplace/service';
import {
  CAPABILITY_REGISTRY,
  CONSOLIDATED_LISTING_CAPABILITIES,
  getAllCapabilityDefinitions,
} from '@/features/capabilities/registry';

describe('Universal Customizable Listings Suite', () => {
  it('formats free listings accurately', () => {
    const formatted = formatListingPrice({
      transaction_type: 'free',
      price_currency: 'USD',
    });
    expect(formatted).toBe('FREE');
  });

  it('formats fixed price listings with currency formatting', () => {
    const formatted = formatListingPrice({
      transaction_type: 'fixed',
      price_amount: 45.5,
      price_currency: 'USD',
    });
    expect(formatted).toBe('$45.50');
  });

  it('formats recurring rates accurately for hourly, monthly, etc.', () => {
    const hourly = formatListingPrice({
      transaction_type: 'rate',
      rate_interval: 'hourly',
      price_amount: 35,
      price_currency: 'USD',
    });
    expect(hourly).toBe('$35/hr');

    const monthly = formatListingPrice({
      transaction_type: 'rate',
      rate_interval: 'monthly',
      price_amount: 1200,
      price_currency: 'USD',
    });
    expect(monthly).toBe('$1,200/mo');

    const weekly = formatListingPrice({
      transaction_type: 'rate',
      rate_interval: 'weekly',
      price_amount: 250,
      price_currency: 'USD',
    });
    expect(weekly).toBe('$250/wk');
  });

  it('formats price ranges accurately', () => {
    const range = formatListingPrice({
      transaction_type: 'range',
      price_min: 500,
      price_max: 800,
      price_currency: 'USD',
    });
    expect(range).toBe('$500 – $800');

    const minOnly = formatListingPrice({
      transaction_type: 'range',
      price_min: 1000,
      price_max: null,
      price_currency: 'USD',
    });
    expect(minOnly).toBe('From $1,000');
  });

  it('formats negotiable listings', () => {
    const negWithPrice = formatListingPrice({
      transaction_type: 'negotiable',
      price_amount: 200,
      price_currency: 'USD',
    });
    expect(negWithPrice).toBe('$200 (Negotiable)');

    const negWithoutPrice = formatListingPrice({
      transaction_type: 'negotiable',
      price_amount: null,
      price_currency: 'USD',
    });
    expect(negWithoutPrice).toBe('Negotiable');
  });

  it('resolves action labels according to actionType and listingType', () => {
    expect(getActionLabel('checkout', 'product')).toBe('Buy Now');
    expect(getActionLabel('inquiry', 'product')).toBe('Contact & Inquire');
    expect(getActionLabel('booking', 'rental')).toBe('Borrow Item');
    expect(getActionLabel('booking', 'service')).toBe('Book Appointment');
    expect(getActionLabel('application', 'job')).toBe('Apply Now');
    expect(getActionLabel('link', 'housing')).toBe('Visit External Link');
  });

  it('formats multi-currency listings and validates checkout & currency settings', () => {
    expect(
      formatListingPrice({
        transaction_type: 'fixed',
        price_amount: 25000,
        price_currency: 'NGN',
      })
    ).toBe('₦25,000');

    expect(
      formatListingPrice({
        transaction_type: 'fixed',
        price_amount: 120,
        price_currency: 'USDC',
      })
    ).toBe('USDC 120');

    const settings = normalizeMarketplaceSettings({
      defaultCurrency: 'ngn',
      allowMultiCurrency: false,
      commissionPercentage: 10,
      payToPostEnabled: true,
      payToPostFeeAmount: 5000,
      payToPostTypes: ['job', 'property'],
      allowedListingTypes: ['job', 'service'],
      postingPolicy: 'admins_only',
    });

    expect(settings.defaultCurrency).toBe('NGN');
    expect(settings.allowMultiCurrency).toBe(false);
    expect(settings.commissionPercentage).toBe(10);
    expect(settings.payToPostEnabled).toBe(true);
    expect(settings.payToPostFeeAmount).toBe(5000);
    expect(settings.allowedListingTypes).toEqual(['job', 'service']);
    expect(settings.postingPolicy).toBe('admins_only');

    const parsedCheckoutListing = createListingSchema.safeParse({
      circleId: 'd4e33259-d91e-499b-b222-bfa5865bb225',
      listingType: 'product',
      category: 'Electronics',
      title: 'MacBook Pro M3',
      priceAmount: 1500,
      priceCurrency: 'USDC',
      transactionType: 'fixed',
      actionType: 'checkout',
    });
    expect(parsedCheckoutListing.success).toBe(true);
  });

  it('provides comprehensive presets for housing, jobs, rentals, services, and goods', () => {
    expect(LISTING_PRESETS.housing).toBeDefined();
    expect(LISTING_PRESETS.housing.fields['Bedrooms']).toBe('1');
    expect(LISTING_PRESETS.job).toBeDefined();
    expect(LISTING_PRESETS.job.defaultAction).toBe('application');
    expect(LISTING_PRESETS.rental).toBeDefined();
    expect(LISTING_PRESETS.rental.defaultAction).toBe('booking');
  });

  it('consolidates standalone listing sub-capabilities into unified marketplace', () => {
    // Verified consolidated capability set
    expect(CONSOLIDATED_LISTING_CAPABILITIES.has('housing_property')).toBe(true);
    expect(CONSOLIDATED_LISTING_CAPABILITIES.has('jobs_opportunities')).toBe(true);
    expect(CONSOLIDATED_LISTING_CAPABILITIES.has('rentals_sharing')).toBe(true);
    expect(CONSOLIDATED_LISTING_CAPABILITIES.has('services_bookings')).toBe(true);
    expect(CONSOLIDATED_LISTING_CAPABILITIES.has('listings_discovery')).toBe(true);

    // Marketplace is the unified active capability in the studio catalog
    const allDefs = getAllCapabilityDefinitions();
    expect(allDefs.some((c) => c.key === 'marketplace')).toBe(true);
    for (const legacyKey of CONSOLIDATED_LISTING_CAPABILITIES) {
      expect(allDefs.some((c) => c.key === legacyKey)).toBe(false);
    }

    // Marketplace is configured with the unified navigation
    expect(CAPABILITY_REGISTRY.marketplace.navigation_config.path).toBe('marketplace');
    expect(CAPABILITY_REGISTRY.marketplace.navigation_config.label).toBe('Marketplace');
  });
});
