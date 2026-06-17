/**
 * Add / edit a category (modal from the Categories screen). Name, icon, color,
 * kind (new only), plus hide/show and delete on an existing one.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useBudgetStore } from '../store/budget';
import { type TxKind } from '../data/budget';
import { categoryColor } from '../theme/categoryPalette';
import { ColorPicker, IconPicker } from '../components/Picker';
import { ScreenHeader } from '../components/ScreenHeader';
import { t } from '../i18n';
import { useTheme, fontFamily, space, target, type as ty, radius, boundedContent, type Colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoryEdit'>;

export default function CategoryEditScreen({ navigation, route }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const store = useBudgetStore();
  const editing = store.categories.find((cat) => cat.id === route.params?.editId);
  const kind: TxKind = editing?.kind ?? route.params?.kind ?? 'expense';

  const [name, setName] = useState(editing?.name ?? '');
  const [icon, setIcon] = useState(editing?.icon ?? 'tag');
  const [color, setColor] = useState(editing?.colorToken ?? 'cat-1');

  const valid = name.trim().length > 0;

  const onSave = () => {
    if (!valid) return;
    if (editing) {
      store.updateCategory(editing.id, { name: name.trim(), icon, colorToken: color });
    } else {
      store.addCategory(name.trim(), kind, icon, color);
    }
    navigation.goBack();
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader
        title={editing ? t('categories.edit') : t('categories.add')}
        onBack={() => navigation.goBack()}
        right={
          <Pressable
            onPress={onSave}
            disabled={!valid}
            accessibilityRole="button"
            accessibilityLabel={t('common.save')}
            style={({ pressed }) => [s.saveBtn, pressed && s.pressed, !valid && s.disabled]}
          >
            <Check size={20} color={c.inkButtonText} strokeWidth={2.5} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.label}>{t('categories.name')}</Text>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder={t('categories.namePlaceholder')}
          placeholderTextColor={c.fgSubtle}
          accessibilityLabel={t('categories.name')}
          autoFocus={!editing}
          returnKeyType="done"
          onSubmitEditing={onSave}
        />

        <Text style={s.label}>{t('categories.color')}</Text>
        <ColorPicker value={color} onChange={setColor} />

        <Text style={s.label}>{t('categories.icon')}</Text>
        <IconPicker value={icon} tint={categoryColor(color)} onChange={setIcon} />

        {editing ? (
          <View style={s.actions}>
            <Pressable
              onPress={() => {
                store.updateCategory(editing.id, { hidden: !editing.hidden });
                navigation.goBack();
              }}
              accessibilityRole="button"
              style={({ pressed }) => [s.action, pressed && s.pressed]}
            >
              <Text style={s.actionText}>{editing.hidden ? t('categories.show') : t('categories.hide')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                store.deleteCategory(editing.id);
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
    actions: { flexDirection: 'row', gap: space.s5, paddingTop: space.s7 },
    action: { minHeight: target.min, justifyContent: 'center' },
    actionText: { ...ty.base, fontFamily: fontFamily.sans, color: c.fg },
  });
}
