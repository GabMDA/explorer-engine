import { describe, it, expect, vi } from 'vitest';
import { createI18nService } from './i18n-service';
import { EventBus } from '../events/event-bus';
import type { EngineEventMap } from '../types/events';

describe('createI18nService', () => {
  it('passes literals through unchanged', () => {
    const svc = createI18nService({ locales: ['en'], defaultLocale: 'en' });
    expect(svc.translate('Crown')).toBe('Crown');
  });

  it('resolves a { $t } key from the active locale dictionary', () => {
    const svc = createI18nService({
      locales: ['en', 'fr'],
      defaultLocale: 'en',
      dictionaries: { fr: { 'watch.crown': 'Couronne' } },
    });
    svc.setLocale('fr');
    expect(svc.translate({ $t: 'watch.crown' })).toBe('Couronne');
  });

  it('falls back to the default locale, then to the key itself (graceful degradation)', () => {
    const svc = createI18nService({
      locales: ['en', 'fr', 'de'],
      defaultLocale: 'en',
      dictionaries: { en: { 'watch.crown': 'Crown' } },
    });
    svc.setLocale('de'); // no German dictionary registered
    expect(svc.translate({ $t: 'watch.crown' })).toBe('Crown'); // falls back to default
    expect(svc.translate({ $t: 'unknown.key' })).toBe('unknown.key'); // visible-missing
  });

  it('setLocale rejects an unconfigured locale and returns false', () => {
    const svc = createI18nService({ locales: ['en'], defaultLocale: 'en' });
    expect(svc.setLocale('es')).toBe(false);
    expect(svc.getLocale()).toBe('en');
  });

  it('setLocale emits i18n:locale-changed only on an actual change', () => {
    const events = new EventBus<EngineEventMap>();
    const handler = vi.fn();
    events.on('i18n:locale-changed', handler);
    const svc = createI18nService({ locales: ['en', 'fr'], defaultLocale: 'en', events });

    expect(svc.setLocale('en')).toBe(true); // already current
    expect(handler).not.toHaveBeenCalled();

    expect(svc.setLocale('fr')).toBe(true);
    expect(handler).toHaveBeenCalledWith({ locale: 'fr' });
  });

  it('registerDictionary merges translations additively (lazy-loaded sources)', () => {
    const svc = createI18nService({ locales: ['en', 'fr'], defaultLocale: 'en' });
    svc.setLocale('fr');
    expect(svc.translate({ $t: 'watch.crown' })).toBe('watch.crown'); // not loaded yet

    svc.registerDictionary('fr', { 'watch.crown': 'Couronne' });
    expect(svc.translate({ $t: 'watch.crown' })).toBe('Couronne');

    svc.registerDictionary('fr', { 'watch.dial': 'Cadran' }); // additive, doesn't drop crown
    expect(svc.translate({ $t: 'watch.crown' })).toBe('Couronne');
    expect(svc.translate({ $t: 'watch.dial' })).toBe('Cadran');
  });

  it('defaults to defaultLocale, or the first configured locale if defaultLocale is absent', () => {
    const a = createI18nService({ locales: ['fr', 'de'], defaultLocale: 'en' });
    expect(a.getLocale()).toBe('fr');
  });

  it('does nothing after dispose', () => {
    const events = new EventBus<EngineEventMap>();
    const handler = vi.fn();
    events.on('i18n:locale-changed', handler);
    const svc = createI18nService({ locales: ['en', 'fr'], defaultLocale: 'en', events });

    svc.dispose();
    expect(svc.setLocale('fr')).toBe(false);
    svc.registerDictionary('en', { k: 'v' });
    expect(handler).not.toHaveBeenCalled();
  });
});
