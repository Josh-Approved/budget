/**
 * Home — the budget dashboard. A category-breakdown donut for the active period
 * and account scope, the period totals (income / expenses / net), and the
 * transaction list grouped by day. The period switcher and account-scope pills
 * filter what's shown; the search icon swaps the period strip for an in-place
 * filter; the two bottom buttons add an expense (−) or income (+). Recurring
 * transactions materialized on launch surface as a quiet, tappable line.
 *
 * All numbers come from the pure trust core (src/data/*); this screen only
 * arranges them.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, SectionList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings as SettingsIcon, Search, X, Plus, Minus } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useBudgetStore } from '../store/budget';
import {
  activeTransactions,
  activeAccounts,
  accountBalanceMinor,
  totalBalanceMinor,
  transactionsInRange,
  periodTotals,
  categoryBreakdown,
  searchTransactions,
  groupByDay,
  periodLabel,
  signedMinor,
  type Transaction,
} from '../data/budget';
import { periodRange, tsToDateStr, parseDateStr, type PeriodType } from '../data/dates';
import { categoryIcon } from '../data/categoryIcons';
import { categoryColor } from '../theme/categoryPalette';
import { CategoryChart } from '../components/CategoryChart';
import { PeriodSwitcher } from '../components/PeriodSwitcher';
import { AccountPills } from '../components/AccountPills';
import { EmptyState } from '../components/EmptyState';
import { FundingFooter } from '../components/FundingFooter';
import { TextInput } from 'react-native';
import { formatMinor, formatSignedMinor } from '../lib/format';
import { t, formatDate, getLocale } from '../i18n';
import {
  useTheme,
  fontFamily,
  space,
  target,
  type as ty,
  hairline,
  radius,
  boundedContent,
  type Colors,
} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);

  const transactions = useBudgetStore((st) => st.transactions);
  const categories = useBudgetStore((st) => st.categories);
  const accountsAll = useBudgetStore((st) => st.accounts);
  const currency = useBudgetStore((st) => st.settings.currencyCode);
  const recurringAdded = useBudgetStore((st) => st.recurringAdded);
  const clearRecurringAdded = useBudgetStore((st) => st.clearRecurringAdded);

  const accounts = useMemo(() => activeAccounts(accountsAll), [accountsAll]);

  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [offset, setOffset] = useState(0);
  const [scope, setScope] = useState<string | undefined>(undefined); // account id or All
  const [selectedCat, setSelectedCat] = useState<string | undefined>(undefined);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  const today = tsToDateStr(Date.now());
  const [from, to] = periodRange(periodType, today, offset);

  const periodTxns = useMemo(
    () => transactionsInRange(transactions, from, to, scope),
    [transactions, from, to, scope]
  );
  const totals = useMemo(() => periodTotals(periodTxns), [periodTxns]);
  const breakdown = useMemo(
    () => categoryBreakdown(periodTxns, categories, 'expense'),
    [periodTxns, categories]
  );

  const scopeBalance = useMemo(() => {
    if (scope) {
      const a = accounts.find((x) => x.id === scope);
      return a ? accountBalanceMinor(a, transactions) : 0;
    }
    return totalBalanceMinor(accounts, transactions);
  }, [scope, accounts, transactions]);

  // List source: search (across all in scope) > category filter > whole period.
  const listTxns = useMemo(() => {
    if (searching) {
      const base = activeTransactions(transactions).filter((tx) =>
        scope ? tx.accountId === scope : true
      );
      return searchTransactions(base, query, categories).sort((a, b) =>
        a.occurredAt === b.occurredAt ? b.createdAt - a.createdAt : a.occurredAt < b.occurredAt ? 1 : -1
      );
    }
    if (selectedCat) return periodTxns.filter((tx) => tx.categoryId === selectedCat);
    return periodTxns;
  }, [searching, query, transactions, scope, categories, selectedCat, periodTxns]);

  const sections = useMemo(
    () =>
      groupByDay(listTxns).map((g) => ({
        title: g.dateStr,
        net: g.netMinor,
        data: g.transactions,
      })),
    [listTxns]
  );

  const catName = useMemo(() => new Map(categories.map((cat) => [cat.id, cat])), [categories]);
  const acctName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const openAdd = (kind: 'expense' | 'income') =>
    navigation.navigate('AddTransaction', { kind, accountId: scope });

  const showRecurringToast = recurringAdded > 0 && !searching;
  const showControls = !searching;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        {searching ? (
          <View style={s.searchRow}>
            <Search size={18} color={c.fgMuted} strokeWidth={1.5} />
            <TextInput
              style={s.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={t('home.searchPlaceholder')}
              placeholderTextColor={c.fgSubtle}
              accessibilityLabel={t('home.search')}
              autoFocus
              returnKeyType="search"
            />
            <Pressable
              onPress={() => {
                setSearching(false);
                setQuery('');
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              style={({ pressed }) => [s.iconBtn, pressed && s.pressed]}
            >
              <X size={20} color={c.fg} strokeWidth={1.5} />
            </Pressable>
          </View>
        ) : (
          <>
            <View>
              <Text style={s.title}>{t('home.title')}</Text>
              <Text style={s.balance}>
                {t('home.balance')} · {formatMinor(scopeBalance, currency)}
              </Text>
            </View>
            <View style={s.headerActions}>
              <Pressable
                onPress={() => setSearching(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('home.search')}
                style={({ pressed }) => [s.iconBtn, pressed && s.pressed]}
              >
                <Search size={22} color={c.fg} strokeWidth={1.5} />
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('Settings')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('settings.title')}
                style={({ pressed }) => [s.iconBtn, pressed && s.pressed]}
              >
                <SettingsIcon size={22} color={c.fg} strokeWidth={1.5} />
              </Pressable>
            </View>
          </>
        )}
      </View>

      {showRecurringToast ? (
        <Pressable onPress={clearRecurringAdded} style={s.toast} accessibilityRole="button">
          <Text style={s.toastText}>{t('home.recurringAdded', { count: recurringAdded })}</Text>
        </Pressable>
      ) : null}

      {!searching ? (
        <View style={s.controls}>
          {accounts.length > 1 ? (
            <AccountPills accounts={accounts} selectedId={scope} onSelect={setScope} />
          ) : null}
          <PeriodSwitcher
            type={periodType}
            onTypeChange={setPeriodType}
            offset={offset}
            onOffsetChange={(o) => {
              setOffset(o);
              setSelectedCat(undefined);
            }}
            label={periodLabel(periodType, from, getLocale())}
          />

          <View style={s.chartWrap}>
            <CategoryChart
              slices={breakdown}
              centerValue={formatMinor(totals.expenseMinor, currency)}
              centerLabel={t('home.spent')}
              selectedId={selectedCat}
              onSelect={(id) => setSelectedCat((cur) => (cur === id ? undefined : id))}
            />
          </View>

          <View style={s.totals}>
            <Totic styles={s} label={t('home.income')} value={formatMinor(totals.incomeMinor, currency)} />
            <Totic styles={s} label={t('home.expenses')} value={formatMinor(totals.expenseMinor, currency)} />
            <Totic styles={s} label={t('home.net')} value={formatSignedMinor(totals.netMinor, currency)} />
          </View>
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <EmptyState message={searching ? t('home.emptySearch') : t('home.empty')} />
        }
        renderSectionHeader={({ section }) => (
          <View style={s.dayHeader}>
            <Text style={s.dayLabel}>
              {formatDate(parseDateStr(section.title), { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
            <Text style={s.dayNet}>{formatSignedMinor(section.net, currency)}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TxRow
            tx={item}
            styles={s}
            colors={c}
            currency={currency}
            categoryName={catName.get(item.categoryId)?.name ?? ''}
            categoryIconKey={catName.get(item.categoryId)?.icon ?? 'tag'}
            categoryColorToken={catName.get(item.categoryId)?.colorToken ?? 'cat-1'}
            accountName={scope ? undefined : acctName.get(item.accountId)}
            onPress={() => navigation.navigate('AddTransaction', { editId: item.id })}
          />
        )}
        ListFooterComponent={!searching ? <FundingFooter /> : null}
      />

      {!searching ? (
        <View style={s.fabRow}>
          <Pressable
            style={({ pressed }) => [s.fabSecondary, pressed && s.pressed]}
            onPress={() => openAdd('income')}
            accessibilityRole="button"
            accessibilityLabel={t('home.addIncome')}
          >
            <Plus size={24} color={c.fg} strokeWidth={2} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [s.fabPrimary, pressed && s.fabPressed]}
            onPress={() => openAdd('expense')}
            accessibilityRole="button"
            accessibilityLabel={t('home.addExpense')}
          >
            <Minus size={26} color={c.inkButtonText} strokeWidth={2.5} />
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function Totic({
  styles,
  label,
  value,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.totic}>
      <Text style={styles.toticValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.toticLabel}>{label}</Text>
    </View>
  );
}

function TxRow({
  tx,
  styles,
  colors,
  currency,
  categoryName,
  categoryIconKey,
  categoryColorToken,
  accountName,
  onPress,
}: {
  tx: Transaction;
  styles: ReturnType<typeof makeStyles>;
  colors: Colors;
  currency: string;
  categoryName: string;
  categoryIconKey: string;
  categoryColorToken: string;
  accountName?: string;
  onPress: () => void;
}) {
  const Icon = categoryIcon(categoryIconKey);
  const tint = categoryColor(categoryColorToken);
  const primary = tx.note || categoryName;
  const secondary = [tx.note ? categoryName : null, accountName].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${primary}, ${formatSignedMinor(signedMinor(tx), currency)}`}
      style={({ pressed }) => [styles.txRow, pressed && styles.pressed]}
    >
      <View style={[styles.txIcon, { backgroundColor: tint + '22' }]}>
        <Icon size={18} color={tint} strokeWidth={1.75} />
      </View>
      <View style={styles.txText}>
        <Text style={styles.txPrimary} numberOfLines={1}>
          {primary}
        </Text>
        {secondary ? (
          <Text style={styles.txSecondary} numberOfLines={1}>
            {secondary}
          </Text>
        ) : null}
      </View>
      <Text style={styles.txAmount}>{formatSignedMinor(signedMinor(tx), currency)}</Text>
    </Pressable>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    pressed: { opacity: 0.6 },
    header: {
      ...boundedContent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.s5,
      paddingTop: space.s3,
      paddingBottom: space.s3,
      minHeight: target.min,
    },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
    title: { ...ty.md, fontFamily: fontFamily.sansSemibold, color: c.fg },
    balance: { ...ty.sm, fontFamily: fontFamily.mono, color: c.fgMuted, marginTop: 1 },
    iconBtn: { width: target.min, height: target.min, alignItems: 'center', justifyContent: 'center' },
    searchRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.s3 },
    searchInput: { flex: 1, ...ty.base, fontFamily: fontFamily.sans, color: c.fg, paddingVertical: space.s2 },
    toast: {
      ...boundedContent,
      marginHorizontal: space.s5,
      marginBottom: space.s2,
      paddingVertical: space.s2,
      paddingHorizontal: space.s4,
      borderRadius: radius.md,
      backgroundColor: c.bgSubtle,
    },
    toastText: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted },
    controls: { ...boundedContent, gap: space.s3, paddingBottom: space.s3 },
    chartWrap: { paddingVertical: space.s3 },
    totals: { flexDirection: 'row', gap: space.s4, paddingHorizontal: space.s5 },
    totic: {
      flex: 1,
      backgroundColor: c.bgSubtle,
      borderRadius: radius.md,
      paddingVertical: space.s3,
      paddingHorizontal: space.s3,
      alignItems: 'center',
      gap: 2,
    },
    toticValue: { fontFamily: fontFamily.mono, fontSize: 15, lineHeight: 20, color: c.fg },
    toticLabel: { ...ty.xs, fontFamily: fontFamily.sans, color: c.fgMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
    listContent: { ...boundedContent, paddingBottom: space.s9 + space.s8 },
    dayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: space.s5,
      paddingTop: space.s5,
      paddingBottom: space.s2,
    },
    dayLabel: { ...ty.xs, fontFamily: fontFamily.sansSemibold, color: c.fgMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    dayNet: { ...ty.xs, fontFamily: fontFamily.mono, color: c.fgMuted },
    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
      minHeight: target.min + 8,
      paddingHorizontal: space.s5,
      borderBottomWidth: hairline,
      borderBottomColor: c.hairline,
    },
    txIcon: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    txText: { flex: 1 },
    txPrimary: { ...ty.base, fontFamily: fontFamily.sans, color: c.fg },
    txSecondary: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted },
    txAmount: { ...ty.base, fontFamily: fontFamily.mono, color: c.fg },
    fabRow: {
      position: 'absolute',
      right: space.s6,
      bottom: space.s7,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s4,
    },
    fabSecondary: {
      width: 52,
      height: 52,
      borderRadius: radius.pill,
      backgroundColor: c.bgElevated,
      borderWidth: hairline,
      borderColor: c.hairlineStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fabPrimary: {
      width: 60,
      height: 60,
      borderRadius: radius.pill,
      backgroundColor: c.inkButton,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fabPressed: { opacity: 0.85 },
  });
}
