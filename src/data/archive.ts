/**
 * Full-state JSON archive (canon § Backup & restore Layer 3) + per-record merge
 * (spec § Backup & sync: merge by id, newer updatedAt wins, tombstones honored —
 * NOT file-level last-write-wins, so two devices that both added offline keep
 * both sets). Pure + unit-tested: this is what makes a restore non-destructive.
 */

import {
  type Account,
  type Category,
  type RecurringRule,
  type Settings,
  type Transaction,
  type TxKind,
} from './budget';
import { makeId } from '../lib/id';

export const SCHEMA_VERSION = 1;

export interface BudgetSnapshot {
  schema: number;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  settings: Partial<Settings>;
}

export function buildSnapshot(state: {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  settings: Settings;
}): BudgetSnapshot {
  return {
    schema: SCHEMA_VERSION,
    accounts: state.accounts,
    categories: state.categories,
    transactions: state.transactions,
    recurringRules: state.recurringRules,
    settings: state.settings,
  };
}

// ---------- sanitizers (coerce untrusted parsed objects, preserve ids) ----------

function obj(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
}
function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}
function int(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
}
function bool(v: unknown): boolean {
  return v === true;
}
function kindOf(v: unknown): TxKind {
  return v === 'income' ? 'income' : 'expense';
}
function id(v: unknown, prefix: string): string {
  return typeof v === 'string' && v ? v : makeId(prefix);
}
const now = () => Date.now();

export function sanitizeAccount(raw: unknown): Account | null {
  const r = obj(raw);
  if (!r || typeof r.name !== 'string') return null;
  return {
    id: id(r.id, 'a'),
    name: r.name,
    startingBalanceMinor: int(r.startingBalanceMinor),
    colorToken: str(r.colorToken, 'cat-1'),
    sortOrder: int(r.sortOrder),
    archived: bool(r.archived),
    createdAt: int(r.createdAt, now()),
    updatedAt: int(r.updatedAt, now()),
    deletedAt: typeof r.deletedAt === 'number' ? r.deletedAt : undefined,
  };
}

export function sanitizeCategory(raw: unknown): Category | null {
  const r = obj(raw);
  if (!r || typeof r.name !== 'string') return null;
  return {
    id: id(r.id, 'c'),
    name: r.name,
    kind: kindOf(r.kind),
    icon: str(r.icon, 'tag'),
    colorToken: str(r.colorToken, 'cat-1'),
    sortOrder: int(r.sortOrder),
    hidden: bool(r.hidden),
    createdAt: int(r.createdAt, now()),
    updatedAt: int(r.updatedAt, now()),
    deletedAt: typeof r.deletedAt === 'number' ? r.deletedAt : undefined,
  };
}

export function sanitizeTransaction(raw: unknown): Transaction | null {
  const r = obj(raw);
  if (!r) return null;
  const amt = int(r.amountMinor, NaN);
  if (!Number.isFinite(amt)) return null;
  const occurredAt = str(r.occurredAt);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredAt)) return null;
  return {
    id: id(r.id, 't'),
    kind: kindOf(r.kind),
    amountMinor: Math.abs(amt),
    accountId: str(r.accountId),
    categoryId: str(r.categoryId),
    occurredAt,
    note: typeof r.note === 'string' && r.note ? r.note : undefined,
    recurringRuleId: typeof r.recurringRuleId === 'string' ? r.recurringRuleId : undefined,
    createdAt: int(r.createdAt, now()),
    updatedAt: int(r.updatedAt, now()),
    deletedAt: typeof r.deletedAt === 'number' ? r.deletedAt : undefined,
  };
}

export function sanitizeRecurringRule(raw: unknown): RecurringRule | null {
  const r = obj(raw);
  if (!r) return null;
  const amt = int(r.amountMinor, NaN);
  if (!Number.isFinite(amt)) return null;
  const startDate = str(r.startDate);
  const nextDueDate = str(r.nextDueDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)) return null;
  const freq = r.frequency;
  const frequency =
    freq === 'daily' || freq === 'weekly' || freq === 'monthly' || freq === 'yearly'
      ? freq
      : 'monthly';
  return {
    id: id(r.id, 'r'),
    kind: kindOf(r.kind),
    amountMinor: Math.abs(amt),
    accountId: str(r.accountId),
    categoryId: str(r.categoryId),
    note: typeof r.note === 'string' && r.note ? r.note : undefined,
    frequency,
    interval: Math.max(1, int(r.interval, 1)),
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : nextDueDate,
    nextDueDate,
    paused: bool(r.paused),
    createdAt: int(r.createdAt, now()),
    updatedAt: int(r.updatedAt, now()),
    deletedAt: typeof r.deletedAt === 'number' ? r.deletedAt : undefined,
  };
}

export function sanitizeSnapshot(raw: unknown): BudgetSnapshot {
  const r = obj(raw) ?? {};
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const settingsRaw = obj(r.settings) ?? {};
  return {
    schema: int(r.schema, SCHEMA_VERSION),
    accounts: arr(r.accounts).map(sanitizeAccount).filter((x): x is Account => x != null),
    categories: arr(r.categories).map(sanitizeCategory).filter((x): x is Category => x != null),
    transactions: arr(r.transactions)
      .map(sanitizeTransaction)
      .filter((x): x is Transaction => x != null),
    recurringRules: arr(r.recurringRules)
      .map(sanitizeRecurringRule)
      .filter((x): x is RecurringRule => x != null),
    settings: {
      currencyCode: typeof settingsRaw.currencyCode === 'string' ? settingsRaw.currencyCode : undefined,
      defaultCategoryId:
        typeof settingsRaw.defaultCategoryId === 'string' ? settingsRaw.defaultCategoryId : undefined,
      defaultAccountId:
        typeof settingsRaw.defaultAccountId === 'string' ? settingsRaw.defaultAccountId : undefined,
      theme:
        settingsRaw.theme === 'light' || settingsRaw.theme === 'dark' || settingsRaw.theme === 'system'
          ? settingsRaw.theme
          : undefined,
    },
  };
}

// ---------- per-record merge ----------

interface Versioned {
  id: string;
  updatedAt: number;
  deletedAt?: number;
}

/** Merge `incoming` into `local` by id: a record present only on one side is
 *  kept; a record on both sides keeps the newer updatedAt (a tombstoned winner
 *  stays as a tombstone, so a delete propagates instead of resurrecting). */
export function mergeById<T extends Versioned>(local: T[], incoming: T[]): T[] {
  const byId = new Map<string, T>();
  for (const rec of local) byId.set(rec.id, rec);
  for (const rec of incoming) {
    const cur = byId.get(rec.id);
    if (!cur || rec.updatedAt >= cur.updatedAt) byId.set(rec.id, rec);
  }
  return [...byId.values()];
}
