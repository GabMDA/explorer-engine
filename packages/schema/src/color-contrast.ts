// WCAG 2.1 contrast ratio (chapter 13 §13.5/§13.9 rule 5). Pure, headless, no
// dependency — used by the validator to warn when a theme's declared tokens would
// fail AA, and reusable by any future validation tooling (P8 studio, ch.18).
// Accepts `#RGB`, `#RRGGBB` and `#RRGGBBAA` (alpha is ignored — opaque contrast only).

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Parses a hex color string to `[r, g, b]` in `[0, 255]`, or `null` if not hex. */
export function parseHexColor(hex: string): readonly [number, number, number] | null {
  if (!HEX_RE.test(hex)) return null;
  const body = hex.slice(1);
  const full =
    body.length === 3
      ? body
          .split('')
          .map((c) => c + c)
          .join('')
      : body;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return [r, g, b];
}

const linearize = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/** Relative luminance (WCAG 2.1 §1.4.3), or `null` if `hex` is not a parseable color. */
export function relativeLuminance(hex: string): number | null {
  const rgb = parseHexColor(hex);
  if (rgb === null) return null;
  const [r, g, b] = rgb;
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * WCAG 2.1 contrast ratio between two colors, in `[1, 21]`. Returns `null` when
 * either color isn't a parseable hex string (e.g. a token left unresolved).
 */
export function contrastRatio(hexA: string, hexB: string): number | null {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  if (lA === null || lB === null) return null;
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 2.1 AA minimum ratio for normal-size text. */
export const WCAG_AA_NORMAL_TEXT_RATIO = 4.5;

/** `true` iff the pair meets WCAG 2.1 AA for normal text; `null` input → `false`. */
export function meetsWcagAaNormalText(hexA: string, hexB: string): boolean {
  const ratio = contrastRatio(hexA, hexB);
  return ratio !== null && ratio >= WCAG_AA_NORMAL_TEXT_RATIO;
}
