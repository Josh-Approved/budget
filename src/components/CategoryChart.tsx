/**
 * Category-breakdown donut — the budget app's signature view. Hand-rolled SVG
 * (react-native-svg) rather than a chart dependency: a ring of arcs, one per
 * category slice, sized to its share of the period's spend, with the period
 * total in the centre. Tapping a slice calls onSelect to filter the list;
 * tapping the selected slice again clears. Slice colors come from the app-local
 * categorical palette (categoryPalette.ts — pending canon).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { categoryColor } from '../theme/categoryPalette';
import type { BreakdownSlice } from '../data/budget';
import { useTheme, fontFamily, type Colors } from '../theme';

interface Props {
  slices: BreakdownSlice[];
  size?: number;
  centerValue: string;
  centerLabel: string;
  selectedId?: string;
  onSelect?: (categoryId: string) => void;
}

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const [sx, sy] = polar(cx, cy, r, endDeg);
  const [ex, ey] = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 0 ${ex} ${ey}`;
}

export function CategoryChart({
  slices,
  size = 220,
  centerValue,
  centerLabel,
  selectedId,
  onSelect,
}: Props) {
  const { c } = useTheme();
  const s = makeStyles(c);
  const stroke = 26;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // Build arc segments with a small gap between them for legibility.
  const drawn = slices.filter((sl) => sl.fraction > 0);
  const gap = drawn.length > 1 ? 2 : 0;
  let cursor = 0;
  const segments = drawn.map((sl) => {
    const sweep = sl.fraction * 360;
    const start = cursor + gap / 2;
    const end = cursor + sweep - gap / 2;
    cursor += sweep;
    return { slice: sl, start, end: Math.max(start + 0.01, end) };
  });

  const isFull = drawn.length === 1;

  return (
    <View style={[s.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle cx={cx} cy={cy} r={r} stroke={c.bgSubtle} strokeWidth={stroke} fill="none" />
        {isFull ? (
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={categoryColor(drawn[0].colorToken)}
            strokeWidth={stroke}
            fill="none"
            opacity={selectedId && selectedId !== drawn[0].categoryId ? 0.35 : 1}
            onPress={onSelect ? () => onSelect(drawn[0].categoryId) : undefined}
          />
        ) : (
          <G>
            {segments.map((seg) => (
              <Path
                key={seg.slice.categoryId}
                d={arcPath(cx, cy, r, seg.start, seg.end)}
                stroke={categoryColor(seg.slice.colorToken)}
                strokeWidth={stroke}
                strokeLinecap="butt"
                fill="none"
                opacity={selectedId && selectedId !== seg.slice.categoryId ? 0.35 : 1}
                onPress={onSelect ? () => onSelect(seg.slice.categoryId) : undefined}
              />
            ))}
          </G>
        )}
      </Svg>
      <View style={s.center} pointerEvents="none">
        <Text style={s.value} numberOfLines={1} adjustsFontSizeToFit>
          {centerValue}
        </Text>
        <Text style={s.label}>{centerLabel}</Text>
      </View>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
    center: { position: 'absolute', alignItems: 'center', justifyContent: 'center', maxWidth: '60%' },
    value: { fontFamily: fontFamily.mono, fontSize: 26, lineHeight: 32, color: c.fg, textAlign: 'center' },
    label: {
      fontFamily: fontFamily.sans,
      fontSize: 12,
      lineHeight: 16,
      color: c.fgMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 2,
    },
  });
}
