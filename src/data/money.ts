/**
 * Minor-unit money helpers — part of the budget app's TRUST CORE. Every amount
 * is stored as an integer count of the currency's minor unit (cents, pence,
 * yen) so arithmetic is exact: floats are never used for money. A bug here
 * silently corrupts every figure the user sees, so this file is pure (no expo /
 * RN imports) and unit-tested directly.
 *
 * The minor scale (100 for USD/EUR, 1 for JPY, 1000 for some Gulf currencies)
 * is derived from the platform Intl data so we don't hardcode a table; Hermes
 * and Node both ship Intl.
 */

/** Decimal places the currency uses (2 for USD, 0 for JPY). Falls back to 2. */
export function currencyFractionDigits(currency: string): number {
  try {
    const opts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).resolvedOptions();
    return opts.maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** 10 ** fractionDigits — e.g. 100 for USD, 1 for JPY. */
export function minorScale(currency: string): number {
  return 10 ** currencyFractionDigits(currency);
}

/** Parse a typed major-unit amount ("12.34", "12,34", "1 200") into an integer
 *  count of minor units for `currency`. Returns null on a non-numeric string so
 *  the caller can disable Save rather than store garbage. Rounds (never floors)
 *  so 0.1 + 0.2 style float drift can't lose a cent. */
export function parseAmountToMinor(text: string, currency: string): number | null {
  const cleaned = text
    .replace(/\s/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '.' || cleaned === '-') return null;
  const major = Number(cleaned);
  if (!Number.isFinite(major)) return null;
  return Math.round(major * minorScale(currency));
}

/** Integer minor units back to a major-unit number for display formatting
 *  (the i18n formatCurrency takes a major value). Exact for any in-range int. */
export function minorToMajor(minor: number, currency: string): number {
  return minor / minorScale(currency);
}

// Region -> ISO-4217 for the common store markets. Intl has no locale->currency
// map, so this is a best-effort first-launch default the user can change in
// Settings. Fallback USD.
const REGION_CURRENCY: Record<string, string> = {
  US: 'USD', GB: 'GBP', JP: 'JPY', CN: 'CNY', IN: 'INR', CA: 'CAD', AU: 'AUD',
  NZ: 'NZD', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK',
  HU: 'HUF', RU: 'RUB', BR: 'BRL', MX: 'MXN', AR: 'ARS', CL: 'CLP', CO: 'COP',
  ZA: 'ZAR', TR: 'TRY', KR: 'KRW', SG: 'SGD', HK: 'HKD', TW: 'TWD', TH: 'THB',
  ID: 'IDR', MY: 'MYR', PH: 'PHP', VN: 'VND', AE: 'AED', SA: 'SAR', IL: 'ILS',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', PT: 'EUR',
  AT: 'EUR', BE: 'EUR', FI: 'EUR', GR: 'EUR', SK: 'EUR', SI: 'EUR', LU: 'EUR',
};

/** Best-effort currency for a BCP-47 locale (e.g. "en-GB" -> "GBP"). USD if
 *  the region is unknown or absent. */
export function defaultCurrencyForLocale(locale: string): string {
  const region = locale.split('-')[1]?.toUpperCase();
  return (region && REGION_CURRENCY[region]) || 'USD';
}
