/**
 * Two small reusable pickers for the edit screens: a swatch grid for the
 * categorical palette and an icon grid for the curated category icons. Both are
 * single-select, design-system restrained.
 */

import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { CATEGORY_COLOR_TOKENS, categoryColor } from '../theme/categoryPalette';
import { CATEGORY_ICONS, categoryIcon } from '../data/categoryIcons';
import { useTheme, space, radius, hairline, type Colors } from '../theme';

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (token: string) => void;
}) {
  const { c } = useTheme();
  const s = makeStyles(c);
  return (
    <View style={s.grid}>
      {CATEGORY_COLOR_TOKENS.map((token) => {
        const selected = token === value;
        return (
          <Pressable
            key={token}
            onPress={() => onChange(token)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Color ${token}`}
            style={[s.swatch, { backgroundColor: categoryColor(token) }, selected && s.swatchSelected]}
          />
        );
      })}
    </View>
  );
}

export function IconPicker({
  value,
  tint,
  onChange,
}: {
  value: string;
  tint: string;
  onChange: (key: string) => void;
}) {
  const { c } = useTheme();
  const s = makeStyles(c);
  return (
    <View style={s.grid}>
      {Object.keys(CATEGORY_ICONS).map((key) => {
        const Icon = categoryIcon(key);
        const selected = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Icon ${key}`}
            style={[s.iconCell, selected && { borderColor: tint, backgroundColor: tint + '18' }]}
          >
            <Icon size={20} color={selected ? tint : c.fgMuted} strokeWidth={1.75} />
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s3 },
    swatch: { width: 34, height: 34, borderRadius: radius.pill, borderWidth: 2, borderColor: 'transparent' },
    swatchSelected: { borderColor: c.fg },
    iconCell: {
      width: 42,
      height: 42,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: hairline,
      borderColor: c.hairlineStrong,
    },
  });
}
