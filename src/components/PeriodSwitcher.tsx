/**
 * Period control for Home: a segmented day/week/month/year toggle plus a
 * ‹ label › stepper to move to the previous / next period. Presentation only —
 * the range math is in the pure trust core (data/dates.ts).
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { PeriodType } from '../data/dates';
import { t } from '../i18n';
import { useTheme, fontFamily, space, radius, target, type as ty, hairline, type Colors } from '../theme';

const TYPES: PeriodType[] = ['day', 'week', 'month', 'year'];

interface Props {
  type: PeriodType;
  onTypeChange: (t: PeriodType) => void;
  offset: number;
  onOffsetChange: (offset: number) => void;
  label: string;
}

export function PeriodSwitcher({ type, onTypeChange, offset, onOffsetChange, label }: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const shownLabel = offset === 0 ? labelForCurrent(type, label) : label;
  return (
    <View style={s.wrap}>
      <View style={s.segment}>
        {TYPES.map((p) => {
          const active = p === type;
          return (
            <Pressable
              key={p}
              onPress={() => {
                onTypeChange(p);
                onOffsetChange(0);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(`period.${p}`)}
              style={[s.segBtn, active && s.segBtnActive]}
            >
              <Text style={[s.segText, active && s.segTextActive]}>{t(`period.${p}`)}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.nav}>
        <Pressable
          onPress={() => onOffsetChange(offset - 1)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('period.previous')}
          style={({ pressed }) => [s.navBtn, pressed && s.pressed]}
        >
          <ChevronLeft size={20} color={c.fg} strokeWidth={1.5} />
        </Pressable>
        <Text style={s.label}>{shownLabel}</Text>
        <Pressable
          onPress={() => offset < 0 && onOffsetChange(offset + 1)}
          hitSlop={8}
          disabled={offset >= 0}
          accessibilityRole="button"
          accessibilityLabel={t('period.next')}
          style={({ pressed }) => [s.navBtn, pressed && s.pressed, offset >= 0 && s.disabled]}
        >
          <ChevronRight size={20} color={c.fg} strokeWidth={1.5} />
        </Pressable>
      </View>
    </View>
  );
}

function labelForCurrent(type: PeriodType, label: string): string {
  return type === 'day' ? t('home.today') : label;
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    wrap: { gap: space.s3, paddingHorizontal: space.s5 },
    segment: {
      flexDirection: 'row',
      backgroundColor: c.bgSubtle,
      borderRadius: radius.md,
      padding: 3,
    },
    segBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: space.s2,
      borderRadius: radius.sm,
    },
    segBtnActive: { backgroundColor: c.bgElevated },
    segText: { ...ty.sm, fontFamily: fontFamily.sans, color: c.fgMuted },
    segTextActive: { fontFamily: fontFamily.sansSemibold, color: c.fg },
    nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s4 },
    navBtn: { width: target.min, height: 32, alignItems: 'center', justifyContent: 'center' },
    label: { ...ty.base, fontFamily: fontFamily.sansSemibold, color: c.fg, minWidth: 120, textAlign: 'center' },
    pressed: { opacity: 0.6 },
    disabled: { opacity: 0.3 },
  });
}
