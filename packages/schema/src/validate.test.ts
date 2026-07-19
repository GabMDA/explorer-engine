import { describe, it, expect } from 'vitest';
import { validateConfig } from './validate';
import { migrateConfig } from './migrate';

const minimal = { schemaVersion: '1.0', model: { src: 'models/m.glb' } };

describe('validateConfig', () => {
  it('accepts a minimal config and applies defaults', () => {
    const r = validateConfig(minimal);
    expect(r.ok).toBe(true);
    expect(r.value?.model.src).toBe('models/m.glb');
    expect(r.value?.model.frameOnLoad).toBe(true); // default
    expect(r.value?.lighting.preset).toBe('studio'); // default
    expect(r.value?.environment.source).toBe('neutral-room'); // default
    expect(r.value?.camera.fov).toBe(50); // default
    expect(r.warnings).toHaveLength(0);
  });

  it('rejects a missing schemaVersion', () => {
    const r = validateConfig({ model: { src: 'm.glb' } });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path === 'schemaVersion')).toBe(true);
  });

  it('rejects an unsupported schema major', () => {
    const r = validateConfig({ schemaVersion: '2.0', model: { src: 'm.glb' } });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path === 'schemaVersion')).toBe(true);
  });

  it('rejects a missing model.src', () => {
    const r = validateConfig({ schemaVersion: '1.0', model: {} });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path === 'model.src')).toBe(true);
  });

  it('rejects unknown enum values (lighting preset, environment source)', () => {
    const r = validateConfig({
      schemaVersion: '1.0',
      model: { src: 'm.glb' },
      lighting: { preset: 'disco' },
      environment: { source: 'hdr' },
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path === 'lighting.preset')).toBe(true);
    expect(r.errors.some((e) => e.path === 'environment.source')).toBe(true);
  });

  it('warns (does not reject) on a node referenced by name, and on unknown keys', () => {
    const r = validateConfig({
      schemaVersion: '1.0',
      model: { src: 'm.glb' },
      components: [{ id: 'crown', nodes: [{ name: 'Crown' }] }],
      futureSection: {},
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.path === 'components[0].nodes[0]')).toBe(true);
    expect(r.warnings.some((w) => w.path === 'futureSection')).toBe(true);
  });

  it('resolves components with explorerId and rejects duplicate ids / empty nodes', () => {
    const ok = validateConfig({
      schemaVersion: '1.0',
      model: { src: 'm.glb' },
      components: [{ id: 'a', nodes: [{ explorerId: 'a' }], group: 'internals' }],
    });
    expect(ok.ok).toBe(true);
    expect(ok.value?.components[0]?.group).toBe('internals');
    expect(ok.value?.components[0]?.selectable).toBe(true);
    expect(ok.warnings).toHaveLength(0); // explorerId → no fragility warning

    const dup = validateConfig({
      schemaVersion: '1.0',
      model: { src: 'm.glb' },
      components: [
        { id: 'a', nodes: [{ explorerId: 'a' }] },
        { id: 'a', nodes: [] },
      ],
    });
    expect(dup.ok).toBe(false);
    expect(dup.errors.some((e) => e.path === 'components[1].id')).toBe(true);
    expect(dup.errors.some((e) => e.path === 'components[1].nodes')).toBe(true);
  });

  it('produces an immutable resolved config', () => {
    const r = validateConfig(minimal);
    expect(Object.isFrozen(r.value)).toBe(true);
  });
});

describe('migrateConfig', () => {
  it('migrates a 0.9 config (model.file → model.src) up to 1.0, then validates', () => {
    const legacy = { schemaVersion: '0.9', model: { file: 'models/old.glb' } };
    const m = migrateConfig(legacy);
    expect(m.migratedFrom).toBe('0.9');
    const r = validateConfig(m.raw);
    expect(r.ok).toBe(true);
    expect(r.value?.schemaVersion).toBe('1.0');
    expect(r.value?.model.src).toBe('models/old.glb');
  });

  it('leaves a current config untouched', () => {
    const m = migrateConfig(minimal);
    expect(m.migratedFrom).toBeNull();
    expect(m.raw).toBe(minimal);
  });
});
