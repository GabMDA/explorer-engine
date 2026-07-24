// Forwards observed system preferences into the headless Theme Manager (ch.13
// §13.5). Reading `matchMedia` is explicitly the ADAPTER's job — the core stays
// headless and never touches `window` (L8/L9). `MatchMediaLike` is injectable so
// this stays unit-testable without a real DOM/browser.
import type { ThemeManager } from '@explorer-engine/core';

export interface MediaQueryLike {
  readonly matches: boolean;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
}

export type MatchMediaLike = (query: string) => MediaQueryLike;

const QUERIES = {
  colorScheme: '(prefers-color-scheme: dark)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
  highContrast: '(prefers-contrast: more)',
  forcedColors: '(forced-colors: active)',
} as const;

/**
 * Observes the four system preferences ch.13 §13.5 requires and forwards them
 * to `themeManager.setSystemPreferences`, once immediately and again on every
 * change. Returns an unsubscribe function that stops observing.
 */
export function wireSystemPreferences(
  themeManager: ThemeManager,
  matchMedia: MatchMediaLike,
): () => void {
  const colorScheme = matchMedia(QUERIES.colorScheme);
  const reducedMotion = matchMedia(QUERIES.reducedMotion);
  const highContrast = matchMedia(QUERIES.highContrast);
  const forcedColors = matchMedia(QUERIES.forcedColors);

  const sync = (): void => {
    themeManager.setSystemPreferences({
      colorScheme: colorScheme.matches ? 'dark' : 'light',
      reducedMotion: reducedMotion.matches,
      highContrast: highContrast.matches,
      forcedColors: forcedColors.matches,
    });
  };

  sync();
  colorScheme.addEventListener('change', sync);
  reducedMotion.addEventListener('change', sync);
  highContrast.addEventListener('change', sync);
  forcedColors.addEventListener('change', sync);

  return () => {
    colorScheme.removeEventListener('change', sync);
    reducedMotion.removeEventListener('change', sync);
    highContrast.removeEventListener('change', sync);
    forcedColors.removeEventListener('change', sync);
  };
}
