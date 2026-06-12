/**
 * Add / edit an account (modal from the Accounts screen). Name, starting
 * balance, color, plus archive and delete on an existing one. A deleted account
 * is soft-removed; its transactions stay for historical integrity.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useBudgetStore } from '../store/budget';
import { parseAmountToMinor } from '../data/money';
import { minorToMajor } from '../data/money';
import { ColorPicker } from '../components/Picker';
import { ScreenHeader } from '../components/ScreenHeader';
import { currencySymbol } from '../lib/format';
import { t } from '../i18n';
import { useTheme, fontFamily, space, target, type as ty, radius, boundedContent, type Colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AccountEdit'>;

export default function AccountEditScreen({ navigation, route }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const store = useBudgetStore();
  const editing = store.accounts.find((a) => a.id === route.params?.editId);
  const currency = store.settings.currencyCode;

  const [name, setName] = useState(editing?.name ?? '');
  const [balance, setBalance] = useState(
    editing ? String(minorToMajor(editing.startingBalanceMinor, currency)) : ''
  );
  const [color, setColor] = useState(editing?.colorToken ?? 'cat-11');

  const valid = name.trim().length > 0;

  const onSave = () => {
    if (!valid) return;
    const startingMinor = parseAmountToMinor(balance || '0', currency) ?? 0;
    if (editing) {
      store.updateAccount(editing.id, { name: name.trim(), startingBalanceMinor: startingMinor, colorToken: color });
    } else {
      store.addAccount(name.trim(), startingMinor, color);
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader
        title={editing ? t('accounts.edit') : t('accounts.add')}
        onBack={() => navigation.goBack()}
        right={
          <Pressable
            onPress={onSave}
            disabled={!valid}
            accessibilityRole="button"
            accessibilityLabel={t('common.save')}
            style={({ pressed }) => [s.saveBtn, pressed && s.pressed, !valid && s.disabled]}
          >
            <Check size={20} color={c.fgOnInk} strokeWidth={2.5} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.label}>{t('accounts.name')}</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder={t('accounts.namePlaceholder')}
          placeholderTextColor={c.fgSubtle}
          accessibilityLabel={t('accounts.name')}
          autoFocus={!editing}
          returnKeyType="done"
        />

        <Text style={s.label}>{t('accounts.startingBalance')}</Text>
        <View style={s.balanceRow}>
          <Text style={s.symbol}>{currencySymbol(currency)}</Text>
          <TextInput
            style={s.balanceInput}
            value={balance}
            onChangeText={setBalance}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={c.fgSubtle}
            accessibilityLabel={t('accounts.startingBalance')}
          />
        </View>

        <Text style={s.label}>{t('accounts.color')}</Text>
        <ColorPicker value={color} onChange={setColor} />

        {editing ? (
          <View style={s.actions}>
            <Pressable
              onPress={() => {
                store.updateAccount(editing.id, { archived: !editing.archived });
                navigation.goBack();
              }}
              accessibilityRole="button"
              style={({ pressed }) => [s.action, pressed && s.pressed]}
            >
              <Text style={s.actionText}>{t('accounts.archive')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                store.deleteAccount(editing.id);
                navigation.goBack();
              }}
              accessibilityRole="button"
              style={({ pressed }) => [s.action, pressed && s.pressed]}
            >
              <Text style={[s.actionText, { color: c.danger }]}>{t('common.delete')}</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    pressed: { opacity: 0.6 },
    disabled: { opacity: 0.4 },
    body: { ...boundedContent, paddingHorizontal: space.s6, paddingBottom: space.s9, gap: space.s3 },
    saveBtn: { width: target.min, height: target.min, borderRadius: radius.md, backgroundColor: c.inkButton, alignItems: 'center', justifyContent: 'center' },
    label: { ...ty.xs, fontFamily: fontFamily.sansSemibold, color: c.fgMuted, textTransform: 'uppercase', letterSpacing: 0.5, paddingTop: space.s5 },
    input: {
      minHeight: target.min,
      paddingHorizontal: space.s4,
      borderRadius: radius.md,
      backgroundColor: c.bgSubtle,
      ...ty.base,
      fontFamily: fontFamily.sans,
      color: c.fg,
    },
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s2,
      paddingHorizontal: space.s4,
      minHeight: target.min,
      borderRadius: radius.md,
      backgroundColor: c.bgSubtle,
    },
    symbol: { ...ty.md, fontFamily: fontFamily.mono, color: c.fgMuted },
    balanceInput: { flex: 1, ...ty.md, fontFamily: fontFamily.mono, color: c.fg, paddingVertical: space.s2 },
    actions: { flexDirection: 'row', gap: space.s5, paddingTop: space.s7 },
    action: { minHeight: target.min, justifyContent: 'center' },
    actionText: { ...ty.base, fontFamily: fontFamily.sans, color: c.fg },
  });
}
