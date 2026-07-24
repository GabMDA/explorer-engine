import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_THEME } from '@explorer-engine/schema';
import { createThemeManager } from './theme-manager';
import { EventBus } from '../events/event-bus';
import type { EngineEventMap } from '../types/events';

describe('createThemeManager', () => {
  it('resolves the light variant by default (no system preference)', () => {
    const tm = createThemeManager({ config: DEFAULT_THEME });
    expect(tm.getVariant()).toBe('light');
    expect(tm.getTokens()['colorBackground']).toBe('#ffffff');
  });

  it('"auto" follows the forwarded prefers-color-scheme', () => {
    const tm = createThemeManager({
      config: DEFAULT_THEME,
      systemPreferences: { colorScheme: 'dark' },
    });
    expect(tm.getVariant()).toBe('dark');
    expect(tm.getTokens()['colorBackground']).toBe('#111216');
  });

  it('applies package token overrides on top of the engine default', () => {
    const tm = createThemeManager({
      config: { preset: 'light', tokens: { colorAccent: '#c9a227' }, hotspotStyle: {} },
    });
    expect(tm.getTokens()['colorAccent']).toBe('#c9a227');
    expect(tm.getTokens()['colorBackground']).toBe('#ffffff'); // untouched default survives
  });

  it('hotspotStyle overrides win over tokens for the same key', () => {
    const tm = createThemeManager({
      config: {
        preset: 'light',
        tokens: { hotspotColor: '#111111' },
        hotspotStyle: { hotspotColor: '#c9a227' },
      },
    });
    expect(tm.getTokens()['hotspotColor']).toBe('#c9a227');
  });

  it('collapses duration tokens to 0ms under reduced motion', () => {
    const tm = createThemeManager({
      config: DEFAULT_THEME,
      systemPreferences: { reducedMotion: true },
    });
    expect(tm.getTokens()['durationFast']).toBe('0ms');
    expect(tm.getTokens()['durationBase']).toBe('0ms');
    expect(tm.getTokens()['durationSlow']).toBe('0ms');
  });

  it('setPreset switches variant at runtime (themeToggle) and emits theme:changed', () => {
    const events = new EventBus<EngineEventMap>();
    const handler = vi.fn();
    events.on('theme:changed', handler);
    const tm = createThemeManager({ config: { ...DEFAULT_THEME, preset: 'light' }, events });

    tm.setPreset('dark');

    expect(tm.getVariant()).toBe('dark');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toMatchObject({ variant: 'dark' });
  });

  it('setPreset to the same value is a no-op (no event)', () => {
    const events = new EventBus<EngineEventMap>();
    const handler = vi.fn();
    events.on('theme:changed', handler);
    const tm = createThemeManager({ config: { ...DEFAULT_THEME, preset: 'light' }, events });

    tm.setPreset('light');

    expect(handler).not.toHaveBeenCalled();
  });

  it('setSystemPreferences re-resolves and emits when the outcome changes', () => {
    const events = new EventBus<EngineEventMap>();
    const handler = vi.fn();
    events.on('theme:changed', handler);
    const tm = createThemeManager({ config: DEFAULT_THEME, events }); // preset: 'auto'

    tm.setSystemPreferences({ colorScheme: 'dark' });

    expect(tm.getVariant()).toBe('dark');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('setSystemPreferences with no net effect does not emit', () => {
    const events = new EventBus<EngineEventMap>();
    const handler = vi.fn();
    events.on('theme:changed', handler);
    // preset fixed to 'light': colorScheme changes never affect the resolved variant/tokens.
    const tm = createThemeManager({
      config: { ...DEFAULT_THEME, preset: 'light' },
      events,
    });

    tm.setSystemPreferences({ colorScheme: 'dark' });

    expect(tm.getVariant()).toBe('light');
    expect(handler).not.toHaveBeenCalled();
  });

  it('does nothing after dispose', () => {
    const events = new EventBus<EngineEventMap>();
    const handler = vi.fn();
    events.on('theme:changed', handler);
    const tm = createThemeManager({ config: DEFAULT_THEME, events });

    tm.dispose();
    tm.setPreset('dark');
    tm.setSystemPreferences({ colorScheme: 'dark' });

    expect(handler).not.toHaveBeenCalled();
  });
});
