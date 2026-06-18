/**
 * CSV ledger export / parse — pure, part of the TRUST CORE (round-trip safety).
 * Export is for spreadsheets and the "coming from Monefy" import recipe; import
 * is additive (the store resolves names to ids, creating a category/account if
 * a name is new). RFC-4180-ish: fields with commas, quotes, or newlines are
 * double-quoted and embedded quotes doubled.
 */

import { minorToMajor, parseAmountToMinor } from './money';
import { activeTransactions, type Account, type Category, type Transaction, type TxKind } from './budget';

const HEADER = ['date', 'kind', 'amount', 'currency', 'account', 'category', 'note'];

function escapeField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Build a CSV string of the full ledger, one row per active transaction. */
export function buildLedgerCsv(
  txns: Transaction[],
  accounts: Account[],
  categories: Category[],
  currency: string
): string {
  const accName = new Map(accounts.map((a) => [a.id, a.name]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const lines = [HEADER.join(',')];
  for (const t of activeTransactions(txns).sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))) {
    const major = minorToMajor(t.amountMinor, currency);
    lines.push(
      [
        t.occurredAt,
        t.kind,
        String(major),
        currency,
        accName.get(t.accountId) ?? '',
        catName.get(t.categoryId) ?? '',
        t.note ?? '',
      ]
        .map((f) => escapeField(String(f)))
        .join(',')
    );
  }
  return lines.join('\n') + '\n';
}

/** Split a CSV string into rows of string fields (quote-aware). */
export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export interface RawLedgerRow {
  occurredAt: string;
  kind: TxKind;
  amountMinor: number;
  accountName: string;
  categoryName: string;
  note?: string;
}

/** Parse a ledger CSV (as produced by buildLedgerCsv) into raw rows. Amounts
 *  are converted to minor units using the row's own currency column when
 *  present, else the fallback. Malformed rows are skipped, not thrown on. */
export function parseLedgerCsv(text: string, fallbackCurrency: string): RawLedgerRow[] {
  const rows = splitCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const di = idx('date');
  const ki = idx('kind');
  const ai = idx('amount');
  const ci = idx('currency');
  const acci = idx('account');
  const cati = idx('category');
  const ni = idx('note');
  // No recognizable header -> nothing we can safely import.
  if (di < 0 || ai < 0) return [];

  const out: RawLedgerRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const date = (cells[di] ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const currency = (ci >= 0 ? cells[ci] : '').trim() || fallbackCurrency;
    const minor = parseAmountToMinor((cells[ai] ?? '').trim(), currency);
    if (minor == null) continue;
    const rawKind = (ki >= 0 ? cells[ki] : '').trim().toLowerCase();
    const kind: TxKind = rawKind === 'income' ? 'income' : 'expense';
    out.push({
      occurredAt: date,
      kind,
      amountMinor: Math.abs(minor),
      accountName: (acci >= 0 ? cells[acci] : '').trim(),
      categoryName: (cati >= 0 ? cells[cati] : '').trim(),
      note: ni >= 0 && cells[ni]?.trim() ? cells[ni].trim() : undefined,
    });
  }
  return out;
}
