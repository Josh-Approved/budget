/**
 * A small single-select list used by Settings for the three "pick one" prefs:
 * currency, default account, default category. One screen switched on the
 * `field` param so we don't grow three near-identical screens.
 */

import React, { useMemo } from 'react';
import { Text, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useBudgetStore } from '../store/budget';
import { activeAccounts, activeCategories } from '../data/budget';
import { COMMON_CURRENCIES } from '../data/currencies';
import { categoryColor } from '../theme/categoryPalette';
import { categoryIcon } from '../data/categoryIcons';
import { currencySymbol } from '../lib/format';
import { ScreenHeader } from '../components/ScreenHeader';
import { t } from '../i18n';
import { useTheme, fontFamily, space, target, type as ty, hairline, radius, boundedContent, type Colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Choose'>;

interface Option {
  id: string;
  label: string;
  hint?: string;
  color?: string;
  icon?: string;
}

export default function ChooseScreen({ navigation, route }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const store = useBudgetStore();
  const field = route.params.field;

  const { title, options, current, onPick } = useMemo(() => {
    if (field === 'currency') {
      const list = Array.from(new Set([store.settings.currencyCode, ...COMMON_CURRENCIES]));
      return {
        title: t('settings.currency'),
        current: store.settings.currencyCode,
        options: list.map<Option>((code) => ({ id: code, label: code, hint: currencySymbol(code) })),
        onPick: (id: string) => store.setCurrency(id),
      };
    }
    if (field === 'defaultAccount') {
      return {
        title: t('settings.defaultAccount'),
        current: store.settings.defaultAccountId,
        options: activeAccounts(store.accounts).map<Option>((a) => ({ id: a.id, label: a.name, color: categoryColor(a.colorToken) })),
        onPick: (id: string) => store.setDefaultAccount(id),
      };
    }
    return {
      title: t('settings.defaultCategory'),
      current: store.settings.defaultCategoryId,
      options: activeCategories(store.categories, 'expense').map<Option>((cat) => ({
        id: cat.id,
        label: cat.name,
        color: categoryColor(cat.colorToken),
        icon: cat.icon,
      })),
      onPick: (id: string) => store.setDefaultCategory(id),
    };
  }, [field, store]);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.content}>
        {options.map((opt) => {
          const selected = opt.id === current;
          const Icon = opt.icon ? categoryIcon(opt.icon) : null;
          let leading: React.ReactNode = null;
          if (Icon && opt.color) {
            leading = (
              <View style={[s.icon, { backgroundColor: opt.color + '22' }]}>
                <Icon size={16} color={opt.color} strokeWidth={1.75} />
              </View>
            );
          } else if (opt.color) {
            leading = <View style={[s.dot, { backgroundColor: opt.color }]} />;
          }
          return (
            <Pressable
              key={opt.id}
              onPress={() => {
                onPick(opt.id);
                navigation.goBack();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={opt.label}
              style={({ pressed }) => [s.row, pressed && s.pressed]}
            >
              {leading}
              <Text style={s.label}>{opt.label}</Text>
              {opt.hint ? <Text style={s.hint}>{opt.hint}</Text> : null}
              {selected ? <Check size={18} color={c.accent} strokeWidth={2} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    pressed: { opacity: 0.6 },
    content: { ...boundedContent, paddingBottom: space.s9 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.s3,
      minHeight: target.min + 4,
      paddingHorizontal: space.s6,
      borderBottomWidth: hairline,
      borderBottomColor: c.hairline,
    },
    icon: { width: 30, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    dot: { width: 12, height: 12, borderRadius: 6 },
    label: { ...ty.base, fontFamily: fontFamily.sans, color: c.fg, flex: 1 },
    hint: { ...ty.base, fontFamily: fontFamily.mono, color: c.fgMuted, marginRight: space.s2 },
  });
}
