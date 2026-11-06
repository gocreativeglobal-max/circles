import { describe, expect, it } from 'vitest';
import { formatListingPrice, getActionLabel, LISTING_PRESETS } from '@/features/marketplace/listing-helpers';

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
    expect(getActionLabel('inquiry', 'product')).toBe('Contact & Inquire');
    expect(getActionLabel('booking', 'rental')).toBe('Borrow Item');
    expect(getActionLabel('booking', 'service')).toBe('Book Appointment');
    expect(getActionLabel('application', 'job')).toBe('Apply Now');
    expect(getActionLabel('link', 'housing')).toBe('Visit External Link');
  });

  it('provides comprehensive presets for housing, jobs, rentals, services, and goods', () => {
    expect(LISTING_PRESETS.housing).toBeDefined();
    expect(LISTING_PRESETS.housing.fields['Bedrooms']).toBe('1');
    expect(LISTING_PRESETS.job).toBeDefined();
    expect(LISTING_PRESETS.job.defaultAction).toBe('application');
    expect(LISTING_PRESETS.rental).toBeDefined();
    expect(LISTING_PRESETS.rental.defaultAction).toBe('booking');
  });
});
