/**
 * Universal Currency Definitions & Multi-Currency Formatting.
 * Supports global currencies (USD, EUR, GBP, CAD, AUD, JPY, CHF, etc.),
 * regional currencies (NGN, GHS, KES, ZAR, UGX, TZS, RWF, ZMW, etc.),
 * and crypto stablecoins (USDT, USDC).
 */

export interface CurrencyDefinition {
  code: string;
  name: string;
  symbol: string;
  category?: 'fiat_global' | 'fiat_african' | 'stablecoin' | string;
  paymentMethodsDescription?: string;
  zeroDecimal?: boolean;
}

// Backward-compatibility alias
export type BachsCurrencyDefinition = CurrencyDefinition;

export const SUPPORTED_CURRENCIES: CurrencyDefinition[] = [
  {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    category: 'fiat_global',
    paymentMethodsDescription: 'Cards, ACH & Wire',
  },
  {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    category: 'fiat_global',
    paymentMethodsDescription: 'Cards & SEPA',
  },
  {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    category: 'fiat_global',
    paymentMethodsDescription: 'Cards & Faster Payments',
  },
  {
    code: 'NGN',
    name: 'Nigerian Naira',
    symbol: '₦',
    category: 'fiat_african',
    paymentMethodsDescription: 'Bank Transfers, Virtual Accounts & Cards',
  },
  {
    code: 'GHS',
    name: 'Ghanaian Cedi',
    symbol: 'GH₵',
    category: 'fiat_african',
    paymentMethodsDescription: 'MTN & Telecel Mobile Money, Cards',
  },
  {
    code: 'KES',
    name: 'Kenyan Shilling',
    symbol: 'KSh',
    category: 'fiat_african',
    paymentMethodsDescription: 'M-Pesa & Airtel Money, Cards',
  },
  {
    code: 'ZAR',
    name: 'South African Rand',
    symbol: 'R',
    category: 'fiat_african',
    paymentMethodsDescription: 'Cards & Instant EFT',
  },
  {
    code: 'CAD',
    name: 'Canadian Dollar',
    symbol: 'CA$',
    category: 'fiat_global',
    paymentMethodsDescription: 'Cards & EFT/Interac',
  },
  {
    code: 'AUD',
    name: 'Australian Dollar',
    symbol: 'A$',
    category: 'fiat_global',
    paymentMethodsDescription: 'Cards & Direct Entry',
  },
  {
    code: 'JPY',
    name: 'Japanese Yen',
    symbol: '¥',
    category: 'fiat_global',
    paymentMethodsDescription: 'Cards & Bank Transfer',
    zeroDecimal: true,
  },
  {
    code: 'INR',
    name: 'Indian Rupee',
    symbol: '₹',
    category: 'fiat_global',
    paymentMethodsDescription: 'UPI, NetBanking & Cards',
  },
  {
    code: 'BRL',
    name: 'Brazilian Real',
    symbol: 'R$',
    category: 'fiat_global',
    paymentMethodsDescription: 'Pix & Cards',
  },
  {
    code: 'CHF',
    name: 'Swiss Franc',
    symbol: 'CHF',
    category: 'fiat_global',
    paymentMethodsDescription: 'Cards & Bank Wire',
  },
  {
    code: 'AED',
    name: 'UAE Dirham',
    symbol: 'AED',
    category: 'fiat_global',
    paymentMethodsDescription: 'Cards & Bank Transfer',
  },
  {
    code: 'UGX',
    name: 'Ugandan Shilling',
    symbol: 'USh',
    category: 'fiat_african',
    paymentMethodsDescription: 'Mobile Money & Bank Transfer',
  },
  {
    code: 'TZS',
    name: 'Tanzanian Shilling',
    symbol: 'TSh',
    category: 'fiat_african',
    paymentMethodsDescription: 'Mobile Money & Local Bank Transfer',
  },
  {
    code: 'RWF',
    name: 'Rwandan Franc',
    symbol: 'FRw',
    category: 'fiat_african',
    paymentMethodsDescription: 'MTN & Airtel Mobile Money',
  },
  {
    code: 'ZMW',
    name: 'Zambian Kwacha',
    symbol: 'ZK',
    category: 'fiat_african',
    paymentMethodsDescription: 'Mobile Money & Cards',
  },
  {
    code: 'USDT',
    name: 'Tether USD',
    symbol: '₮',
    category: 'stablecoin',
    paymentMethodsDescription: 'USDT Stablecoin (TRC20, ERC20, Polygon)',
  },
  {
    code: 'USDC',
    name: 'USD Coin',
    symbol: 'USDC',
    category: 'stablecoin',
    paymentMethodsDescription: 'USDC Stablecoin (Solana, ERC20, Polygon)',
  },
];

// Backward compatibility export
export const BACHS_ACCEPTED_CURRENCIES: CurrencyDefinition[] = SUPPORTED_CURRENCIES;

const CURRENCY_MAP = new Map<string, CurrencyDefinition>(
  SUPPORTED_CURRENCIES.map((c) => [c.code.toUpperCase(), c])
);

/**
 * Checks whether a currency code is supported.
 */
export function isValidCurrency(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  return CURRENCY_MAP.has(code.trim().toUpperCase());
}

// Backward compatibility alias
export const isBachsSupportedCurrency = isValidCurrency;

/**
 * Retrieves currency metadata with safe fallback.
 */
export function getCurrency(code: string): CurrencyDefinition {
  if (!code) {
    return {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      category: 'fiat_global',
      paymentMethodsDescription: 'Standard Payment',
    };
  }
  const upper = code.trim().toUpperCase();
  const found = CURRENCY_MAP.get(upper);
  if (found) return found;
  return {
    code: upper,
    name: upper,
    symbol: upper,
    category: 'fiat_global',
    paymentMethodsDescription: 'Payment',
  };
}

// Backward compatibility alias
export const getBachsCurrency = getCurrency;

/**
 * Formats a single currency amount from cents (or whole units for zero-decimal currencies).
 */
export function formatCurrencyAmount(amountCents: number, currencyCode: string): string {
  const currency = getCurrency(currencyCode);
  const amount = currency.zeroDecimal ? amountCents : amountCents / 100;

  const hasDecimals = amount % 1 !== 0;
  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: hasDecimals && !currency.zeroDecimal ? 2 : 0,
    maximumFractionDigits: currency.zeroDecimal ? 0 : 2,
  }).format(amount);

  const isCommonSymbolOnly = ['USD', 'EUR', 'GBP'].includes(currency.code);
  return `${currency.symbol}${formattedNumber}${isCommonSymbolOnly ? '' : ` ${currency.code}`}`.trim();
}

// Backward compatibility alias
export const formatBachsAmount = formatCurrencyAmount;

/**
 * Formats multi-currency price combinations into a readable string.
 * E.g. "$50.00 (also ₦75,000 NGN, €45.00 EUR)"
 */
export function formatMultiCurrencyPrices(
  primaryAmountCents: number,
  primaryCurrency: string,
  extraCurrencyPrices?: Record<string, number> | null
): string {
  const primaryFormatted = formatCurrencyAmount(primaryAmountCents, primaryCurrency);
  if (!extraCurrencyPrices || typeof extraCurrencyPrices !== 'object') {
    return primaryFormatted;
  }

  const extraEntries = Object.entries(extraCurrencyPrices)
    .filter(([code, val]) => code.toUpperCase() !== primaryCurrency.toUpperCase() && typeof val === 'number' && val > 0);

  if (extraEntries.length === 0) {
    return primaryFormatted;
  }

  const extraFormatted = extraEntries
    .map(([code, val]) => formatCurrencyAmount(val, code))
    .join(', ');

  return `${primaryFormatted} (${extraFormatted})`;
}
