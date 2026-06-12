/**
 * First-launch defaults — the seeded account + category list a fresh install
 * starts with. The seed list is deliberately small and conventional (wrong
 * defaults cause friction on every install). Users add / rename / hide / recolor
 * from the Categories screen; this is just the starting point.
 *
 * Kept pure so the store can seed deterministically and tests can assert the
 * shape. Single seeded account named "Cash" so single-account users never see
 * the account affordances (spec § Accounts).
 */

import {
  makeAccount,
  makeCategory,
  type Account,
  type Category,
} from './budget';

interface CatSeed {
  name: string;
  icon: string;
  color: string;
}

const EXPENSE_SEED: CatSeed[] = [
  { name: 'Groceries', icon: 'groceries', color: 'cat-1' },
  { name: 'Eating out', icon: 'food', color: 'cat-2' },
  { name: 'Transport', icon: 'transit', color: 'cat-5' },
  { name: 'Bills', icon: 'bills', color: 'cat-6' },
  { name: 'Housing', icon: 'home', color: 'cat-9' },
  { name: 'Health', icon: 'health', color: 'cat-8' },
  { name: 'Shopping', icon: 'clothing', color: 'cat-3' },
  { name: 'Entertainment', icon: 'entertainment', color: 'cat-7' },
  { name: 'Travel', icon: 'travel', color: 'cat-10' },
  { name: 'Personal', icon: 'personal', color: 'cat-4' },
  { name: 'Gifts', icon: 'gifts', color: 'cat-12' },
  { name: 'Other', icon: 'other', color: 'cat-11' },
];

const INCOME_SEED: CatSeed[] = [
  { name: 'Salary', icon: 'salary', color: 'cat-12' },
  { name: 'Business', icon: 'business', color: 'cat-3' },
  { name: 'Gifts', icon: 'gifts', color: 'cat-2' },
  { name: 'Other', icon: 'other', color: 'cat-11' },
];

export function seedAccount(): Account {
  return makeAccount('Cash', 0, 'cat-12', 0);
}

export function seedCategories(): Category[] {
  const out: Category[] = [];
  EXPENSE_SEED.forEach((c, i) => out.push(makeCategory(c.name, 'expense', c.icon, c.color, i)));
  INCOME_SEED.forEach((c, i) => out.push(makeCategory(c.name, 'income', c.icon, c.color, i)));
  return out;
}
