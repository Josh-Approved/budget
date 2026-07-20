/**
 * Add / edit a transaction — the core action (spec § Add transaction). A custom
 * amount keypad (so the Monefy-style "type amount → tap category → save" flow is
 * three taps after open and works identically on both platforms — no OS keyboard
 * needed), a category grid for the chosen kind, an account picker (hidden with a
 * single account), a date stepper (defaults today), an optional note, and — when
 * adding — a repeat option that also creates a recurring rule. On supported
 * devices a "Scan a receipt" entry appears; it is capability-gated and hidden
 * until the on-device native module ships (lib/receiptScan.ts).
 */

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Delete, ChevronLeft, ChevronRight, Repeat, Trash2, Camera } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useBudgetStore } from '../store/budget';
import {
  activeAccounts,
  activeCategories,
  type Category,
  type TxKind,
  type Frequency,
} from '../data/budget';
import { tsToDateStr, addDays, parseDateStr } from '../data/dates';
import { advanceDueDate } from '../data/recurring';
import { parseAmountToMinor } from '../data/money';
import { categoryIcon } from '../data/categoryIcons';
import { categoryColor } from '../theme/categoryPalette';
import { isReceiptScanSupported } from '../lib/receiptScan';
import ReviewModal from '../components/ReviewModal';
import { recordSuccessfulCompletion } from '../storage/reviewPrompt';
import { IOS_APP_STORE_ID, ANDROID_PACKAGE } from '../lib/links';
import { ScreenHeader } from '../components/ScreenHeader';
import { currencySymbol } from '../lib/format';
import { t, formatDate } from '../i18n';
import {
  useTheme,
  fontFamily,
  space,
  target,
  type as ty,
  radius,
  hairline,
  boundedContent,
  type Colors,
} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddTransaction'>;

const FREQS: Frequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

export default function AddTransactionScreen({ navigation, route }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);

  const store = useBudgetStore();
  const editId = route.params?.editId;
  const editing = store.transactions.find((tx) => tx.id === editId);

  const currency = store.settings.currencyCode;
  const accounts = useMemo(() => activeAccounts(store.accounts), [store.accounts]);

  const [kind, setKind] = useState<TxKind>(editing?.kind ?? route.params?.kind ?? 'expense');
  const [amount, setAmount] = useState<string>(
    editing ? String(editing.amountMinor / 100) : ''
  );
  const [categoryId, setCategoryId] = useState<string | undefined>(
    editing?.categoryId ?? store.settings.defaultCategoryId
  );
  const [accountId, setAccountId] = useState<string>(
    editing?.accountId ?? route.params?.accountId ?? store.settings.defaultAccountId ?? accounts[0]?.id ?? ''
  );
  const [dateStr, setDateStr] = useState<string>(editing?.occurredAt ?? tsToDateStr(Date.now()));
  const [note, setNote] = useState<string>(editing?.note ?? '');
  const [repeat, setRepeat] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [reviewVisible, setReviewVisible] = useState(false);

  const cats = useMemo(() => activeCategories(store.categories, kind), [store.categories, kind]);
  // Keep the selected category valid for the chosen kind.
  const selectedCat = cats.find((cat) => cat.id === categoryId) ?? cats[0];
  const minor = parseAmountToMinor(amount || '0', currency) ?? 0;
  const valid = minor > 0 && !!selectedCat && !!accountId;

  const onKey = (k: string) => {
    setAmount((cur) => {
      if (k === 'del') return cur.slice(0, -1);
      if (k === '.') {
        if (cur.includes('.')) return cur;
        return cur === '' ? '0.' : cur + '.';
      }
      // limit to 2 decimals
      const dot = cur.indexOf('.');
      if (dot >= 0 && cur.length - dot > 2) return cur;
      if (cur === '0') return k; // avoid leading zeros
      return cur + k;
    });
  };

  const onSave = () => {
    if (!valid || !selectedCat) return;
    if (editing) {
      store.updateTransaction(editing.id, {
        kind,
        amountMinor: minor,
        accountId,
        categoryId: selectedCat.id,
        occurredAt: dateStr,
        note: note.trim() || undefined,
      });
      navigation.goBack();
      return;
    }
    store.addTransaction({
      kind,
      amountMinor: minor,
      accountId,
      categoryId: selectedCat.id,
      occurredAt: dateStr,
      note: note.trim() || undefined,
    });
    if (repeat) {
      store.addRecurringRule({
        kind,
        amountMinor: minor,
        accountId,
        categoryId: selectedCat.id,
        note: note.trim() || undefined,
        frequency,
        interval: 1,
        // first auto-entry is the NEXT occurrence (we already added this one)
        startDate: advanceDueDate(dateStr, frequency, 1),
      });
    }
    // Saving a transaction is this app's genuine success. The canonical counter
    // gates the prompt to the 2nd completion (cap 3) so it can't spam; hold this
    // screen's dismissal until the prompt resolves.
    recordSuccessfulCompletion()
      .then((show) => {
        if (show) setReviewVisible(true);
        else navigation.goBack();
      })
      .catch(() => navigation.goBack());
  };

  const onDelete = () => {
    if (!editing) return;
    Alert.alert(t('tx.delete'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('recurring.delete'),
        style: 'destructive',
        onPress: () => {
          store.deleteTransaction(editing.id);
          navigation.goBack();
        },
      },
    ]);
  };

  const symbol = currencySymbol(currency);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader
        title={editing ? t('tx.edit') : kind === 'expense' ? t('tx.newExpense') : t('tx.newIncome')}
        onBack={() => navigation.goBack()}
        right={
          <Pressable
            onPress={onSave}
            disabled={!valid}
            accessibilityRole="button"
            accessibilityLabel={t('tx.save')}
            style={({ pressed }) => [s.saveBtn, pressed && s.pressed, !valid && s.disabled]}
          >
            <Check size={20} color={c.inkButtonText} strokeWidth={2.5} />
          </Pressable>
        }
      />

      <ReviewModal
        visible={reviewVisible}
        onDismiss={() => {
          setReviewVisible(false);
          navigation.goBack();
        }}
        appName="Budget"
        iosAppStoreId={IOS_APP_STORE_ID}
        androidPackageName={ANDROID_PACKAGE}
      />

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {/* Kind toggle */}
        <View style={s.kindRow}>
          {(['expense', 'income'] as TxKind[]).map((k) => {
            const active = k === kind;
            return (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t(`common.${k}`)}
                style={[s.kindBtn, active && s.kindBtnActive]}
              >
                <Text style={[s.kindText, active && s.kindTextActive]}>{t(`common.${k}`)}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Amount display */}
        <View style={s.amountWrap}>
          <Text style={s.amount} numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={t('tx.amount')}>
            {symbol}
            {amount || '0'}
          </Text>
        </View>

        {isReceiptScanSupported() ? (
          <Pressable style={s.scanRow} accessibilityRole="button" accessibilityLabel={t('tx.scanReceipt')}>
            <Camera size={18} color={c.fgMuted} strokeWidth={1.5} />
            <Text style={s.scanText}>{t('tx.scanReceipt')}</Text>
          </Pressable>
        ) : null}

        {/* Category grid */}
        <Text style={s.label}>{t('tx.category')}</Text>
        <View style={s.grid}>
          {cats.map((cat) => (
            <CategoryTile
              key={cat.id}
              cat={cat}
              styles={s}
              colors={c}
              selected={cat.id === selectedCat?.id}
              onPress={() => setCategoryId(cat.id)}
            />
          ))}
        </View>

        {/* Account picker (hidden with a single account) */}
        {accounts.length > 1 ? (
          <>
            <Text style={s.label}>{t('tx.account')}</Text>
            <View style={s.accountRow}>
              {accounts.map((a) => {
                const active = a.id === accountId;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => setAccountId(a.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={a.name}
                    style={[s.accountPill, active && s.accountPillActive]}
                  >
                    <View style={[s.dot, { backgroundColor: categoryColor(a.colorToken) }]} />
                    <Text style={[s.accountText, active && s.accountTextActive]}>{a.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {/* Date stepper */}
        <Text style={s.label}>{t('tx.date')}</Text>
        <View style={s.dateRow}>
          <Pressable
            onPress={() => setDateStr((d) => addDays(d, -1))}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('period.previous')}
            style={({ pressed }) => [s.stepBtn, pressed && s.pressed]}
          >
            <ChevronLeft size={20} color={c.fg} strokeWidth={1.5} />
          </Pressable>
          <Pressable onPress={() => setDateStr(tsToDateStr(Date.now()))} style={s.dateLabelWrap}>
            <Text style={s.dateLabel}>
              {formatDate(parseDateStr(dateStr), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setDateStr((d) => addDays(d, 1))}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('period.next')}
            style={({ pressed }) => [s.stepBtn, pressed && s.pressed]}
          >
            <ChevronRight size={20} color={c.fg} strokeWidth={1.5} />
          </Pressable>
        </View>

        {/* Note */}
        <Text style={s.label}>{t('tx.note')}</Text>
        <TextInput
          style={s.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder={t('tx.notePlaceholder')}
          placeholderTextColor={c.fgSubtle}
          accessibilityLabel={t('tx.note')}
          multiline
          textAlignVertical="top"
        />

        {/* Repeat (new transactions only) */}
        {!editing ? (
          <>
            <Pressable
              onPress={() => setRepeat((r) => !r)}
              accessibilityRole="switch"
              accessibilityState={{ checked: repeat }}
              accessibilityLabel={t('tx.repeat')}
              style={({ pressed }) => [s.repeatRow, pressed && s.pressed]}
            >
              <Repeat size={18} color={c.fgMuted} strokeWidth={1.5} />
              <Text style={s.repeatLabel}>{t('tx.repeat')}</Text>
              <Text style={s.repeatValue}>{repeat ? t(`freq.${frequency}`) : t('tx.repeatNever')}</Text>
            </Pressable>
            {repeat ? (
              <View style={s.freqRow}>
                {FREQS.map((f) => {
                  const active = f === frequency;
                  return (
                    <Pressable
                      key={f}
                      onPress={() => setFrequency(f)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={t(`freq.${f}`)}
                      style={[s.freqBtn, active && s.freqBtnActive]}
                    >
                      <Text style={[s.freqText, active && s.freqTextActive]}>{t(`freq.${f}`)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </>
        ) : null}

        {editing ? (
          <Pressable
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={t('tx.delete')}
            style={({ pressed }) => [s.deleteRow, pressed && s.pressed]}
          >
            <Trash2 size={18} color={c.danger} strokeWidth={1.5} />
            <Text style={s.deleteText}>{t('tx.delete')}</Text>
          </Pressable>
        ) : null}

        {/* Keypad */}
        <View style={s.keypad}>
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['.', '0', 'del']].map((row, ri) => (
            <View key={ri} style={s.keyRow}>
              {row.map((k) => (
                <Pressable
                  key={k}
                  onPress={() => onKey(k)}
                  accessibilityRole="button"
                  accessibilityLabel={k === 'del' ? 'Delete' : k}
                  style={({ pressed }) => [s.key, pressed && s.keyPressed]}
                >
                  {k === 'del' ? (
                    <Delete size={22} color={c.fg} strokeWidth={1.5} />
                  ) : (
                    <Text style={s.keyText}>{k}</Text>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CategoryTile({
  cat,
  styles,
  colors,
  selected,
  onPress,
}: {
  cat: Category;
  styles: ReturnType<typeof makeStyles>;
  colors: Colors;
  selected: boolean;
  onPress: () => void;
}) {
  const Icon = categoryIcon(cat.icon);
  const tint = categoryColor(cat.colorToken);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={cat.name}
      style={[styles.tile, selected && { borderColor: tint, backgroundColor: tint + '18' }]}
    >
      <View style={[styles.tileIcon, { backgroundColor: tint + '22' }]}>
        <Icon size={20} color={tint} strokeWidth={1.75} />
      </View>
      <Text style={styles.tileText} numberOfLines={1}>
        {cat.name}
      </Text>
    </Pressable>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    pressed: { opacity: 0.6 },
    disabled: { opacity: 0.4 },
    body: { ...boundedContent, paddingHorizontal: space.s5, paddingBottom: space.s8, gap: space.s3 },
    saveBtn: {
      width: target.min,
      height: target.min,
      borderRadius: radius.md,
      backgroundColor: c.inkButton,
      alignItems: 'center',
      justifyContent: 'center',
    },
    kindRow: { flexDirection: 'row', backgroundColor: c.bgSubtle, borderRadius: radius.md, padding: 3, marginTop: space.s3 },
    kindBtn: { flex: 1, alignItems: 'center', paddingVertical: space.s2, borderRadius: radius.sm },
    kindBtnActive: { backgroundColor: c.bgElevated },
    kindText: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted },
    kindTextActive: { fontFamily: fontFamily.sansSemibold, color: c.fg },
    amountWrap: { alignItems: 'center', paddingVertical: space.s4 },
    amount: { fontFamily: fontFamily.mono, fontSize: 44, lineHeight: 52, color: c.fg },
    scanRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      alignSelf: 'center',
      paddingVertical: space.s2,
      paddingHorizontal: space.s4,
      borderRadius: radius.pill,
      borderWidth: hairline,
      borderColor: c.hairlineStrong,
    },
    scanText: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted },
    label: {
      ...ty.xs,
      fontFamily: fontFamily.sansSemibold,
      color: c.fgMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingTop: space.s3,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
    tile: {
      width: '23.5%',
      alignItems: 'center',
      gap: space.s2,
      paddingVertical: space.s3,
      borderRadius: radius.md,
      borderWidth: hairline,
      borderColor: 'transparent',
    },
    tileIcon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    tileText: { ...ty.xs, fontFamily: fontFamily.sans, color: c.fg, textAlign: 'center' },
    accountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
    accountPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingHorizontal: space.s4,
      height: 36,
      borderRadius: radius.pill,
      borderWidth: hairline,
      borderColor: c.hairlineStrong,
    },
    accountPillActive: { backgroundColor: c.fg, borderColor: c.fg },
    accountText: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fg },
    accountTextActive: { color: c.bg, fontFamily: fontFamily.sansSemibold },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s4 },
    stepBtn: { width: target.min, height: target.min, alignItems: 'center', justifyContent: 'center' },
    dateLabelWrap: { flex: 1, alignItems: 'center' },
    dateLabel: { ...ty.base, fontFamily: fontFamily.sansSemibold, color: c.fg },
    noteInput: {
      minHeight: target.min * 1.6,
      paddingHorizontal: space.s4,
      paddingTop: space.s3,
      paddingBottom: space.s3,
      borderRadius: radius.md,
      backgroundColor: c.bgSubtle,
      ...ty.base,
      fontFamily: fontFamily.sans,
      color: c.fg,
    },
    repeatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      minHeight: target.min,
      paddingTop: space.s4,
    },
    repeatLabel: { ...ty.base, fontFamily: fontFamily.sans, color: c.fg, flex: 1 },
    repeatValue: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted },
    freqRow: { flexDirection: 'row', backgroundColor: c.bgSubtle, borderRadius: radius.md, padding: 3 },
    freqBtn: { flex: 1, alignItems: 'center', paddingVertical: space.s2, borderRadius: radius.sm },
    freqBtnActive: { backgroundColor: c.bgElevated },
    freqText: { ...ty.xs, fontFamily: fontFamily.sans, color: c.fgMuted },
    freqTextActive: { fontFamily: fontFamily.sansSemibold, color: c.fg },
    deleteRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: target.min, paddingTop: space.s4 },
    deleteText: { ...ty.base, fontFamily: fontFamily.sans, color: c.danger },
    keypad: { gap: space.s2, paddingTop: space.s4 },
    keyRow: { flexDirection: 'row', gap: space.s2 },
    key: {
      flex: 1,
      height: 52,
      borderRadius: radius.md,
      backgroundColor: c.bgSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyPressed: { backgroundColor: c.hairline },
    keyText: { fontFamily: fontFamily.mono, fontSize: 22, lineHeight: 28, color: c.fg },
  });
}
