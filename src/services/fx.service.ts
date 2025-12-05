/**
 * FX (Foreign Exchange) Service
 * Handles currency conversion and rate management
 */

import { FxRate, Money, Currency } from "../models/budget.models";

// In-memory cache for FX rates (in production, use Redis or database)
const fxRateCache: Map<string, FxRate> = new Map();

// Default rates (fallback when API is unavailable)
const DEFAULT_RATES: Record<string, number> = {
  "USD_AED": 3.67,
  "INR_AED": 0.044,
  "EUR_AED": 3.98,
  "GBP_AED": 4.64,
  "AED_USD": 0.27,
  "AED_INR": 22.73,
  "AED_EUR": 0.25,
  "AED_GBP": 0.22,
  "USD_INR": 83.5,
  "INR_USD": 0.012,
};

/**
 * Get cache key for currency pair
 */
function getCacheKey(from: Currency, to: Currency): string {
  return `${from}_${to}`;
}

/**
 * Fetch FX rate from external API (e.g., exchangerate-api.com)
 * Falls back to default rates if API is unavailable
 */
export async function fetchFxRate(
  from: Currency,
  to: Currency
): Promise<FxRate> {
  const cacheKey = getCacheKey(from, to);

  // Check cache first (rates are valid for 1 hour)
  const cached = fxRateCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp.getTime() < 3600000) {
    return cached;
  }

  // Same currency
  if (from === to) {
    const rate: FxRate = {
      id: `fx_${from}_${to}_${Date.now()}`,
      from,
      to,
      rate: 1,
      timestamp: new Date(),
    };
    fxRateCache.set(cacheKey, rate);
    return rate;
  }

  try {
    // Try to fetch from external API
    const response = await fetch(
      `https://api.exchangerate-api.com/v4/latest/${from}`
    );

    if (response.ok) {
      const data = (await response.json()) as { rates: Record<string, number> };
      const rate: FxRate = {
        id: `fx_${from}_${to}_${Date.now()}`,
        from,
        to,
        rate: data.rates[to] || DEFAULT_RATES[cacheKey] || 1,
        timestamp: new Date(),
      };
      fxRateCache.set(cacheKey, rate);
      return rate;
    }
  } catch (error) {
    console.warn(`Failed to fetch FX rate for ${from}/${to}, using default`);
  }

  // Fallback to default rates
  const defaultRate = DEFAULT_RATES[cacheKey] || 1;
  const rate: FxRate = {
    id: `fx_${from}_${to}_${Date.now()}`,
    from,
    to,
    rate: defaultRate,
    timestamp: new Date(),
  };
  fxRateCache.set(cacheKey, rate);
  return rate;
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency
): Promise<{ convertedAmount: number; fxRate: FxRate }> {
  const fxRate = await fetchFxRate(from, to);
  const convertedAmount = amount * fxRate.rate;
  return { convertedAmount, fxRate };
}

/**
 * Create a Money object with base currency conversion
 */
export async function createMoney(
  amount: number,
  currency: Currency,
  baseCurrency: Currency
): Promise<Money> {
  const { convertedAmount, fxRate } = await convertCurrency(
    amount,
    currency,
    baseCurrency
  );

  return {
    amount,
    currency,
    baseAmount: convertedAmount,
    fxRate: fxRate.rate,
    fxTimestamp: fxRate.timestamp,
  };
}

/**
 * Get all cached FX rates
 */
export function getAllCachedRates(): FxRate[] {
  return Array.from(fxRateCache.values());
}

/**
 * Clear FX rate cache
 */
export function clearFxCache(): void {
  fxRateCache.clear();
}

/**
 * Manually set an FX rate (useful for testing)
 */
export function setFxRate(from: Currency, to: Currency, rate: number): FxRate {
  const fxRate: FxRate = {
    id: `fx_${from}_${to}_${Date.now()}`,
    from,
    to,
    rate,
    timestamp: new Date(),
  };
  fxRateCache.set(getCacheKey(from, to), fxRate);
  return fxRate;
}
