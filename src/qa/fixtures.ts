/**
 * QA fixtures — deterministic data the app boots with under QA_MODE (the capture
 * pipeline builds with EXPO_PUBLIC_QA_MODE=1). Built with the app's OWN
 * constructors so it's valid by construction. Transactions are placed inside the
 * current calendar month (clamped to today, never the future) so the default
 * month view always reads as a real, mid-month budget regardless of capture
 * date. Two accounts so the account-scope pills show in screenshots.
 */

import {
  makeAccount,
  makeCategory,
  makeTransaction,
  type Account,
  type Category,
  type Transaction,
  type TxKind,
  type RecurringRule,
  type Settings,
} from '../data/budget';
import { tsToDateStr } from '../data/dates';

function dayInMonth(today: string, day: number): string {
  const candidate = `${today.slice(0, 7)}-${String(day).padStart(2, '0')}`;
  return candidate <= today ? candidate : today;
}

const M = (major: number) => Math.round(major * 100);

export interface SeedState {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  settings: Partial<Settings>;
}

export function qaSeed(): SeedState {
  const today = tsToDateStr(Date.now());

  const cash = makeAccount('Cash', M(120), 'cat-12', 0);
  const card = makeAccount('Card', 0, 'cat-5', 1);

  const cats: Record<string, Category> = {
    groceries: makeCategory('Groceries', 'expense', 'groceries', 'cat-1', 0),
    eatingOut: makeCategory('Eating out', 'expense', 'food', 'cat-2', 1),
    transport: makeCategory('Transport', 'expense', 'transit', 'cat-5', 2),
    bills: makeCategory('Bills', 'expense', 'bills', 'cat-6', 3),
    housing: makeCategory('Housing', 'expense', 'home', 'cat-9', 4),
    fun: makeCategory('Entertainment', 'expense', 'entertainment', 'cat-7', 5),
    health: makeCategory('Health', 'expense', 'health', 'cat-8', 6),
    salary: makeCategory('Salary', 'income', 'salary', 'cat-12', 0),
  };

  const tx = (
    kind: TxKind,
    major: number,
    accountId: string,
    categoryId: string,
    day: number,
    note?: string
  ): Transaction =>
    makeTransaction({
      kind,
      amountMinor: M(major),
      accountId,
      categoryId,
      occurredAt: dayInMonth(today, day),
      note,
    });

  const transactions: Transaction[] = [
    tx('income', 2500, cash.id, cats.salary.id, 1, 'Paycheck'),
    tx('expense', 900, cash.id, cats.housing.id, 1, 'Rent'),
    tx('expense', 62.4, cash.id, cats.bills.id, 3, 'Electric'),
    tx('expense', 48.13, cash.id, cats.groceries.id, 5, 'Weekly shop'),
    tx('expense', 12.5, card.id, cats.eatingOut.id, 8, 'Lunch'),
    tx('expense', 3.2, card.id, cats.transport.id, 10, 'Bus pass'),
    tx('expense', 15.99, card.id, cats.fun.id, 12, 'Cinema'),
    tx('expense', 28, card.id, cats.health.id, 15, 'Pharmacy'),
    tx('expense', 31.75, cash.id, cats.groceries.id, 18, 'Market'),
  ];

  return {
    accounts: [cash, card],
    categories: Object.values(cats),
    transactions,
    recurringRules: [],
    settings: { currencyCode: 'USD', defaultAccountId: cash.id, defaultCategoryId: cats.groceries.id },
  };
}
