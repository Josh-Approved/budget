/**
 * Domain SQLite persistence for the budget app. Opens the SAME connection the
 * shell's storage/kv.ts owns (one file, one backup unit — canon § Backup
 * Layer 1) and adds the four domain tables. Rows are soft-deleted (deletedAt
 * set, row kept) so a delete propagates through per-record merge instead of
 * resurrecting; the in-memory active* filters hide tombstoned rows. Writes are
 * fire-and-forget; hydrate() awaits the initial load once at app start.
 */

import { getDb } from '../storage/kv';
import type { Account, Category, RecurringRule, Transaction } from '../data/budget';

let _ready: Promise<void> | null = null;

async function ensureTables(): Promise<void> {
  if (_ready) return _ready;
  _ready = (async () => {
    const db = await getDb();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS accounts (
        id                   TEXT PRIMARY KEY NOT NULL,
        name                 TEXT NOT NULL,
        startingBalanceMinor INTEGER NOT NULL,
        colorToken           TEXT NOT NULL,
        sortOrder            INTEGER NOT NULL,
        archived             INTEGER NOT NULL,
        createdAt            INTEGER NOT NULL,
        updatedAt            INTEGER NOT NULL,
        deletedAt            INTEGER
      );
      CREATE TABLE IF NOT EXISTS categories (
        id         TEXT PRIMARY KEY NOT NULL,
        name       TEXT NOT NULL,
        kind       TEXT NOT NULL,
        icon       TEXT NOT NULL,
        colorToken TEXT NOT NULL,
        sortOrder  INTEGER NOT NULL,
        hidden     INTEGER NOT NULL,
        createdAt  INTEGER NOT NULL,
        updatedAt  INTEGER NOT NULL,
        deletedAt  INTEGER
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id              TEXT PRIMARY KEY NOT NULL,
        kind            TEXT NOT NULL,
        amountMinor     INTEGER NOT NULL,
        accountId       TEXT NOT NULL,
        categoryId      TEXT NOT NULL,
        occurredAt      TEXT NOT NULL,
        note            TEXT,
        recurringRuleId TEXT,
        createdAt       INTEGER NOT NULL,
        updatedAt       INTEGER NOT NULL,
        deletedAt       INTEGER
      );
      CREATE TABLE IF NOT EXISTS recurring_rules (
        id           TEXT PRIMARY KEY NOT NULL,
        kind         TEXT NOT NULL,
        amountMinor  INTEGER NOT NULL,
        accountId    TEXT NOT NULL,
        categoryId   TEXT NOT NULL,
        note         TEXT,
        frequency    TEXT NOT NULL,
        interval     INTEGER NOT NULL,
        startDate    TEXT NOT NULL,
        nextDueDate  TEXT NOT NULL,
        paused       INTEGER NOT NULL,
        createdAt    INTEGER NOT NULL,
        updatedAt    INTEGER NOT NULL,
        deletedAt    INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_tx_occurred ON transactions (occurredAt);
    `);
  })();
  return _ready;
}

const b = (v: boolean) => (v ? 1 : 0);

// ---------- load ----------

export async function loadAll(): Promise<{
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
}> {
  await ensureTables();
  const db = await getDb();
  const [accounts, categories, transactions, recurringRules] = await Promise.all([
    db.getAllAsync<any>('SELECT * FROM accounts'),
    db.getAllAsync<any>('SELECT * FROM categories'),
    db.getAllAsync<any>('SELECT * FROM transactions'),
    db.getAllAsync<any>('SELECT * FROM recurring_rules'),
  ]);
  return {
    accounts: accounts.map(rowToAccount),
    categories: categories.map(rowToCategory),
    transactions: transactions.map(rowToTransaction),
    recurringRules: recurringRules.map(rowToRule),
  };
}

function rowToAccount(r: any): Account {
  return { ...r, archived: !!r.archived, deletedAt: r.deletedAt ?? undefined };
}
function rowToCategory(r: any): Category {
  return { ...r, hidden: !!r.hidden, deletedAt: r.deletedAt ?? undefined };
}
function rowToTransaction(r: any): Transaction {
  return {
    ...r,
    note: r.note ?? undefined,
    recurringRuleId: r.recurringRuleId ?? undefined,
    deletedAt: r.deletedAt ?? undefined,
  };
}
function rowToRule(r: any): RecurringRule {
  return {
    ...r,
    note: r.note ?? undefined,
    paused: !!r.paused,
    deletedAt: r.deletedAt ?? undefined,
  };
}

// ---------- save (INSERT OR REPLACE — soft-delete keeps the row) ----------

export async function saveAccount(a: Account): Promise<void> {
  await ensureTables();
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO accounts
     (id,name,startingBalanceMinor,colorToken,sortOrder,archived,createdAt,updatedAt,deletedAt)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [a.id, a.name, a.startingBalanceMinor, a.colorToken, a.sortOrder, b(a.archived), a.createdAt, a.updatedAt, a.deletedAt ?? null]
  );
}

export async function saveCategory(c: Category): Promise<void> {
  await ensureTables();
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO categories
     (id,name,kind,icon,colorToken,sortOrder,hidden,createdAt,updatedAt,deletedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [c.id, c.name, c.kind, c.icon, c.colorToken, c.sortOrder, b(c.hidden), c.createdAt, c.updatedAt, c.deletedAt ?? null]
  );
}

export async function saveTransaction(t: Transaction): Promise<void> {
  await ensureTables();
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO transactions
     (id,kind,amountMinor,accountId,categoryId,occurredAt,note,recurringRuleId,createdAt,updatedAt,deletedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [t.id, t.kind, t.amountMinor, t.accountId, t.categoryId, t.occurredAt, t.note ?? null, t.recurringRuleId ?? null, t.createdAt, t.updatedAt, t.deletedAt ?? null]
  );
}

export async function saveRule(r: RecurringRule): Promise<void> {
  await ensureTables();
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO recurring_rules
     (id,kind,amountMinor,accountId,categoryId,note,frequency,interval,startDate,nextDueDate,paused,createdAt,updatedAt,deletedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [r.id, r.kind, r.amountMinor, r.accountId, r.categoryId, r.note ?? null, r.frequency, r.interval, r.startDate, r.nextDueDate, b(r.paused), r.createdAt, r.updatedAt, r.deletedAt ?? null]
  );
}
