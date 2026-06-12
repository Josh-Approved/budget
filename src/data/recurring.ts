/**
 * Recurring-transaction math — part of the TRUST CORE. Materialization runs on
 * app open (never silently in the background): any rule whose next due date has
 * passed creates the missed transactions and advances. Pure + unit-tested,
 * because a bug here either double-charges the user's ledger or silently drops
 * a month's rent.
 */

import { addDays, addMonths, addYears } from './dates';
import { makeTransaction, type Frequency, type RecurringRule, type Transaction } from './budget';

/** The next due date after `dateStr` for a frequency/interval. */
export function advanceDueDate(dateStr: string, frequency: Frequency, interval: number): string {
  const n = Math.max(1, Math.round(interval) || 1);
  switch (frequency) {
    case 'daily':
      return addDays(dateStr, n);
    case 'weekly':
      return addDays(dateStr, n * 7);
    case 'monthly':
      return addMonths(dateStr, n);
    case 'yearly':
      return addYears(dateStr, n);
  }
}

// A rule can't generate more than this many entries in one catch-up pass — a
// guard against a corrupt nextDueDate spinning forever (it would take years of
// being closed to legitimately exceed this).
const MAX_CATCHUP = 730;

export interface MaterializeResult {
  transactions: Transaction[];
  updatedRules: RecurringRule[];
  count: number;
}

/** For every active, unpaused rule whose nextDueDate is on/before `today`,
 *  emit one transaction per missed occurrence (dated the occurrence's due date,
 *  tagged with the rule id) and return the rules with their nextDueDate
 *  advanced past today. Rules with nothing due are returned unchanged. */
export function materializeDueRules(rules: RecurringRule[], today: string): MaterializeResult {
  const transactions: Transaction[] = [];
  const updatedRules: RecurringRule[] = [];

  for (const rule of rules) {
    if (rule.deletedAt != null || rule.paused) {
      updatedRules.push(rule);
      continue;
    }
    let due = rule.nextDueDate;
    let made = 0;
    while (due <= today && made < MAX_CATCHUP) {
      transactions.push(
        makeTransaction({
          kind: rule.kind,
          amountMinor: rule.amountMinor,
          accountId: rule.accountId,
          categoryId: rule.categoryId,
          occurredAt: due,
          note: rule.note,
          recurringRuleId: rule.id,
        })
      );
      due = advanceDueDate(due, rule.frequency, rule.interval);
      made += 1;
    }
    updatedRules.push(made > 0 ? { ...rule, nextDueDate: due, updatedAt: Date.now() } : rule);
  }

  return { transactions, updatedRules, count: transactions.length };
}
