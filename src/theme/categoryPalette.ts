/**
 * In-app categorical palette for the budget app's category-breakdown chart and
 * category dots.
 *
 * APP-LOCAL, PENDING CANON. The Josh Approved design system intentionally ships
 * only ink + paper + approval-green + one per-app accent for the product UI;
 * its three-hue marketing palette is marketing-surfaces-only. A category-
 * breakdown chart is the first product surface that genuinely needs a *set* of
 * distinguishable hues, so the budget app surfaced a real gap. These twelve
 * muted, aged-pigment hues stay inside the design-system register (desaturated,
 * paper-friendly, none competing with or reading as approval green) and are
 * documented as a canon proposal (in-app data-viz palette) — if canon ratifies
 * a studio-wide set, this file becomes a thin re-export of it.
 *
 * Tokens are stable string ids ('cat-1'…'cat-12') stored on each category so a
 * recolor is data, not a hardcoded hex, and a future palette swap is one edit.
 */

export const CATEGORY_COLORS: Record<string, string> = {
  'cat-1': '#B0654B', // terracotta
  'cat-2': '#A8842F', // ochre
  'cat-3': '#7C8A4E', // olive
  'cat-4': '#4E8F8F', // teal
  'cat-5': '#5E7691', // dusty blue
  'cat-6': '#5C5F94', // slate indigo
  'cat-7': '#7E5685', // muted plum
  'cat-8': '#A85A74', // dusty rose
  'cat-9': '#8A6A52', // clay brown
  'cat-10': '#426079', // deep blue
  'cat-11': '#7C7A78', // warm gray
  'cat-12': '#5F8A6B', // moss
};

export const CATEGORY_COLOR_TOKENS = Object.keys(CATEGORY_COLORS);

/** Resolve a color token to its hex; an unknown token degrades to the first
 *  swatch rather than crashing. */
export function categoryColor(token: string): string {
  return CATEGORY_COLORS[token] ?? CATEGORY_COLORS['cat-1'];
}
