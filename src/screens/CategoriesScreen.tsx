/**
 * Categories management (spec § Categories). Expense and income categories in
 * two sections, each row reorderable (up/down), tap to edit. Hidden categories
 * stay listed (dimmed with a tag) so they can be shown again. Add opens the
 * edit screen for a new category.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, ChevronUp, ChevronDown } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useBudgetStore } from '../store/budget';
import { type Category, type TxKind } from '../data/budget';
import { categoryIcon } from '../data/categoryIcons';
import { categoryColor } from '../theme/categoryPalette';
import { ScreenHeader } from '../components/ScreenHeader';
import { t } from '../i18n';
import { useTheme, fontFamily, space, target, type as ty, hairline, radius, boundedContent, type Colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Categories'>;

export default function CategoriesScreen({ navigation }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const categories = useBudgetStore((st) => st.categories);
  const moveCategory = useBudgetStore((st) => st.moveCategory);

  const byKind = (kind: TxKind) =>
    categories
      .filter((cat) => cat.deletedAt == null && cat.kind === kind)
      .sort((a, b) => a.sortOrder - b.sortOrder);

  const expense = useMemo(() => byKind('expense'), [categories]);
  const income = useMemo(() => byKind('income'), [categories]);

  const renderSection = (label: string, list: Category[], kind: TxKind) => (
    <>
      <View style={s.sectionHead}>
        <Text style={s.sectionLabel}>{label}</Text>
      </View>
      {list.map((cat, i) => {
        const Icon = categoryIcon(cat.icon);
        const tint = categoryColor(cat.colorToken);
        return (
          <View key={cat.id} style={s.row}>
            <Pressable
              style={s.rowMain}
              onPress={() => navigation.navigate('CategoryEdit', { editId: cat.id })}
              accessibilityRole="button"
              accessibilityLabel={cat.name}
            >
              <View style={[s.icon, { backgroundColor: tint + '22' }]}>
                <Icon size={18} color={tint} strokeWidth={1.75} />
              </View>
              <Text style={[s.name, cat.hidden && s.nameHidden]}>{cat.name}</Text>
              {cat.hidden ? <Text style={s.tag}>{t('categories.hidden')}</Text> : null}
            </Pressable>
            <Pressable
              onPress={() => moveCategory(cat.id, -1)}
              disabled={i === 0}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('categories.moveUp')}
              style={({ pressed }) => [s.stepBtn, pressed && s.pressed, i === 0 && s.disabled]}
            >
              <ChevronUp size={18} color={c.fgMuted} strokeWidth={1.5} />
            </Pressable>
            <Pressable
              onPress={() => moveCategory(cat.id, 1)}
              disabled={i === list.length - 1}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('categories.moveDown')}
              style={({ pressed }) => [s.stepBtn, pressed && s.pressed, i === list.length - 1 && s.disabled]}
            >
              <ChevronDown size={18} color={c.fgMuted} strokeWidth={1.5} />
            </Pressable>
          </View>
        );
      })}
      <Pressable
        onPress={() => navigation.navigate('CategoryEdit', { kind })}
        accessibilityRole="button"
        accessibilityLabel={t('categories.add')}
        style={({ pressed }) => [s.addRow, pressed && s.pressed]}
      >
        <Plus size={18} color={c.fgMuted} strokeWidth={1.5} />
        <Text style={s.addText}>{t('categories.add')}</Text>
      </Pressable>
    </>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={t('categories.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.content}>
        {renderSection(t('categories.expensesHeader'), expense, 'expense')}
        {renderSection(t('categories.incomeHeader'), income, 'income')}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    pressed: { opacity: 0.6 },
    disabled: { opacity: 0.25 },
    content: { ...boundedContent, paddingBottom: space.s9 },
    sectionHead: { paddingHorizontal: space.s6, paddingTop: space.s6, paddingBottom: space.s2 },
    sectionLabel: { ...ty.xs, fontFamily: fontFamily.sansSemibold, color: c.fgMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: target.min + 6,
      paddingHorizontal: space.s5,
      borderBottomWidth: hairline,
      borderBottomColor: c.hairline,
    },
    rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.s4 },
    icon: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    name: { ...ty.base, fontFamily: fontFamily.sans, color: c.fg, flex: 1 },
    nameHidden: { color: c.fgMuted },
    tag: { ...ty.xs, fontFamily: fontFamily.sans, color: c.fgMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
    stepBtn: { width: 36, height: target.min, alignItems: 'center', justifyContent: 'center' },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3, paddingHorizontal: space.s5, minHeight: target.min },
    addText: { ...ty.base, fontFamily: fontFamily.sans, color: c.fgMuted },
  });
}
