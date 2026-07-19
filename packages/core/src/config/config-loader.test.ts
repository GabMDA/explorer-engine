import { describe, it, expect } from 'vitest';
import { resolveConfigFromJson, createConfigLoader, ConfigError } from './config-loader';
import { environmentSpecFromConfig, lightingPresetIdFromConfig } from './intents';
import type { ResourceManager } from '../resources/resource-manager';

const encode = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const decode = (b: Uint8Array) => String.fromCharCode(...b);

describe('resolveConfigFromJson', () => {
  it('validates and resolves model.src relative to the config URL', () => {
    const loaded = resolveConfigFromJson(
      JSON.stringify({ schemaVersion: '1.0', model: { src: 'models/m.glb' } }),
      'https://cdn/pkg/config.json',
    );
    expect(loaded.config.model.src).toBe('https://cdn/pkg/models/m.glb');
    expect(loaded.migratedFrom).toBeNull();
    expect(loaded.warnings).toHaveLength(0);
  });

  it('migrates a 0.9 config before validating', () => {
    const loaded = resolveConfigFromJson(
      JSON.stringify({ schemaVersion: '0.9', model: { file: 'models/old.glb' } }),
      'https://cdn/pkg/config.json',
    );
    expect(loaded.migratedFrom).toBe('0.9');
    expect(loaded.config.model.src).toBe('https://cdn/pkg/models/old.glb');
  });

  it('throws ConfigError with issues on invalid config', () => {
    expect(() =>
      resolveConfigFromJson(JSON.stringify({ model: {} }), 'https://cdn/pkg/config.json'),
    ).toThrow(ConfigError);
  });

  it('throws ConfigError on malformed JSON', () => {
    expect(() => resolveConfigFromJson('{ not json', 'https://cdn/pkg/config.json')).toThrow(
      ConfigError,
    );
  });

  it('surfaces warnings (fragile node name) without failing', () => {
    const loaded = resolveConfigFromJson(
      JSON.stringify({
        schemaVersion: '1.0',
        model: { src: 'm.glb' },
        components: [{ id: 'a', nodes: [{ name: 'A' }] }],
      }),
      'https://cdn/pkg/config.json',
    );
    expect(loaded.warnings.length).toBeGreaterThan(0);
  });
});

describe('createConfigLoader', () => {
  it('fetches bytes via the Resource Manager and resolves them', async () => {
    const rm = {
      load: (path: string) =>
        Promise.resolve({
          url: 'https://cdn/pkg/' + path,
          bytes: encode(JSON.stringify({ schemaVersion: '1.0', model: { src: 'models/m.glb' } })),
        }),
      dispose: () => {},
    } as unknown as ResourceManager;

    const loader = createConfigLoader({ resourceManager: rm, decodeText: decode });
    const loaded = await loader.load('config.json');
    expect(loaded.config.model.src).toBe('https://cdn/pkg/models/m.glb');
  });
});

describe('config intents', () => {
  it('maps environment config to an EnvironmentSpec', () => {
    const spec = environmentSpecFromConfig({
      background: { kind: 'color', color: '#123456' },
      source: 'neutral-room',
      intensity: 0.8,
    });
    expect(spec).toEqual({
      background: { kind: 'color', color: '#123456' },
      environment: 'neutral-room',
      environmentIntensity: 0.8,
    });
  });

  it('maps lighting config to a preset id', () => {
    expect(lightingPresetIdFromConfig({ preset: 'outdoor' })).toBe('outdoor');
  });
});
