/**
 * Budget store — Zustand state with disk-backed persistence. React state updates
 * synchronously (the UI feels instant); SQLite writes run fire-and-forget. The
 * store is the in-memory source of truth; db.ts is the durable copy. All the
 * money math lives in the pure trust core (src/data/*) — the store only wires
 * actions to it and persists.
 *
 * Note the curried `create<State>()(...)` form — Zustand v5 requires it
 * (stack/zustand.md); the v4-style call type-checks but fails at runtime.
 */

import { create } from 'zustand';
import {
  makeAccount,
  makeCategory,
  makeTransaction,
  type Account,
  type Category,
  type RecurringRule,
  type Settings,
  type Transaction,
  type TxKind,
  type Frequency,
} from '../data/budget';
import { makeId } from '../lib/id';
import { tsToDateStr } from '../data/dates';
import { materializeDueRules } from '../data/recurring';
import { defaultCurrencyForLocale } from '../data/money';
import { seedAccount, seedCategories } from '../data/seed';
import {
  buildSnapshot,
  mergeById,
  type BudgetSnapshot,
} from '../data/archive';
import type { RawLedgerRow } from '../data/csv';
import { getAppSetting, setAppSetting } from '../storage/kv';
import { loadAll, saveAccount, saveCategory, saveRule, saveTransaction } from './db';
import { getLocale } from '../i18n';
import { QA_MODE } from '../qa/qaMode';
import { qaSeed } from '../qa/fixtures';

export interface TxInput {
  kind: TxKind;
  amountMinor: number;
  accountId: string;
  categoryId: string;
  occurredAt?: string;
  note?: string;
}

export interface RuleInput extends TxInput {
  frequency: Frequency;
  interval: number;
  startDate: string;
}

interface BudgetState {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  settings: Settings;
  hydrated: boolean;
  /** Count of transactions auto-created by recurring rules on this launch — the
   *  Home toast reads & then clears it. */
  recurringAdded: number;

  hydrate: () => Promise<void>;
  clearRecurringAdded: () => void;

  addTransaction: (input: TxInput) => string;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, 'id'>>) => void;
  deleteTransaction: (id: string) => void;

  addAccount: (name: string, startingBalanceMinor: number, colorToken: string) => string;
  updateAccount: (id: string, patch: Partial<Omit<Account, 'id'>>) => void;
  deleteAccount: (id: string) => void;

  addCategory: (name: string, kind: TxKind, icon: string, colorToken: string) => string;
  updateCategory: (id: string, patch: Partial<Omit<Category, 'id'>>) => void;
  moveCategory: (id: string, dir: -1 | 1) => void;
  deleteCategory: (id: string) => void;

  addRecurringRule: (input: RuleInput) => string;
  updateRecurringRule: (id: string, patch: Partial<Omit<RecurringRule, 'id'>>) => void;
  deleteRecurringRule: (id: string) => void;

  setCurrency: (code: string) => void;
  setTheme: (theme: Settings['theme']) => void;
  setDefaultCategory: (id: string) => void;
  setDefaultAccount: (id: string) => void;

  importSnapshot: (snap: BudgetSnapshot) => void;
  importCsvRows: (rows: RawLedgerRow[]) => number;
}

const DEFAULT_SETTINGS: Settings = {
  currencyCode: 'USD',
  theme: 'system',
};

function touch<T extends { updatedAt: number }>(rec: T): T {
  return { ...rec, updatedAt: Date.now() };
}

export const useBudgetStore = create<BudgetState>()((set, get) => ({
  accounts: [],
  categories: [],
  transactions: [],
  recurringRules: [],
  settings: DEFAULT_SETTINGS,
  hydrated: false,
  recurringAdded: 0,

  hydrate: async () => {
    try {
      const loaded = await loadAll();
      const settings = await loadSettings();

      // First run (or QA): seed the starter account + categories.
      let { accounts, categories, transactions, recurringRules } = loaded;
      let nextSettings = settings;

      if (accounts.length === 0 && categories.length === 0) {
        if (QA_MODE) {
          const seeded = qaSeed();
          accounts = seeded.accounts;
          categories = seeded.categories;
          transactions = seeded.transactions;
          recurringRules = seeded.recurringRules;
          nextSettings = { ...settings, ...seeded.settings };
        } else {
          const acct = seedAccount();
          const cats = seedCategories();
          accounts = [acct];
          categories = cats;
          nextSettings = {
            ...settings,
            currencyCode: settings.currencyCode || defaultCurrencyForLocale(getLocale()),
            defaultAccountId: acct.id,
            defaultCategoryId: cats.find((c) => c.kind === 'expense')?.id,
          };
        }
        accounts.forEach(saveAccount);
        categories.forEach(saveCategory);
        transactions.forEach(saveTransaction);
        recurringRules.forEach(saveRule);
        await persistSettings(nextSettings);
      }

      // Materialize any due recurring transactions (never silent — Home toasts).
      const today = tsToDateStr(Date.now());
      const { transactions: made, updatedRules, count } = materializeDueRules(recurringRules, today);
      if (count > 0) {
        made.forEach(saveTransaction);
        updatedRules.forEach(saveRule);
        transactions = [...made, ...transactions];
        recurringRules = updatedRules;
      }

      set({
        accounts,
        categories,
        transactions,
        recurringRules,
        settings: nextSettings,
        recurringAdded: count,
        hydrated: true,
      });
    } catch (err) {
      console.warn('budget: failed to hydrate', err);
      set({ hydrated: true });
    }
  },

  clearRecurringAdded: () => set({ recurringAdded: 0 }),

  // ---------- transactions ----------
  addTransaction: (input) => {
    const tx = makeTransaction(input);
    set((s) => ({ transactions: [tx, ...s.transactions] }));
    saveTransaction(tx).catch(warn('save transaction'));
    return tx.id;
  },
  updateTransaction: (id, patch) => {
    let updated: Transaction | undefined;
    set((s) => ({
      transactions: s.transactions.map((t) => {
        if (t.id !== id) return t;
        updated = touch({ ...t, ...patch });
        return updated;
      }),
    }));
    if (updated) saveTransaction(updated).catch(warn('update transaction'));
  },
  deleteTransaction: (id) => {
    let tomb: Transaction | undefined;
    set((s) => ({
      transactions: s.transactions.map((t) => {
        if (t.id !== id) return t;
        tomb = touch({ ...t, deletedAt: Date.now() });
        return tomb;
      }),
    }));
    if (tomb) saveTransaction(tomb).catch(warn('delete transaction'));
  },

  // ---------- accounts ----------
  addAccount: (name, startingBalanceMinor, colorToken) => {
    const sortOrder = get().accounts.length;
    const acct = makeAccount(name, startingBalanceMinor, colorToken, sortOrder);
    set((s) => ({ accounts: [...s.accounts, acct] }));
    saveAccount(acct).catch(warn('save account'));
    return acct.id;
  },
  updateAccount: (id, patch) => {
    let updated: Account | undefined;
    set((s) => ({
      accounts: s.accounts.map((a) => (a.id === id ? (updated = touch({ ...a, ...patch })) : a)),
    }));
    if (updated) saveAccount(updated).catch(warn('update account'));
  },
  deleteAccount: (id) => {
    // Soft-delete the account; its transactions stay (historical integrity).
    let tomb: Account | undefined;
    set((s) => ({
      accounts: s.accounts.map((a) => (a.id === id ? (tomb = touch({ ...a, deletedAt: Date.now() })) : a)),
    }));
    if (tomb) saveAccount(tomb).catch(warn('delete account'));
  },

  // ---------- categories ----------
  addCategory: (name, kind, icon, colorToken) => {
    const sortOrder = get().categories.filter((c) => c.kind === kind).length;
    const cat = makeCategory(name, kind, icon, colorToken, sortOrder);
    set((s) => ({ categories: [...s.categories, cat] }));
    saveCategory(cat).catch(warn('save category'));
    return cat.id;
  },
  updateCategory: (id, patch) => {
    let updated: Category | undefined;
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? (updated = touch({ ...c, ...patch })) : c)),
    }));
    if (updated) saveCategory(updated).catch(warn('update category'));
  },
  moveCategory: (id, dir) => {
    const cat = get().categories.find((c) => c.id === id);
    if (!cat) return;
    // Order across all non-deleted categories of this kind (incl. hidden) so the
    // management screen can reorder everything it shows.
    const siblings = get()
      .categories.filter((x) => x.deletedAt == null && x.kind === cat.kind)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = siblings.findIndex((c) => c.id === id);
    const swapWith = siblings[idx + dir];
    if (!swapWith) return;
    const a = touch({ ...cat, sortOrder: swapWith.sortOrder });
    const bRec = touch({ ...swapWith, sortOrder: cat.sortOrder });
    set((s) => ({
      categories: s.categories.map((c) => (c.id === a.id ? a : c.id === bRec.id ? bRec : c)),
    }));
    saveCategory(a).catch(warn('reorder category'));
    saveCategory(bRec).catch(warn('reorder category'));
  },
  deleteCategory: (id) => {
    let tomb: Category | undefined;
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? (tomb = touch({ ...c, deletedAt: Date.now() })) : c)),
    }));
    if (tomb) saveCategory(tomb).catch(warn('delete category'));
  },

  // ---------- recurring ----------
  addRecurringRule: (input) => {
    const now = Date.now();
    const rule: RecurringRule = {
      id: makeId('r'),
      kind: input.kind,
      amountMinor: Math.abs(Math.round(input.amountMinor)) || 0,
      accountId: input.accountId,
      categoryId: input.categoryId,
      note: input.note?.trim() ? input.note.trim() : undefined,
      frequency: input.frequency,
      interval: Math.max(1, Math.round(input.interval) || 1),
      startDate: input.startDate,
      nextDueDate: input.startDate,
      paused: false,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ recurringRules: [...s.recurringRules, rule] }));
    saveRule(rule).catch(warn('save rule'));
    return rule.id;
  },
  updateRecurringRule: (id, patch) => {
    let updated: RecurringRule | undefined;
    set((s) => ({
      recurringRules: s.recurringRules.map((r) =>
        r.id === id ? (updated = touch({ ...r, ...patch })) : r
      ),
    }));
    if (updated) saveRule(updated).catch(warn('update rule'));
  },
  deleteRecurringRule: (id) => {
    let tomb: RecurringRule | undefined;
    set((s) => ({
      recurringRules: s.recurringRules.map((r) =>
        r.id === id ? (tomb = touch({ ...r, deletedAt: Date.now() })) : r
      ),
    }));
    if (tomb) saveRule(tomb).catch(warn('delete rule'));
  },

  // ---------- settings ----------
  setCurrency: (code) => updateSettings(set, get, { currencyCode: code }),
  setTheme: (theme) => updateSettings(set, get, { theme }),
  setDefaultCategory: (id) => updateSettings(set, get, { defaultCategoryId: id }),
  setDefaultAccount: (id) => updateSettings(set, get, { defaultAccountId: id }),

  // ---------- import ----------
  importSnapshot: (snap) => {
    set((s) => ({
      accounts: mergeById(s.accounts, snap.accounts),
      categories: mergeById(s.categories, snap.categories),
      transactions: mergeById(s.transactions, snap.transactions),
      recurringRules: mergeById(s.recurringRules, snap.recurringRules),
    }));
    // Persist the merged result.
    const st = get();
    st.accounts.forEach((a) => saveAccount(a).catch(warn('import account')));
    st.categories.forEach((c) => saveCategory(c).catch(warn('import category')));
    st.transactions.forEach((t) => saveTransaction(t).catch(warn('import transaction')));
    st.recurringRules.forEach((r) => saveRule(r).catch(warn('import rule')));
  },

  importCsvRows: (rows) => {
    if (rows.length === 0) return 0;
    const st = get();
    // Resolve account/category by name; create any that don't exist yet.
    const accByName = new Map(st.accounts.map((a) => [a.name.toLowerCase(), a]));
    const catByName = new Map(st.categories.map((c) => [`${c.kind}:${c.name.toLowerCase()}`, c]));
    const newAccounts: Account[] = [];
    const newCategories: Category[] = [];
    const newTxns: Transaction[] = [];
    const fallbackAccount = st.accounts.find((a) => a.id === st.settings.defaultAccountId) ?? st.accounts[0];

    let accSort = st.accounts.length;
    let catSort = st.categories.length;

    for (const row of rows) {
      let account = row.accountName ? accByName.get(row.accountName.toLowerCase()) : undefined;
      if (!account && row.accountName) {
        account = makeAccount(row.accountName, 0, 'cat-11', accSort++);
        accByName.set(account.name.toLowerCase(), account);
        newAccounts.push(account);
      }
      account = account ?? fallbackAccount;
      if (!account) continue; // no account at all — skip

      const catKey = `${row.kind}:${(row.categoryName || 'Other').toLowerCase()}`;
      let category = catByName.get(catKey);
      if (!category) {
        category = makeCategory(row.categoryName || 'Other', row.kind, 'tag', 'cat-11', catSort++);
        catByName.set(catKey, category);
        newCategories.push(category);
      }

      newTxns.push(
        makeTransaction({
          kind: row.kind,
          amountMinor: row.amountMinor,
          accountId: account.id,
          categoryId: category.id,
          occurredAt: row.occurredAt,
          note: row.note,
        })
      );
    }

    set((s) => ({
      accounts: [...s.accounts, ...newAccounts],
      categories: [...s.categories, ...newCategories],
      transactions: [...newTxns, ...s.transactions],
    }));
    newAccounts.forEach((a) => saveAccount(a).catch(warn('csv account')));
    newCategories.forEach((c) => saveCategory(c).catch(warn('csv category')));
    newTxns.forEach((t) => saveTransaction(t).catch(warn('csv transaction')));
    return newTxns.length;
  },
}));

// ---------- helpers ----------

function warn(what: string) {
  return (err: unknown) => console.warn(`budget: failed to ${what}`, err);
}

function updateSettings(
  set: (fn: (s: BudgetState) => Partial<BudgetState>) => void,
  get: () => BudgetState,
  patch: Partial<Settings>
): void {
  set((s) => ({ settings: { ...s.settings, ...patch } }));
  persistSettings(get().settings).catch(warn('persist settings'));
}

const SETTINGS_KEYS: (keyof Settings)[] = [
  'currencyCode',
  'theme',
  'defaultCategoryId',
  'defaultAccountId',
];

async function loadSettings(): Promise<Settings> {
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const k of SETTINGS_KEYS) {
    const v = await getAppSetting(k);
    if (v != null) (out as any)[k] = v;
  }
  return out;
}

async function persistSettings(settings: Settings): Promise<void> {
  for (const k of SETTINGS_KEYS) {
    const v = settings[k];
    if (v != null) await setAppSetting(k, String(v));
  }
}

/** Build the full-state snapshot for the JSON archive export (Layer 3). */
export function snapshotOf(state: BudgetState): BudgetSnapshot {
  return buildSnapshot({
    accounts: state.accounts,
    categories: state.categories,
    transactions: state.transactions,
    recurringRules: state.recurringRules,
    settings: state.settings,
  });
}
