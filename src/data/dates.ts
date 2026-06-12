/**
 * Calendar helpers for the budget app's period views — part of the TRUST CORE.
 * Dates are handled as local 'YYYY-MM-DD' strings, never timestamps: that makes
 * range math timezone-free (a transaction dated the 1st is in January no matter
 * the device offset) and means lexicographic string compare IS chronological
 * compare. Pure (no expo / RN) so the period ranges are unit-tested directly.
 */

export type PeriodType = 'day' | 'week' | 'month' | 'year';

/** Local 'YYYY-MM-DD' for a ms timestamp (defaults to now's clock). */
export function tsToDateStr(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a 'YYYY-MM-DD' string to a local Date at noon (noon dodges DST edges). */
export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

function fmt(d: Date): string {
  return tsToDateStr(d.getTime());
}

export function addDays(dateStr: string, n: number): string {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + n);
  return fmt(d);
}

export function addMonths(dateStr: string, n: number): string {
  const d = parseDateStr(dateStr);
  const targetMonth = d.getMonth() + n;
  const anchorDay = d.getDate();
  d.setDate(1);
  d.setMonth(targetMonth);
  // clamp to the last valid day (e.g. Jan 31 + 1 month -> Feb 28/29)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(anchorDay, lastDay));
  return fmt(d);
}

export function addYears(dateStr: string, n: number): string {
  return addMonths(dateStr, n * 12);
}

/** Monday-start week by default (weekStartsOn: 0 = Sunday, 1 = Monday). */
export function startOfWeek(dateStr: string, weekStartsOn = 1): string {
  const d = parseDateStr(dateStr);
  const day = d.getDay(); // 0 = Sun
  const diff = (day - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return fmt(d);
}

export function startOfMonth(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

export function startOfYear(dateStr: string): string {
  return `${dateStr.slice(0, 4)}-01-01`;
}

/** [from, to) date-string bounds for a period type at an offset from the anchor
 *  (offset 0 = the period containing the anchor, -1 = the previous one). */
export function periodRange(
  type: PeriodType,
  anchorDateStr: string,
  offset = 0,
  weekStartsOn = 1
): [string, string] {
  switch (type) {
    case 'day': {
      const from = addDays(anchorDateStr, offset);
      return [from, addDays(from, 1)];
    }
    case 'week': {
      const base = startOfWeek(anchorDateStr, weekStartsOn);
      const from = addDays(base, offset * 7);
      return [from, addDays(from, 7)];
    }
    case 'month': {
      const base = startOfMonth(anchorDateStr);
      const from = addMonths(base, offset);
      return [from, addMonths(from, 1)];
    }
    case 'year': {
      const base = startOfYear(anchorDateStr);
      const from = addYears(base, offset);
      return [from, addYears(from, 1)];
    }
  }
}

/** Is `dateStr` inside [from, to)? (string compare = date compare here). */
export function inRange(dateStr: string, from: string, to: string): boolean {
  return dateStr >= from && dateStr < to;
}
