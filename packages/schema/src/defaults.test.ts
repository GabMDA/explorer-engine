import { describe, it, expect } from 'vitest';
import { DEFAULT_THEME_TOKENS_LIGHT, DEFAULT_THEME_TOKENS_DARK } from './defaults';
import { meetsWcagAaNormalText, contrastRatio } from './color-contrast';

describe('default theme tokens (chapter 13 §13.5)', () => {
  it.each([
    ['light', DEFAULT_THEME_TOKENS_LIGHT],
    ['dark', DEFAULT_THEME_TOKENS_DARK],
  ])('%s variant meets WCAG 2.1 AA for text on background/surface', (_name, tokens) => {
    expect(
      meetsWcagAaNormalText(tokens['colorText'] as string, tokens['colorBackground'] as string),
    ).toBe(true);
    expect(
      meetsWcagAaNormalText(tokens['colorText'] as string, tokens['colorSurface'] as string),
    ).toBe(true);
  });

  // WCAG 1.4.11 (non-text contrast, roadmap P9-T5): colorBorder draws button/
  // track boundaries and outlineColor draws the shared focus ring — both are
  // the SOLE visual cue for their purpose (ch.12 §12.8), so they need >=3:1
  // against both background and surface, not the 4.5:1 text threshold.
  it.each([
    ['light', DEFAULT_THEME_TOKENS_LIGHT],
    ['dark', DEFAULT_THEME_TOKENS_DARK],
  ])('%s variant meets WCAG 1.4.11 (>=3:1) for colorBorder/outlineColor', (_name, tokens) => {
    const background = tokens['colorBackground'] as string;
    const surface = tokens['colorSurface'] as string;
    for (const key of ['colorBorder', 'outlineColor'] as const) {
      const color = tokens[key] as string;
      expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(color, surface)).toBeGreaterThanOrEqual(3);
    }
  });
});
