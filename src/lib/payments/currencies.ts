/**
 * Currencies accepted and supported by Bachs (https://bachs.io).
 * Includes global cards (USD, EUR, GBP, CAD), African bank transfers & mobile money
 * (NGN, GHS, KES, ZAR, UGX, TZS, RWF, ZMW), and crypto stablecoins (USDT, USDC).
 */

export interface BachsCurrencyDefinition {
  code: string;
  name: string;
  symbol: string;
  category: 'fiat_global' | 'fiat_african' | 'stablecoin';
  paymentMethodsDescription: string;
  zeroDecimal?: boolean;
}

export const BACHS_ACCEPTED_CURRENCIES: BachsCurrencyDefinition[] = [
  {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    category: 'fiat_global',
    paymentMethodsDescription: 'Global Cards, ACH & Wire',
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
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    category: 'fiat_global',
    paymentMethodsDescription: 'Global Cards & SEPA',
  },
  {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    category: 'fiat_global',
    paymentMethodsDescription: 'Global Cards & Faster Payments',
  },
  {
    code: 'CAD',
    name: 'Canadian Dollar',
    symbol: 'CA$',
    category: 'fiat_global',
    paymentMethodsDescription: 'Cards & EFT/Interac',
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

const CURRENCY_MAP = new Map<string, BachsCurrencyDefinition>(
  BACHS_ACCEPTED_CURRENCIES.map((c) => [c.code.toUpperCase(), c])
);

export function isBachsSupportedCurrency(code: string): boolean {
  if (!code) return false;
  return CURRENCY_MAP.has(code.trim().toUpperCase());
}

export function getBachsCurrency(code: string): BachsCurrencyDefinition {
  const found = CURRENCY_MAP.get(code?.trim().toUpperCase());
  if (found) return found;
  return {
    code: code?.toUpperCase() || 'USD',
    name: code?.toUpperCase() || 'USD',
    symbol: code?.toUpperCase() || '$',
    category: 'fiat_global',
    paymentMethodsDescription: 'Bachs Payment',
  };
}

export function formatBachsAmount(amountCents: number, currencyCode: string): string {
  const currency = getBachsCurrency(currencyCode);
  const amount = amountCents / 100;
  
  // Format with thousands separator
  const hasDecimals = amount % 1 !== 0;
  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);

  return `${currency.symbol}${formattedNumber} ${currency.code !== 'USD' && currency.code !== 'EUR' && currency.code !== 'GBP' ? currency.code : ''}`.trim();
}
