// Applies a resolved ThemeTokens map (chapter 13) as CSS custom properties, so
// every component in the shell's stylesheet can reference `var(--ee-<token>)`.
// This is the ONLY place a token becomes a concrete style value — the shell CSS
// never hardcodes a color/spacing/etc. (ch.12 §12.11 rule 2, ch.13 §13.9 rule 1).
import type { ThemeTokens } from '@explorer-engine/core';

/** The CSS custom property name a token key maps to. */
export function cssVarName(tokenKey: string): string {
  return `--ee-${tokenKey}`;
}

/** Pure: builds a `cssText` block assigning one custom property per token. */
export function themeTokensToCssText(tokens: ThemeTokens): string {
  return Object.entries(tokens)
    .map(([key, value]) => `${cssVarName(key)}:${value};`)
    .join('');
}

/** Applies `tokens` onto `root` as inline custom properties (replaces prior ones). */
export function applyThemeTokens(root: HTMLElement, tokens: ThemeTokens): void {
  root.style.cssText = themeTokensToCssText(tokens);
}
