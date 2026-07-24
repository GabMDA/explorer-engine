import { describe, it, expect } from 'vitest';
import { DEFAULT_THEME_TOKENS_LIGHT, DEFAULT_THEME_TOKENS_DARK } from './defaults';
import { meetsWcagAaNormalText } from './color-contrast';

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
});
