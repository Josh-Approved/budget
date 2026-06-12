/**
 * Recurring transactions list (spec § Recurring, Settings entry). Each rule
 * shows its amount, category, frequency, and next due date, with pause/resume
 * and delete. Materialization itself happens on app open (store.hydrate) — this
 * screen just manages the rules.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pause, Play, Trash2 } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useBudgetStore } from '../store/budget';
import { parseDateStr } from '../data/dates';
import { categoryIcon } from '../data/categoryIcons';
import { categoryColor } from '../theme/categoryPalette';
import { EmptyState } from '../components/EmptyState';
import { ScreenHeader } from '../components/ScreenHeader';
import { formatSignedMinor } from '../lib/format';
import { t, formatDate } from '../i18n';
import { useTheme, fontFamily, space, target, type as ty, hairline, radius, boundedContent, type Colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Recurring'>;

export default function RecurringScreen({ navigation }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const rules = useBudgetStore((st) => st.recurringRules);
  const categories = useBudgetStore((st) => st.categories);
  const currency = useBudgetStore((st) => st.settings.currencyCode);
  const updateRule = useBudgetStore((st) => st.updateRecurringRule);
  const deleteRule = useBudgetStore((st) => st.deleteRecurringRule);

  const active = useMemo(() => rules.filter((r) => r.deletedAt == null), [rules]);
  const catById = useMemo(() => new Map(categories.map((cat) => [cat.id, cat])), [categories]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('recurring.title')} onBack={() => navigation.goBack()} />
      {active.length === 0 ? (
        <EmptyState message={t('recurring.empty')} />
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {active.map((r) => {
            const cat = catById.get(r.categoryId);
            const Icon = categoryIcon(cat?.icon ?? 'tag');
            const tint = categoryColor(cat?.colorToken ?? 'cat-1');
            return (
              <View key={r.id} style={s.row}>
                <View style={[s.icon, { backgroundColor: tint + '22' }]}>
                  <Icon size={18} color={tint} strokeWidth={1.75} />
                </View>
                <View style={s.text}>
                  <Text style={s.primary} numberOfLines={1}>
                    {r.note || cat?.name || ''}
                  </Text>
                  <Text style={s.secondary}>
                    {t(`freq.${r.frequency}`)} ·{' '}
                    {r.paused
                      ? t('recurring.paused')
                      : t('recurring.next', {
                          date: formatDate(parseDateStr(r.nextDueDate), { month: 'short', day: 'numeric' }),
                        })}
                  </Text>
                </View>
                <Text style={s.amount}>
                  {formatSignedMinor(r.kind === 'income' ? r.amountMinor : -r.amountMinor, currency)}
                </Text>
                <Pressable
                  onPress={() => updateRule(r.id, { paused: !r.paused })}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={r.paused ? t('recurring.resume') : t('recurring.pause')}
                  style={({ pressed }) => [s.actionBtn, pressed && s.pressed]}
                >
                  {r.paused ? (
                    <Play size={18} color={c.fgMuted} strokeWidth={1.5} />
                  ) : (
                    <Pause size={18} color={c.fgMuted} strokeWidth={1.5} />
                  )}
                </Pressable>
                <Pressable
                  onPress={() => deleteRule(r.id)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={t('recurring.delete')}
                  style={({ pressed }) => [s.actionBtn, pressed && s.pressed]}
                >
                  <Trash2 size={18} color={c.fgSubtle} strokeWidth={1.5} />
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    pressed: { opacity: 0.6 },
    content: { ...boundedContent, paddingTop: space.s3, paddingBottom: space.s9 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      minHeight: target.min + 10,
      paddingHorizontal: space.s5,
      borderBottomWidth: hairline,
      borderBottomColor: c.hairline,
    },
    icon: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    text: { flex: 1 },
    primary: { ...ty.base, fontFamily: fontFamily.sans, color: c.fg },
    secondary: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted },
    amount: { ...ty.sm, fontFamily: fontFamily.mono, color: c.fg },
    actionBtn: { width: 32, height: target.min, alignItems: 'center', justifyContent: 'center' },
  });
}
