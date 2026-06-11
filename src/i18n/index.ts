/**
 * Translation-ready i18n — canonical, app-agnostic. Synced by
 * `sync.mjs app-shell`; do NOT fork per app.
 *
 * Canon § Translations: every v1 ships translation-READY — all user-facing
 * strings live in one externalized module (no copy hardcoded in components),
 * and dates / numbers / currency format through the platform locale APIs.
 * Full per-locale translation is the post-launch step (P7); the *structure*
 * here is the v1 ship gate, and retrofitting it later is the expensive path.
 *
 * How it works:
 *   - `SHELL_STRINGS` (shellStrings.ts) is the canonical, app-agnostic copy
 *     (Settings / About / common actions). Edit it in the factory, not per app.
 *   - `APP_STRINGS` (appStrings.ts, app-owned, ifAbsent) is each app's domain
 *     copy. The two are deep-merged at module load.
 *   - `t('settings.title')` reads a dotted path out of the merged dictionary;
 *     a missing key returns the key itself (visible failure, never a crash).
 *   - `t('list.itemCount', { count: 3 })` interpolates `{count}`.
 *
 * v1 is single-language (English is the build language). The dictionary is
 * intentionally shaped so a locale map drops in later without touching call
 * sites: when translations land (P7), `setLocaleStrings(locale, dict)` swaps
 * the active table. Formatters are already locale-aware today.
 */

import { SHELL_STRINGS } from './shellStrings';
import { APP_STRINGS } from './appStrings';

type Dict = { [key: string]: string | Dict };

function deepMerge(base: Dict, extra: Dict): Dict {
  const out: Dict = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    const cur = out[k];
    if (v && typeof v === 'object' && cur && typeof cur === 'object') {
      out[k] = deepMerge(cur as Dict, v as Dict);
    } else {
      out[k] = v;
    }
  }
  return out;
}

let active: Dict = deepMerge(SHELL_STRINGS as Dict, APP_STRINGS as Dict);

/** Replace the active dictionary (P7 locale switch). Keeps SHELL+APP as the
 *  English base and overlays the locale's translations. */
export function setLocaleStrings(localeDict: Dict): void {
  active = deepMerge(deepMerge(SHELL_STRINGS as Dict, APP_STRINGS as Dict), localeDict);
}

/** Look up a dotted key. Returns the key itself if absent (visible, never throws). */
export function t(key: string, vars?: Record<string, string | number>): string {
  let node: string | Dict | undefined = active;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object') {
      node = (node as Dict)[part];
    } else {
      node = undefined;
      break;
    }
  }
  if (typeof node !== 'string') return key;
  if (!vars) return node;
  return node.replace(/\{(\w+)\}/g, (m, name) =>
    name in vars ? String(vars[name]) : m
  );
}

// ---------- Locale-aware formatting (canon § Translations) ----------
// Hermes ships Intl, so these need no extra dependency. Reading the resolved
// locale from Intl avoids a hard dep on expo-localization; an app that already
// depends on it can pass an explicit locale to override.

/** The device's resolved BCP-47 locale (e.g. "en-US"), with a safe fallback. */
export function getLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
  } catch {
    return 'en-US';
  }
}

export function formatDate(
  value: Date | number,
  opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
  locale = getLocale()
): string {
  try {
    return new Intl.DateTimeFormat(locale, opts).format(value);
  } catch {
    return new Date(value).toDateString();
  }
}

export function formatNumber(
  value: number,
  opts: Intl.NumberFormatOptions = {},
  locale = getLocale()
): string {
  try {
    return new Intl.NumberFormat(locale, opts).format(value);
  } catch {
    return String(value);
  }
}

/** Format a minor-unit integer (cents/pence) or a major-unit number as
 *  currency. Pass `minor: true` to divide by the currency's minor scale. */
export function formatCurrency(
  amount: number,
  currency: string,
  locale = getLocale()
): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}
