/**
 * Settings / About. App-specific prefs sit ABOVE the canonical About block,
 * which is the shared <SettingsAbout/> (canon § Settings / About — the canonical
 * entries are the floor, not the ceiling). Manage accounts/categories/recurring;
 * pick currency, default account/category, appearance; see the receipt-scan and
 * sync capability rows; export/restore your data.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wallet, Tags, Repeat, Coins, Camera, RefreshCw, Upload, Download, FileDown, FileUp } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useBudgetStore, snapshotOf } from '../store/budget';
import { activeAccounts, activeCategories } from '../data/budget';
import { buildLedgerCsv } from '../data/csv';
import { exportArchive, exportCsv, importArchive, importCsv } from '../lib/transfer';
import { isReceiptScanSupported } from '../lib/receiptScan';
import { AboutRow } from '../components/AboutRow';
import { SettingsAbout } from '../components/SettingsAbout';
import { LanguageSetting } from '../components/LanguageSetting';
import { ScreenHeader } from '../components/ScreenHeader';
import TipJarSheet from '../components/TipJarSheet';
import { TIP_PRODUCT_IDS } from '../constants/tipProducts';
import { TIP_JAR_ENABLED } from '../lib/links';
import { t } from '../i18n';
import { useTheme, fontFamily, space, type as ty, boundedContent, type Colors, AppearanceToggle } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const store = useBudgetStore();
  const { settings } = store;
  const [status, setStatus] = useState<string | null>(null);
  const [tipVisible, setTipVisible] = useState(false);

  const accountName = useMemo(
    () => activeAccounts(store.accounts).find((a) => a.id === settings.defaultAccountId)?.name ?? t('settings.none'),
    [store.accounts, settings.defaultAccountId]
  );
  const categoryName = useMemo(
    () => activeCategories(store.categories, 'expense').find((cat) => cat.id === settings.defaultCategoryId)?.name ?? t('settings.none'),
    [store.categories, settings.defaultCategoryId]
  );

  const onExportJson = useCallback(() => {
    exportArchive(snapshotOf(useBudgetStore.getState())).catch(() => setStatus(t('settings.couldntExport')));
  }, []);

  const onExportCsv = useCallback(() => {
    const st = useBudgetStore.getState();
    const csv = buildLedgerCsv(st.transactions, st.accounts, st.categories, st.settings.currencyCode);
    exportCsv(csv).catch(() => setStatus(t('settings.couldntExport')));
  }, []);

  const onRestore = useCallback(async () => {
    try {
      const snap = await importArchive();
      if (!snap) {
        setStatus(t('settings.nothingImported'));
        return;
      }
      store.importSnapshot(snap);
      setStatus(t('settings.restored'));
    } catch {
      setStatus(t('settings.couldntRead'));
    }
  }, [store]);

  const onImportCsv = useCallback(async () => {
    try {
      const rows = await importCsv(useBudgetStore.getState().settings.currencyCode);
      if (rows.length === 0) {
        setStatus(t('settings.nothingImported'));
        return;
      }
      const n = store.importCsvRows(rows);
      setStatus(t('settings.imported', { count: n }));
    } catch {
      setStatus(t('settings.couldntRead'));
    }
  }, [store]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('settings.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.sectionLabel}>{t('settings.manage')}</Text>
        <AboutRow label={t('settings.accounts')} icon={Wallet} onPress={() => navigation.navigate('Accounts')} />
        <AboutRow label={t('settings.categories')} icon={Tags} onPress={() => navigation.navigate('Categories')} />
        <AboutRow label={t('settings.recurring')} icon={Repeat} onPress={() => navigation.navigate('Recurring')} />

        <Text style={s.sectionLabel}>{t('settings.appearance')}</Text>
        <AppearanceToggle
          labels={{
            title: t('settings.appearance'),
            system: t('settings.themeSystem'),
            light: t('settings.themeLight'),
            dark: t('settings.themeDark'),
          }}
        />

        <Text style={s.sectionLabel}>{t('settings.language')}</Text>
        <LanguageSetting />

        <Text style={s.sectionLabel}>{t('settings.preferences')}</Text>
        <AboutRow label={t('settings.currency')} icon={Coins} value={settings.currencyCode} onPress={() => navigation.navigate('Choose', { field: 'currency' })} />
        <AboutRow label={t('settings.defaultAccount')} value={accountName} onPress={() => navigation.navigate('Choose', { field: 'defaultAccount' })} />
        <AboutRow label={t('settings.defaultCategory')} value={categoryName} onPress={() => navigation.navigate('Choose', { field: 'defaultCategory' })} />

        <AboutRow
          label={t('settings.receiptScan')}
          icon={Camera}
          value={isReceiptScanSupported() ? '' : t('settings.receiptScanUnsupported')}
        />
        <AboutRow label={t('settings.sync')} icon={RefreshCw} value={t('settings.syncComingSoon')} />

        <Text style={s.sectionLabel}>{t('settings.yourData')}</Text>
        <AboutRow label={t('settings.exportJson')} icon={Upload} onPress={onExportJson} />
        <AboutRow label={t('settings.exportCsv')} icon={FileDown} onPress={onExportCsv} />
        <AboutRow label={t('settings.restore')} icon={Download} onPress={onRestore} />
        <AboutRow label={t('settings.importCsv')} icon={FileUp} onPress={onImportCsv} />
        {status ? <Text style={s.status}>{status}</Text> : null}

        <SettingsAbout
          onAcknowledgements={() => navigation.navigate('Acknowledgements')}
          onSupport={TIP_JAR_ENABLED ? () => setTipVisible(true) : undefined}
        />
      </ScrollView>

      {tipVisible && (
        <TipJarSheet
          visible
          onDismiss={() => setTipVisible(false)}
          productIds={TIP_PRODUCT_IDS}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    content: { ...boundedContent, paddingBottom: space.s9 },
    sectionLabel: {
      ...ty.xs,
      fontFamily: fontFamily.sansSemibold,
      color: c.fgMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: space.s6,
      paddingTop: space.s7,
      paddingBottom: space.s3,
    },
    status: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted, paddingHorizontal: space.s6, paddingTop: space.s4 },
  });
}
