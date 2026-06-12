/**
 * Manual export / import (canon § Backup & restore Layer 3) for the budget app.
 * Two formats:
 *   - JSON archive  — full-state snapshot, ids preserved, the round-trip backup
 *     (uses the shell's generic envelope plumbing in lib/backup.ts).
 *   - CSV ledger    — spreadsheet-friendly, the "coming from Monefy" import path
 *     (its own text/csv file plumbing, app-owned, since backup.ts is JSON-only).
 * Imported data is sanitized in the pure trust core (data/archive.ts, data/csv.ts);
 * the store merges it in non-destructively.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { exportEnvelope, pickEnvelope } from './backup';
import {
  SCHEMA_VERSION,
  sanitizeSnapshot,
  type BudgetSnapshot,
} from '../data/archive';
import { parseLedgerCsv, type RawLedgerRow } from '../data/csv';

const APP_SLUG = 'budget';

// ---------- JSON archive (full state) ----------

export async function exportArchive(snapshot: BudgetSnapshot): Promise<void> {
  await exportEnvelope(APP_SLUG, SCHEMA_VERSION, snapshot);
}

/** Pick a JSON archive and return a sanitized snapshot. Tolerates both an
 *  enveloped export and a bare snapshot. Null on cancel / unreadable. */
export async function importArchive(): Promise<BudgetSnapshot | null> {
  const env = await pickEnvelope();
  if (!env) return null;
  return sanitizeSnapshot((env as any).payload ?? env);
}

// ---------- CSV ledger ----------

export async function exportCsv(csv: string): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 10);
  const uri = `${FileSystem.cacheDirectory}${APP_SLUG}-${stamp}.csv`;
  await FileSystem.writeAsStringAsync(uri, csv);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export CSV',
      UTI: 'public.comma-separated-values-text',
    });
  }
}

/** Pick a CSV file and parse it into raw ledger rows (the store resolves
 *  account/category names and adds the transactions). [] on cancel / bad file. */
export async function importCsv(fallbackCurrency: string): Promise<RawLedgerRow[]> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'public.comma-separated-values-text', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]) return [];
  let text: string;
  try {
    text = await FileSystem.readAsStringAsync(res.assets[0].uri);
  } catch {
    return [];
  }
  return parseLedgerCsv(text, fallbackCurrency);
}
