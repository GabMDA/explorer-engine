// i18n Service (chapter 05 §5.3.15, chapter 12 §12.9, roadmap P7-T4). Headless key
// resolution: turns an `I18nText` (literal or `{ $t: key }`) into a display string
// for the active locale. Fetching `i18n.sources` files is the Resource
// Manager/adapter's job — this module only resolves already-loaded dictionaries
// (`registerDictionary`), so translation files can be lazy-loaded per locale.
import type { EventBus } from '../events/event-bus';
import type { EngineEventMap } from '../types/events';
import type { I18nText } from '@explorer-engine/schema';

export type LocaleDictionary = Readonly<Record<string, string>>;

export interface I18nServiceOptions {
  readonly locales: readonly string[];
  readonly defaultLocale: string;
  /** Pre-loaded dictionaries, keyed by locale. */
  readonly dictionaries?: Readonly<Record<string, LocaleDictionary>>;
  readonly events?: EventBus<EngineEventMap>;
}

export interface I18nService {
  getLocale(): string;
  /** Switch the active locale. Returns `false` (no-op) if `locale` isn't configured. */
  setLocale(locale: string): boolean;
  getLocales(): readonly string[];
  /**
   * Resolve `text` for the active locale. A literal passes through unchanged; a
   * `{ $t }` key falls back to the default locale, then to the key itself
   * (visible-missing — degrades gracefully, L23 — rather than failing silently).
   */
  translate(text: I18nText): string;
  /** Merge translations for `locale` (additive — for lazy-loaded sources). */
  registerDictionary(locale: string, dictionary: LocaleDictionary): void;
  dispose(): void;
}

export function createI18nService(options: I18nServiceOptions): I18nService {
  const { locales, defaultLocale, events } = options;
  const dictionaries = new Map<string, Record<string, string>>();
  for (const [locale, dict] of Object.entries(options.dictionaries ?? {})) {
    dictionaries.set(locale, { ...dict });
  }
  let currentLocale = locales.includes(defaultLocale)
    ? defaultLocale
    : (locales[0] ?? defaultLocale);
  let disposed = false;

  return {
    getLocale: () => currentLocale,
    getLocales: () => locales,
    setLocale(locale) {
      if (disposed || !locales.includes(locale)) return false;
      if (locale === currentLocale) return true;
      currentLocale = locale;
      events?.emit('i18n:locale-changed', { locale });
      return true;
    },
    translate(text) {
      if (typeof text === 'string') return text;
      const key = text.$t;
      return (
        dictionaries.get(currentLocale)?.[key] ?? dictionaries.get(defaultLocale)?.[key] ?? key
      );
    },
    registerDictionary(locale, dictionary) {
      if (disposed) return;
      const existing = dictionaries.get(locale) ?? {};
      dictionaries.set(locale, { ...existing, ...dictionary });
    },
    dispose() {
      disposed = true;
    },
  };
}
