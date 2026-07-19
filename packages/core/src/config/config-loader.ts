// Config Loader (roadmap P3-T2 ; chapter 04 §4.4, chapter 05). Headless: it fetches
// config.json bytes through the Resource Manager, migrates + validates them against
// the normative schema, resolves relative asset paths to canonical URLs, and yields
// an IMMUTABLE resolved config. No DOM/Three.js (L8/L9): even UTF-8 decoding is
// injected (TextDecoder is a DOM/Node global, unavailable in the headless core).
import { migrateConfig, validateConfig } from '@explorer-engine/schema';
import type { ResolvedConfig, ConfigIssue } from '@explorer-engine/schema';
import type { ResourceManager } from '../resources/resource-manager';
import { resolveResourcePath } from '../resources/resolve-path';

/** Thrown when a config fails validation. Carries the structured issues. */
export class ConfigError extends Error {
  constructor(
    message: string,
    readonly issues: readonly ConfigIssue[],
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** A validated, resolved config plus provenance. `config` is immutable. */
export interface LoadedConfig {
  readonly config: ResolvedConfig;
  /** URL the config was loaded from (its directory is the package base). */
  readonly sourceUrl: string;
  /** Non-blocking validation warnings (e.g. node referenced by fragile name). */
  readonly warnings: readonly ConfigIssue[];
  /** Older schema version migrated from, or null. */
  readonly migratedFrom: string | null;
}

function dirOf(url: string): string {
  const i = url.lastIndexOf('/');
  return i >= 0 ? url.slice(0, i + 1) : '';
}

/**
 * Migrate + validate + resolve a config from its JSON text. `sourceUrl` is the URL
 * the config came from; `model.src` is resolved relative to its directory.
 */
export function resolveConfigFromJson(text: string, sourceUrl: string): LoadedConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new ConfigError('config.json is not valid JSON', [
      { path: '', message: error instanceof Error ? error.message : String(error) },
    ]);
  }

  const migrated = migrateConfig(parsed);
  const result = validateConfig(migrated.raw);
  if (!result.ok || result.value === undefined) {
    throw new ConfigError('config.json failed schema validation', result.errors);
  }

  const base = dirOf(sourceUrl);
  const resolved: ResolvedConfig = {
    ...result.value,
    model: { ...result.value.model, src: resolveResourcePath(base, result.value.model.src) },
  };

  return {
    config: Object.freeze(resolved),
    sourceUrl,
    warnings: result.warnings,
    migratedFrom: migrated.migratedFrom,
  };
}

export interface ConfigLoaderOptions {
  readonly resourceManager: ResourceManager;
  /** Decodes fetched bytes to text (host injects `new TextDecoder().decode`). */
  readonly decodeText: (bytes: Uint8Array) => string;
}

export interface ConfigLoader {
  /** Fetch, migrate, validate and resolve the config at `path`. */
  load(path: string): Promise<LoadedConfig>;
}

export function createConfigLoader(options: ConfigLoaderOptions): ConfigLoader {
  const { resourceManager, decodeText } = options;
  return {
    async load(path) {
      const data = await resourceManager.load(path);
      return resolveConfigFromJson(decodeText(data.bytes), data.url);
    },
  };
}
