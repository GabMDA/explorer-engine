import { describe, it, expect, vi } from 'vitest';
import { wireSystemPreferences } from './system-preferences';
import { createThemeManager } from '@explorer-engine/core';
import { DEFAULT_THEME } from '@explorer-engine/core';
import type { MediaQueryLike, MatchMediaLike } from './system-preferences';

function fakeMatchMedia(initial: Record<string, boolean>): {
  matchMedia: MatchMediaLike;
  change: (query: string, matches: boolean) => void;
} {
  const listeners = new Map<string, Set<() => void>>();
  const state = new Map<string, boolean>(Object.entries(initial));
  const matchMedia: MatchMediaLike = (query: string): MediaQueryLike => ({
    get matches() {
      return state.get(query) ?? false;
    },
    addEventListener: (_type, listener) => {
      let set = listeners.get(query);
      if (!set) {
        set = new Set();
        listeners.set(query, set);
      }
      set.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.get(query)?.delete(listener);
    },
  });
  return {
    matchMedia,
    change(query, matches) {
      state.set(query, matches);
      for (const listener of listeners.get(query) ?? []) listener();
    },
  };
}

describe('wireSystemPreferences', () => {
  it('syncs the initial state into the Theme Manager', () => {
    const { matchMedia } = fakeMatchMedia({
      '(prefers-color-scheme: dark)': true,
      '(prefers-reduced-motion: reduce)': true,
    });
    const tm = createThemeManager({ config: DEFAULT_THEME });

    wireSystemPreferences(tm, matchMedia);

    expect(tm.getVariant()).toBe('dark');
    expect(tm.getSystemPreferences().reducedMotion).toBe(true);
  });

  it('re-syncs on a matchMedia "change" event', () => {
    const { matchMedia, change } = fakeMatchMedia({ '(prefers-color-scheme: dark)': false });
    const tm = createThemeManager({ config: DEFAULT_THEME });
    wireSystemPreferences(tm, matchMedia);
    expect(tm.getVariant()).toBe('light');

    change('(prefers-color-scheme: dark)', true);

    expect(tm.getVariant()).toBe('dark');
  });

  it('the returned unsubscribe stops further syncing', () => {
    const { matchMedia, change } = fakeMatchMedia({ '(prefers-color-scheme: dark)': false });
    const tm = createThemeManager({ config: DEFAULT_THEME });
    const setSystemPreferences = vi.spyOn(tm, 'setSystemPreferences');
    const unwire = wireSystemPreferences(tm, matchMedia);
    setSystemPreferences.mockClear();

    unwire();
    change('(prefers-color-scheme: dark)', true);

    expect(setSystemPreferences).not.toHaveBeenCalled();
  });
});
