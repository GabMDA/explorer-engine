// Theme Manager (chapter 02, roadmap P7-T1; chapter 13 — design tokens). Headless:
// it resolves the token CASCADE (engine default → `preset` → package overrides →
// system preferences) into a flat, adapter-ready token map. It never touches the
// DOM (L8/L9) — reading `prefers-color-scheme`/`prefers-reduced-motion`/etc. and
// materializing CSS custom properties is the UI adapter's job; the adapter instead
// calls `setSystemPreferences` to forward what it observed.
import {
  DEFAULT_THEME_TOKENS_DARK,
  DEFAULT_THEME_TOKENS_LIGHT,
  type ThemeConfig,
  type ThemePreset,
  type ThemeTokens,
} from '@explorer-engine/schema';
import type { EventBus } from '../events/event-bus';
import type { EngineEventMap, ThemeVariant } from '../types/events';

export type { ThemeVariant } from '../types/events';

/**
 * System preferences the host/adapter observes (`matchMedia`) and forwards in —
 * the core never reads them itself (headless, L8/L9). `colorScheme: null` means
 * unknown, and `'auto'` falls back to `'light'` (ch.13 §13.4).
 */
export interface SystemThemePreferences {
  readonly colorScheme: 'light' | 'dark' | null;
  /** `prefers-reduced-motion: reduce` — collapses duration tokens to `0ms`. */
  readonly reducedMotion: boolean;
  /** `prefers-contrast: more`. Surfaced for the adapter; no built-in token change. */
  readonly highContrast: boolean;
  /** `forced-colors: active` (OS-imposed palette). Surfaced for the adapter. */
  readonly forcedColors: boolean;
}

const DEFAULT_SYSTEM_PREFERENCES: SystemThemePreferences = {
  colorScheme: null,
  reducedMotion: false,
  highContrast: false,
  forcedColors: false,
};

const DURATION_TOKEN_KEYS = ['durationFast', 'durationBase', 'durationSlow'] as const;

export interface ThemeManagerOptions {
  readonly config: ThemeConfig;
  readonly events?: EventBus<EngineEventMap>;
  readonly systemPreferences?: Partial<SystemThemePreferences>;
}

export interface ThemeManager {
  getVariant(): ThemeVariant;
  getPreset(): ThemePreset;
  /** Runtime preset switch (the `themeToggle` toolbar item, ch.12 §12.5.1). */
  setPreset(preset: ThemePreset): void;
  /** The resolved, flat token map — ready to become CSS custom properties. */
  getTokens(): ThemeTokens;
  getSystemPreferences(): SystemThemePreferences;
  setSystemPreferences(preferences: Partial<SystemThemePreferences>): void;
  dispose(): void;
}

export function createThemeManager(options: ThemeManagerOptions): ThemeManager {
  const { config, events } = options;
  let preset: ThemePreset = config.preset;
  let systemPreferences: SystemThemePreferences = {
    ...DEFAULT_SYSTEM_PREFERENCES,
    ...options.systemPreferences,
  };
  let disposed = false;
  let lastSnapshot: string | null = null;

  const resolveVariant = (): ThemeVariant => {
    if (preset !== 'auto') return preset;
    return systemPreferences.colorScheme === 'dark' ? 'dark' : 'light';
  };

  const resolveTokens = (variant: ThemeVariant): ThemeTokens => {
    const base = variant === 'dark' ? DEFAULT_THEME_TOKENS_DARK : DEFAULT_THEME_TOKENS_LIGHT;
    const merged: Record<string, string> = { ...base, ...config.tokens, ...config.hotspotStyle };
    if (systemPreferences.reducedMotion) {
      for (const key of DURATION_TOKEN_KEYS) merged[key] = '0ms';
    }
    return merged;
  };

  const emitIfChanged = (): void => {
    if (disposed) return;
    const variant = resolveVariant();
    const tokens = resolveTokens(variant);
    const snapshot = JSON.stringify({ variant, tokens });
    if (snapshot === lastSnapshot) return;
    lastSnapshot = snapshot;
    events?.emit('theme:changed', { variant, tokens });
  };

  // Establish the initial snapshot without emitting (nothing has "changed" yet).
  lastSnapshot = JSON.stringify({
    variant: resolveVariant(),
    tokens: resolveTokens(resolveVariant()),
  });

  return {
    getVariant: () => resolveVariant(),
    getPreset: () => preset,
    setPreset(next) {
      if (disposed || next === preset) return;
      preset = next;
      emitIfChanged();
    },
    getTokens: () => resolveTokens(resolveVariant()),
    getSystemPreferences: () => systemPreferences,
    setSystemPreferences(partial) {
      if (disposed) return;
      systemPreferences = { ...systemPreferences, ...partial };
      emitIfChanged();
    },
    dispose() {
      disposed = true;
    },
  };
}
