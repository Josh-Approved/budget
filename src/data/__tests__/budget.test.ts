/**
 * Trust-core unit tests (canon § QA & testing Tier 1) for the budget app. The
 * trust core is the money math: integer minor units never drift, account
 * balances and period totals are exact, the category breakdown sums to the
 * whole, recurring rules materialize the right number of entries, CSV/JSON
 * round-trips don't lose data, and a delete propagates through merge. A bug in
 * any of these silently corrupts a number the user trusts with their money.
 */

import { describe, it, expect } from '@jest/globals';
import {
  currencyFractionDigits,
  minorScale,
  parseAmountToMinor,
  minorToMajor,
  defaultCurrencyForLocale,
} from '../money';
import {
  tsToDateStr,
  parseDateStr,
  addDays,
  addMonths,
  addYears,
  startOfWeek,
  startOfMonth,
  periodRange,
  inRange,
} from '../dates';
import {
  makeAccount,
  makeCategory,
  makeTransaction,
  accountBalanceMinor,
  totalBalanceMinor,
  transactionsInRange,
  periodTotals,
  categoryBreakdown,
  searchTransactions,
  groupByDay,
  signedMinor,
  type Account,
  type Category,
} from '../budget';
import { advanceDueDate, materializeDueRules } from '../recurring';
import { buildLedgerCsv, parseLedgerCsv, splitCsv } from '../csv';
import { sanitizeSnapshot, sanitizeTransaction, mergeById, SCHEMA_VERSION } from '../archive';

// ---------- money ----------

describe('money', () => {
  it('knows currency minor scales', () => {
    expect(currencyFractionDigits('USD')).toBe(2);
    expect(currencyFractionDigits('JPY')).toBe(0);
    expect(minorScale('USD')).toBe(100);
    expect(minorScale('JPY')).toBe(1);
  });
  it('parses major amounts to exact integer minor units (no float drift)', () => {
    expect(parseAmountToMinor('12.34', 'USD')).toBe(1234);
    expect(parseAmountToMinor('0.1', 'USD')).toBe(10);
    expect(parseAmountToMinor('19.99', 'USD')).toBe(1999); // 19.99*100 floats to 1998.9999
    expect(parseAmountToMinor('1 200,50', 'EUR')).toBe(120050);
    expect(parseAmountToMinor('500', 'JPY')).toBe(500);
  });
  it('rejects non-numeric input', () => {
    expect(parseAmountToMinor('', 'USD')).toBeNull();
    expect(parseAmountToMinor('.', 'USD')).toBeNull();
    expect(parseAmountToMinor('abc', 'USD')).toBeNull();
  });
  it('round-trips minor <-> major', () => {
    expect(minorToMajor(1234, 'USD')).toBe(12.34);
    expect(minorToMajor(500, 'JPY')).toBe(500);
  });
  it('guesses a currency from a locale, falling back to USD', () => {
    expect(defaultCurrencyForLocale('en-GB')).toBe('GBP');
    expect(defaultCurrencyForLocale('de-DE')).toBe('EUR');
    expect(defaultCurrencyForLocale('xx-ZZ')).toBe('USD');
    expect(defaultCurrencyForLocale('en')).toBe('USD');
  });
});

// ---------- dates ----------

describe('dates', () => {
  it('formats and parses local date strings', () => {
    expect(tsToDateStr(parseDateStr('2026-06-12').getTime())).toBe('2026-06-12');
  });
  it('adds days, months (clamped), and years', () => {
    expect(addDays('2026-06-12', 5)).toBe('2026-06-17');
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28'); // clamps Feb
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28');
  });
  it('finds the Monday start of a week and month start', () => {
    // 2026-06-12 is a Friday
    expect(startOfWeek('2026-06-12')).toBe('2026-06-08');
    expect(startOfWeek('2026-06-08')).toBe('2026-06-08');
    expect(startOfMonth('2026-06-12')).toBe('2026-06-01');
  });
  it('builds period ranges that contain the anchor and exclude the next period', () => {
    const [mFrom, mTo] = periodRange('month', '2026-06-12', 0);
    expect(mFrom).toBe('2026-06-01');
    expect(mTo).toBe('2026-07-01');
    expect(inRange('2026-06-30', mFrom, mTo)).toBe(true);
    expect(inRange('2026-07-01', mFrom, mTo)).toBe(false);

    const [pFrom, pTo] = periodRange('month', '2026-06-12', -1);
    expect(pFrom).toBe('2026-05-01');
    expect(pTo).toBe('2026-06-01');

    const [yFrom, yTo] = periodRange('year', '2026-06-12', 0);
    expect(yFrom).toBe('2026-01-01');
    expect(yTo).toBe('2027-01-01');
  });
});

// ---------- balances + totals ----------

function fixtures() {
  const cash: Account = makeAccount('Cash', 10000, 'cat-1', 0); // $100.00 opening
  const card: Account = makeAccount('Card', 0, 'cat-2', 1);
  const groceries: Category = makeCategory('Groceries', 'expense', 'groceries', 'cat-1', 0);
  const salary: Category = makeCategory('Salary', 'income', 'salary', 'cat-2', 0);
  const dining: Category = makeCategory('Dining', 'expense', 'food', 'cat-3', 1);
  const txns = [
    makeTransaction({ kind: 'income', amountMinor: 250000, accountId: cash.id, categoryId: salary.id, occurredAt: '2026-06-01' }),
    makeTransaction({ kind: 'expense', amountMinor: 5000, accountId: cash.id, categoryId: groceries.id, occurredAt: '2026-06-03' }),
    makeTransaction({ kind: 'expense', amountMinor: 2000, accountId: card.id, categoryId: dining.id, occurredAt: '2026-06-05' }),
    makeTransaction({ kind: 'expense', amountMinor: 3000, accountId: card.id, categoryId: groceries.id, occurredAt: '2026-05-20' }),
  ];
  return { cash, card, groceries, salary, dining, txns };
}

describe('account balances', () => {
  it('opening balance + income - expense per account', () => {
    const { cash, card, txns } = fixtures();
    // cash: 10000 + 250000 - 5000
    expect(accountBalanceMinor(cash, txns)).toBe(255000);
    // card: 0 - 2000 - 3000
    expect(accountBalanceMinor(card, txns)).toBe(-5000);
    expect(totalBalanceMinor([cash, card], txns)).toBe(250000);
  });
  it('ignores tombstoned transactions', () => {
    const { cash, txns } = fixtures();
    const tomb = { ...txns[1], deletedAt: Date.now() };
    expect(accountBalanceMinor(cash, [txns[0], tomb])).toBe(260000); // expense excluded
  });
});

describe('period totals + range', () => {
  it('filters to a period and account, then sums income/expense/net', () => {
    const { card, txns } = fixtures();
    const [from, to] = periodRange('month', '2026-06-12', 0);
    const june = transactionsInRange(txns, from, to);
    expect(june).toHaveLength(3); // the May one is excluded
    const totals = periodTotals(june);
    expect(totals.incomeMinor).toBe(250000);
    expect(totals.expenseMinor).toBe(7000);
    expect(totals.netMinor).toBe(243000);

    const juneCard = transactionsInRange(txns, from, to, card.id);
    expect(juneCard).toHaveLength(1);
    expect(periodTotals(juneCard).expenseMinor).toBe(2000);
  });
  it('returns transactions newest-first', () => {
    const { txns } = fixtures();
    const all = transactionsInRange(txns, '2026-01-01', '2027-01-01');
    expect(all[0].occurredAt >= all[all.length - 1].occurredAt).toBe(true);
  });
});

describe('category breakdown', () => {
  it('sums expenses by category, largest first, fractions to 1', () => {
    const { groceries, dining, txns } = fixtures();
    const [from, to] = periodRange('month', '2026-06-12', 0);
    const slices = categoryBreakdown(transactionsInRange(txns, from, to), [groceries, dining]);
    // groceries 5000 (June), dining 2000 -> total 7000
    expect(slices[0].categoryId).toBe(groceries.id);
    expect(slices[0].totalMinor).toBe(5000);
    expect(slices.reduce((s, x) => s + x.fraction, 0)).toBeCloseTo(1, 5);
  });
  it('keeps spend from a deleted category under a fallback slice', () => {
    const { groceries, txns } = fixtures();
    const slices = categoryBreakdown(txns, [groceries]); // dining category omitted
    const ids = slices.map((s) => s.categoryId);
    expect(ids).toContain(groceries.id);
    // total across all slices equals all expense
    const total = slices.reduce((s, x) => s + x.totalMinor, 0);
    expect(total).toBe(5000 + 2000 + 3000);
  });
});

describe('search + grouping', () => {
  it('matches note text and category name, case-insensitive', () => {
    const { groceries, dining, txns } = fixtures();
    const withNote = makeTransaction({ kind: 'expense', amountMinor: 100, accountId: 'x', categoryId: dining.id, occurredAt: '2026-06-06', note: 'Pizza night' });
    const all = [...txns, withNote];
    expect(searchTransactions(all, 'pizza', [groceries, dining])).toHaveLength(1);
    expect(searchTransactions(all, 'grocer', [groceries, dining]).length).toBeGreaterThan(0);
    expect(searchTransactions(all, '', [groceries, dining])).toHaveLength(all.length);
  });
  it('groups by day, newest day first, with a per-day net', () => {
    const { txns } = fixtures();
    const groups = groupByDay(txns);
    expect(groups[0].dateStr >= groups[groups.length - 1].dateStr).toBe(true);
    const june1 = groups.find((g) => g.dateStr === '2026-06-01');
    expect(june1?.netMinor).toBe(250000);
  });
  it('signedMinor: income positive, expense negative', () => {
    const inc = makeTransaction({ kind: 'income', amountMinor: 100, accountId: 'a', categoryId: 'c' });
    const exp = makeTransaction({ kind: 'expense', amountMinor: 100, accountId: 'a', categoryId: 'c' });
    expect(signedMinor(inc)).toBe(100);
    expect(signedMinor(exp)).toBe(-100);
  });
});

// ---------- recurring ----------

describe('recurring', () => {
  it('advances a due date by frequency * interval', () => {
    expect(advanceDueDate('2026-06-12', 'daily', 1)).toBe('2026-06-13');
    expect(advanceDueDate('2026-06-12', 'weekly', 2)).toBe('2026-06-26');
    expect(advanceDueDate('2026-01-31', 'monthly', 1)).toBe('2026-02-28');
    expect(advanceDueDate('2026-06-12', 'yearly', 1)).toBe('2027-06-12');
  });

  function rule(nextDueDate: string, frequency: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    const now = Date.now();
    return {
      id: 'r1', kind: 'expense' as const, amountMinor: 90000, accountId: 'a', categoryId: 'c',
      note: 'Rent', frequency, interval: 1, startDate: nextDueDate, nextDueDate, paused: false,
      createdAt: now, updatedAt: now,
    };
  }

  it('materializes every missed occurrence and advances past today', () => {
    const r = rule('2026-04-01', 'monthly');
    const { transactions, updatedRules, count } = materializeDueRules([r], '2026-06-12');
    // Apr, May, Jun due -> 3 entries; next advances to Jul
    expect(count).toBe(3);
    expect(transactions.map((t) => t.occurredAt)).toEqual(['2026-04-01', '2026-05-01', '2026-06-01']);
    expect(transactions.every((t) => t.recurringRuleId === 'r1')).toBe(true);
    expect(updatedRules[0].nextDueDate).toBe('2026-07-01');
  });
  it('does nothing for a future or paused rule', () => {
    expect(materializeDueRules([rule('2026-12-01', 'monthly')], '2026-06-12').count).toBe(0);
    expect(materializeDueRules([{ ...rule('2026-01-01', 'monthly'), paused: true }], '2026-06-12').count).toBe(0);
  });
  it('skips a deleted rule and leaves it unchanged', () => {
    const r = { ...rule('2026-01-01', 'monthly'), deletedAt: Date.now() };
    const res = materializeDueRules([r], '2026-06-12');
    expect(res.count).toBe(0);
    expect(res.updatedRules[0]).toBe(r);
  });
});

// ---------- CSV round-trip ----------

describe('csv', () => {
  it('handles quoted fields with commas and quotes', () => {
    const rows = splitCsv('a,"b,c","d""e"\n1,2,3\n');
    expect(rows[0]).toEqual(['a', 'b,c', 'd"e']);
    expect(rows[1]).toEqual(['1', '2', '3']);
  });
  it('exports then re-parses the same ledger', () => {
    const { cash, card, groceries, dining, salary, txns } = fixtures();
    const csv = buildLedgerCsv(txns, [cash, card], [groceries, dining, salary], 'USD');
    const parsed = parseLedgerCsv(csv, 'USD');
    expect(parsed).toHaveLength(txns.length);
    const total = parsed.reduce((s, r) => s + (r.kind === 'income' ? r.amountMinor : -r.amountMinor), 0);
    const orig = txns.reduce((s, t) => s + signedMinor(t), 0);
    expect(total).toBe(orig);
    // a note with a comma survives
    const tricky = makeTransaction({ kind: 'expense', amountMinor: 500, accountId: cash.id, categoryId: groceries.id, occurredAt: '2026-06-09', note: 'Milk, eggs' });
    const csv2 = buildLedgerCsv([tricky], [cash], [groceries], 'USD');
    expect(parseLedgerCsv(csv2, 'USD')[0].note).toBe('Milk, eggs');
  });
  it('skips malformed rows, returns [] for an unrecognized header', () => {
    expect(parseLedgerCsv('garbage\nstuff', 'USD')).toEqual([]);
    const csv = 'date,kind,amount,currency,account,category,note\nNOTADATE,expense,5,USD,Cash,Food,x\n2026-06-01,expense,5,USD,Cash,Food,ok\n';
    expect(parseLedgerCsv(csv, 'USD')).toHaveLength(1);
  });
});

// ---------- archive sanitize + merge ----------

describe('archive', () => {
  it('sanitizes a transaction, rejecting bad shapes', () => {
    expect(sanitizeTransaction({ amountMinor: 100, occurredAt: '2026-06-01', kind: 'expense' })?.amountMinor).toBe(100);
    expect(sanitizeTransaction({ amountMinor: 100, occurredAt: 'nope' })).toBeNull();
    expect(sanitizeTransaction({ occurredAt: '2026-06-01' })).toBeNull();
    expect(sanitizeTransaction(null)).toBeNull();
  });
  it('sanitizes a whole snapshot, dropping junk records', () => {
    const snap = sanitizeSnapshot({
      schema: 1,
      accounts: [{ name: 'Cash' }, 42],
      categories: [{ name: 'Food', kind: 'expense' }],
      transactions: [{ amountMinor: 100, occurredAt: '2026-06-01', kind: 'income' }, { bad: true }],
      settings: { currencyCode: 'EUR', theme: 'dark' },
    });
    expect(snap.schema).toBe(SCHEMA_VERSION);
    expect(snap.accounts).toHaveLength(1);
    expect(snap.transactions).toHaveLength(1);
    expect(snap.settings.currencyCode).toBe('EUR');
  });
  it('merges by id, newer updatedAt wins, tombstone propagates', () => {
    type V = { id: string; updatedAt: number; deletedAt?: number };
    const a: V = { id: '1', updatedAt: 100 };
    const aNew: V = { id: '1', updatedAt: 200 };
    const b: V = { id: '2', updatedAt: 50 };
    const merged = mergeById([a, b], [aNew]);
    expect(merged.find((x) => x.id === '1')?.updatedAt).toBe(200);
    expect(merged).toHaveLength(2);

    const tomb = { id: '2', updatedAt: 60, deletedAt: 60 };
    const withTomb = mergeById([a, b], [tomb]);
    expect(withTomb.find((x) => x.id === '2')?.deletedAt).toBe(60);
  });
});
