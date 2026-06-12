/**
 * Display formatting for money. The pure trust core stores integer minor units;
 * this turns one into a locale-formatted currency string for the UI via the
 * shell's locale-aware formatCurrency (canon § Translations — numbers/currency
 * format through the platform locale APIs).
 */

import { formatCurrency, getLocale } from '../i18n';
import { minorToMajor } from '../data/money';

export function formatMinor(minor: number, currency: string, locale = getLocale()): string {
  return formatCurrency(minorToMajor(minor, currency), currency, locale);
}

/** Signed display for a net figure: "+$12.00" / "-$4.50". */
export function formatSignedMinor(minor: number, currency: string, locale = getLocale()): string {
  const sign = minor > 0 ? '+' : '';
  return sign + formatMinor(minor, currency, locale);
}

/** The currency's symbol for the locale ("$", "£", "¥") for the keypad display;
 *  falls back to the ISO code. */
export function currencySymbol(currency: string, locale = getLocale()): string {
  try {
    const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}
