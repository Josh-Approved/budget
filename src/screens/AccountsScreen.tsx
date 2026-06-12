/**
 * Accounts management (spec § Accounts). Each row shows the account's current
 * balance (starting balance + its transactions); tap to edit. Add opens the
 * edit screen for a new account. Same chrome as Categories so the two feel like
 * siblings.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useBudgetStore } from '../store/budget';
import { accountBalanceMinor, totalBalanceMinor, activeAccounts } from '../data/budget';
import { categoryColor } from '../theme/categoryPalette';
import { formatMinor } from '../lib/format';
import { ScreenHeader } from '../components/ScreenHeader';
import { t } from '../i18n';
import { useTheme, fontFamily, space, target, type as ty, hairline, radius, boundedContent, type Colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Accounts'>;

export default function AccountsScreen({ navigation }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const accountsAll = useBudgetStore((st) => st.accounts);
  const transactions = useBudgetStore((st) => st.transactions);
  const currency = useBudgetStore((st) => st.settings.currencyCode);

  const accounts = useMemo(() => activeAccounts(accountsAll), [accountsAll]);
  const total = useMemo(() => totalBalanceMinor(accounts, transactions), [accounts, transactions]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('accounts.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.content}>
        {accounts.map((a) => (
          <Pressable
            key={a.id}
            style={({ pressed }) => [s.row, pressed && s.pressed]}
            onPress={() => navigation.navigate('AccountEdit', { editId: a.id })}
            accessibilityRole="button"
            accessibilityLabel={`${a.name}, ${formatMinor(accountBalanceMinor(a, transactions), currency)}`}
          >
            <View style={[s.dot, { backgroundColor: categoryColor(a.colorToken) }]} />
            <Text style={s.name}>{a.name}</Text>
            <Text style={s.balance}>{formatMinor(accountBalanceMinor(a, transactions), currency)}</Text>
          </Pressable>
        ))}

        <View style={s.totalRow}>
          <Text style={s.totalLabel}>{t('accounts.total')}</Text>
          <Text style={s.totalValue}>{formatMinor(total, currency)}</Text>
        </View>

        <Pressable
          onPress={() => navigation.navigate('AccountEdit', {})}
          accessibilityRole="button"
          accessibilityLabel={t('accounts.add')}
          style={({ pressed }) => [s.addRow, pressed && s.pressed]}
        >
          <Plus size={18} color={c.fgMuted} strokeWidth={1.5} />
          <Text style={s.addText}>{t('accounts.add')}</Text>
        </Pressable>
      </ScrollView>
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
      gap: space.s4,
      minHeight: target.min + 8,
      paddingHorizontal: space.s5,
      borderBottomWidth: hairline,
      borderBottomColor: c.hairline,
    },
    dot: { width: 12, height: 12, borderRadius: 6 },
    name: { ...ty.base, fontFamily: fontFamily.sans, color: c.fg, flex: 1 },
    balance: { ...ty.base, fontFamily: fontFamily.mono, color: c.fg },
    totalRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.s5, paddingVertical: space.s4 },
    totalLabel: { ...ty.sm, fontFamily: fontFamily.sansSemibold, color: c.fgMuted, textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
    totalValue: { ...ty.md, fontFamily: fontFamily.mono, color: c.fg },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingHorizontal: space.s5, minHeight: target.min },
    addText: { ...ty.base, fontFamily: fontFamily.sans, color: c.fgMuted },
  });
}
