/**
 * Account-scope pill row above Home's period strip. "All accounts" plus one pill
 * per active account; tapping filters the chart, totals, and list to that
 * account. The caller hides this row entirely when only one account exists, so
 * single-account users never see the affordance (spec § Home).
 */

import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet, View } from 'react-native';
import type { Account } from '../data/budget';
import { categoryColor } from '../theme/categoryPalette';
import { t } from '../i18n';
import { useTheme, fontFamily, space, radius, type as ty, hairline, type Colors } from '../theme';

interface Props {
  accounts: Account[];
  selectedId?: string; // undefined = All accounts
  onSelect: (id?: string) => void;
}

export function AccountPills({ accounts, selectedId, onSelect }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);

  const pill = (key: string, label: string, active: boolean, color: string | null, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[s.pill, active && s.pillActive]}
    >
      {color ? <View style={[s.dot, { backgroundColor: color }]} /> : null}
      <Text style={[s.pillText, active && s.pillTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
    >
      {pill('all', t('home.allAccounts'), selectedId == null, null, () => onSelect(undefined))}
      {accounts.map((a) =>
        pill(a.id, a.name, selectedId === a.id, categoryColor(a.colorToken), () => onSelect(a.id))
      )}
    </ScrollView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    row: { gap: space.s3, paddingHorizontal: space.s5, paddingVertical: space.s2 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingHorizontal: space.s4,
      height: 34,
      borderRadius: radius.pill,
      borderWidth: hairline,
      borderColor: c.hairlineStrong,
      backgroundColor: c.bg,
    },
    pillActive: { backgroundColor: c.fg, borderColor: c.fg },
    pillText: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fg, maxWidth: 160 },
    pillTextActive: { color: c.bg, fontFamily: fontFamily.sansSemibold },
    dot: { width: 8, height: 8, borderRadius: 4 },
  });
}
