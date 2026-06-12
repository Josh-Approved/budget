/**
 * Budget domain model + money math — the app's TRUST CORE. A bug here silently
 * corrupts every balance, total, and chart slice the user sees, so this file is
 * kept pure (no expo / RN imports) and unit-tested directly
 * (src/data/__tests__/budget.test.ts). Amounts are integer minor units
 * (see money.ts); dates are 'YYYY-MM-DD' strings (see dates.ts).
 */

import { makeId } from '../lib/id';
import { inRange, tsToDateStr, type PeriodType } from './dates';

export type TxKind = 'expense' | 'income';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Account {
  id: string;
  name: string;
  startingBalanceMinor: number;
  colorToken: string;
  sortOrder: number;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface Category {
  id: string;
  name: string;
  kind: TxKind;
  icon: string; // Lucide icon name
  colorToken: string;
  sortOrder: number;
  hidden: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface Transaction {
  id: string;
  kind: TxKind;
  amountMinor: number; // always stored positive; `kind` carries the sign
  accountId: string;
  categoryId: string;
  occurredAt: string; // 'YYYY-MM-DD' (local date, no time)
  note?: string;
  recurringRuleId?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface RecurringRule {
  id: string;
  kind: TxKind;
  amountMinor: number;
  accountId: string;
  categoryId: string;
  note?: string;
  frequency: Frequency;
  interval: number; // every N of `frequency`
  startDate: string; // 'YYYY-MM-DD'
  nextDueDate: string; // 'YYYY-MM-DD', advanced after each materialization
  paused: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface Settings {
  currencyCode: string;
  defaultCategoryId?: string;
  defaultAccountId?: string;
  theme: 'system' | 'light' | 'dark';
}

// ---------- Constructors ----------

export function makeAccount(
  name: string,
  startingBalanceMinor = 0,
  colorToken = 'cat-1',
  sortOrder = 0
): Account {
  const now = Date.now();
  return {
    id: makeId('a'),
    name: name.trim() || 'Account',
    startingBalanceMinor: Math.round(startingBalanceMinor) || 0,
    colorToken,
    sortOrder,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function makeCategory(
  name: string,
  kind: TxKind,
  icon: string,
  colorToken: string,
  sortOrder = 0
): Category {
  const now = Date.now();
  return {
    id: makeId('c'),
    name: name.trim() || 'Category',
    kind,
    icon,
    colorToken,
    sortOrder,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function makeTransaction(input: {
  kind: TxKind;
  amountMinor: number;
  accountId: string;
  categoryId: string;
  occurredAt?: string;
  note?: string;
  recurringRuleId?: string;
}): Transaction {
  const now = Date.now();
  const amt = Number.isFinite(input.amountMinor) ? Math.abs(Math.round(input.amountMinor)) : 0;
  return {
    id: makeId('t'),
    kind: input.kind,
    amountMinor: amt,
    accountId: input.accountId,
    categoryId: input.categoryId,
    occurredAt: input.occurredAt ?? tsToDateStr(now),
    note: input.note?.trim() ? input.note.trim() : undefined,
    recurringRuleId: input.recurringRuleId,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------- Active-set filters (tombstone / hidden / archived aware) ----------

export function activeTransactions(txns: Transaction[]): Transaction[] {
  return txns.filter((t) => t.deletedAt == null);
}

export function activeAccounts(accounts: Account[]): Account[] {
  return accounts
    .filter((a) => a.deletedAt == null && !a.archived)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function activeCategories(categories: Category[], kind?: TxKind): Category[] {
  return categories
    .filter((c) => c.deletedAt == null && !c.hidden && (kind ? c.kind === kind : true))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// ---------- Money math ----------

/** Signed minor amount of a transaction: income adds, expense subtracts. */
export function signedMinor(t: Transaction): number {
  return t.kind === 'income' ? t.amountMinor : -t.amountMinor;
}

/** Current balance of one account: opening balance + every active transaction
 *  on it (income positive, expense negative). */
export function accountBalanceMinor(account: Account, txns: Transaction[]): number {
  return activeTransactions(txns)
    .filter((t) => t.accountId === account.id)
    .reduce((sum, t) => sum + signedMinor(t), account.startingBalanceMinor);
}

/** Net worth across the given accounts (their balances summed). */
export function totalBalanceMinor(accounts: Account[], txns: Transaction[]): number {
  return accounts.reduce((sum, a) => sum + accountBalanceMinor(a, txns), 0);
}

/** Active transactions inside [from, to), optionally scoped to one account,
 *  newest first (ties broken by createdAt so same-day order is stable). */
export function transactionsInRange(
  txns: Transaction[],
  from: string,
  to: string,
  accountId?: string
): Transaction[] {
  return activeTransactions(txns)
    .filter((t) => inRange(t.occurredAt, from, to))
    .filter((t) => (accountId ? t.accountId === accountId : true))
    .sort((a, b) =>
      a.occurredAt === b.occurredAt ? b.createdAt - a.createdAt : a.occurredAt < b.occurredAt ? 1 : -1
    );
}

export interface PeriodTotals {
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
}

/** Income / expense / net (minor units) over a set of transactions. */
export function periodTotals(txns: Transaction[]): PeriodTotals {
  let incomeMinor = 0;
  let expenseMinor = 0;
  for (const t of activeTransactions(txns)) {
    if (t.kind === 'income') incomeMinor += t.amountMinor;
    else expenseMinor += t.amountMinor;
  }
  return { incomeMinor, expenseMinor, netMinor: incomeMinor - expenseMinor };
}

export interface BreakdownSlice {
  categoryId: string;
  name: string;
  icon: string;
  colorToken: string;
  totalMinor: number;
  fraction: number; // 0..1 of the breakdown total
}

/** Category breakdown for the chart: sums one kind (expenses by default) by
 *  category over the given transactions, largest first, with each slice's
 *  fraction of the total. Unknown categories fall back to a generic slice so a
 *  deleted-category transaction is never dropped from the totals. */
export function categoryBreakdown(
  txns: Transaction[],
  categories: Category[],
  kind: TxKind = 'expense'
): BreakdownSlice[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const sums = new Map<string, number>();
  for (const t of activeTransactions(txns)) {
    if (t.kind !== kind) continue;
    sums.set(t.categoryId, (sums.get(t.categoryId) ?? 0) + t.amountMinor);
  }
  const total = [...sums.values()].reduce((a, b) => a + b, 0);
  const slices: BreakdownSlice[] = [];
  for (const [categoryId, totalMinor] of sums) {
    const cat = byId.get(categoryId);
    slices.push({
      categoryId,
      name: cat?.name ?? 'Uncategorized',
      icon: cat?.icon ?? 'circle',
      colorToken: cat?.colorToken ?? 'cat-1',
      totalMinor,
      fraction: total > 0 ? totalMinor / total : 0,
    });
  }
  return slices.sort((a, b) => b.totalMinor - a.totalMinor);
}

// ---------- Search ----------

/** Filter transactions whose note OR category name contains `query`
 *  (case-insensitive). Empty query returns the input unchanged. */
export function searchTransactions(
  txns: Transaction[],
  query: string,
  categories: Category[]
): Transaction[] {
  const q = query.trim().toLowerCase();
  if (!q) return txns;
  const nameById = new Map(categories.map((c) => [c.id, c.name.toLowerCase()]));
  return txns.filter((t) => {
    const note = t.note?.toLowerCase() ?? '';
    const cat = nameById.get(t.categoryId) ?? '';
    return note.includes(q) || cat.includes(q);
  });
}

// ---------- Day grouping (for the transaction list) ----------

export interface DayGroup {
  dateStr: string;
  transactions: Transaction[];
  netMinor: number;
}

/** Group transactions by their occurredAt day, newest day first, each day's
 *  rows already newest-first and a per-day net. */
export function groupByDay(txns: Transaction[]): DayGroup[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of activeTransactions(txns)) {
    const arr = groups.get(t.occurredAt) ?? [];
    arr.push(t);
    groups.set(t.occurredAt, arr);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([dateStr, rows]) => ({
      dateStr,
      transactions: rows.sort((a, b) => b.createdAt - a.createdAt),
      netMinor: rows.reduce((s, t) => s + signedMinor(t), 0),
    }));
}

// ---------- Period label ----------

export function periodLabel(type: PeriodType, from: string, locale = 'en-US'): string {
  const d = new Date(`${from}T12:00:00`);
  try {
    switch (type) {
      case 'day':
        return new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }).format(d);
      case 'week':
        return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(d);
      case 'month':
        return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d);
      case 'year':
        return new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(d);
    }
  } catch {
    return from;
  }
}
