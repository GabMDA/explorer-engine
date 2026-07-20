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

  it('defaults pickTarget to the component id and rejects an unknown pickTarget', () => {
    const ok = validateConfig({
      schemaVersion: '1.0',
      model: { src: 'm.glb' },
      components: [
        { id: 'gpu', nodes: [{ explorerId: 'gpu' }] },
        { id: 'gpu-fan', nodes: [{ explorerId: 'gpu_fan' }], pickTarget: 'gpu' },
      ],
    });
    expect(ok.ok).toBe(true);
    expect(ok.value?.components[0]?.pickTarget).toBe('gpu'); // defaulted to self
    expect(ok.value?.components[1]?.pickTarget).toBe('gpu'); // explicit

    const bad = validateConfig({
      schemaVersion: '1.0',
      model: { src: 'm.glb' },
      components: [{ id: 'a', nodes: [{ explorerId: 'a' }], pickTarget: 'nope' }],
    });
    expect(bad.ok).toBe(false);
    expect(bad.errors.some((e) => e.path === 'components[0].pickTarget')).toBe(true);
  });

  it('accepts hotspots with typed anchors and actions, applying defaults', () => {
    const r = validateConfig({
      schemaVersion: '1.0',
      model: { src: 'm.glb' },
      components: [{ id: 'crown', nodes: [{ explorerId: 'crown' }], group: 'shell' }],
      hotspots: [
        {
          id: 'hs-crown',
          label: 'Crown',
          anchor: { kind: 'component', id: 'crown' },
          action: { type: 'focus', target: { kind: 'component', id: 'crown' } },
        },
        {
          id: 'hs-free',
          label: 'Point',
          anchor: { kind: 'position', position: [0, 1, 0] },
          action: { type: 'emit', event: 'ping' },
          occludable: false,
          priority: 5,
        },
        { id: 'hs-shell', label: 'Shell', anchor: { kind: 'group', id: 'shell' } },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.value?.hotspots).toHaveLength(3);
    expect(r.value?.hotspots[0]?.occludable).toBe(true); // default
    expect(r.value?.hotspots[0]?.priority).toBe(0); // default
    expect(r.value?.hotspots[1]?.occludable).toBe(false);
    // A hotspot with no explicit action gets a safe emit default.
    expect(r.value?.hotspots[2]?.action).toEqual({ type: 'emit', event: 'hotspot:hs-shell' });
  });

  it('rejects hotspots that reference unknown components/groups or malformed anchors', () => {
    const r = validateConfig({
      schemaVersion: '1.0',
      model: { src: 'm.glb' },
      components: [{ id: 'crown', nodes: [{ explorerId: 'crown' }] }],
      hotspots: [
        { id: 'a', anchor: { kind: 'component', id: 'ghost' } },
        { id: 'b', anchor: { kind: 'group', id: 'nogroup' } },
        { id: 'c', anchor: { kind: 'component', id: 'crown' }, action: { type: 'nope' } },
        { id: 'd', anchor: { kind: 'bogus', id: 'x' } },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path === 'hotspots[0].anchor.id')).toBe(true);
    expect(r.errors.some((e) => e.path === 'hotspots[1].anchor.id')).toBe(true);
    expect(r.errors.some((e) => e.path === 'hotspots[2].action.type')).toBe(true);
    expect(r.errors.some((e) => e.path === 'hotspots[3].anchor.kind')).toBe(true);
  });

  it('defaults the focus section and accepts a custom, valid focus config', () => {
    const def = validateConfig(minimal);
    expect(def.value?.focus.padding).toBe(1.2); // default
    expect(def.value?.focus.transition).toEqual({ duration: 600, easing: 'easeInOut', delay: 0 });

    const custom = validateConfig({
      schemaVersion: '1.0',
      model: { src: 'm.glb' },
      focus: {
        padding: 1.5,
        dimOthers: false,
        isolate: true,
        outline: { color: '#ff0000', thickness: 2 },
        transition: { duration: 300, easing: 'easeOutCubic', delay: 50 },
      },
    });
    expect(custom.ok).toBe(true);
    expect(custom.value?.focus.isolate).toBe(true);
    expect(custom.value?.focus.outline).toEqual({ enabled: true, color: '#ff0000', thickness: 2 });
    expect(custom.value?.focus.transition).toEqual({
      duration: 300,
      easing: 'easeOutCubic',
      delay: 50,
    });
  });

  it('rejects an unknown easing and clamps an out-of-range dimOpacity with a warning', () => {
    const r = validateConfig({
      schemaVersion: '1.0',
      model: { src: 'm.glb' },
      focus: { dimOpacity: 5, transition: { duration: 100, easing: 'disco' } },
    });
    expect(r.ok).toBe(false); // unknown easing is a blocking error
    expect(r.errors.some((e) => e.path === 'focus.transition.easing')).toBe(true);
    // dimOpacity 5 → clamped to 1 with a warning (non-blocking).
    expect(r.warnings.some((w) => w.path === 'focus.dimOpacity')).toBe(true);
  });

  it('rejects a duplicate hotspot id and a focus action targeting an unknown component', () => {
    const r = validateConfig({
      schemaVersion: '1.0',
      model: { src: 'm.glb' },
      components: [{ id: 'crown', nodes: [{ explorerId: 'crown' }] }],
      hotspots: [
        { id: 'x', anchor: { kind: 'component', id: 'crown' } },
        {
          id: 'x',
          anchor: { kind: 'component', id: 'crown' },
          action: { type: 'focus', target: { kind: 'component', id: 'ghost' } },
        },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path === 'hotspots[1].id')).toBe(true);
    expect(r.errors.some((e) => e.path === 'hotspots[1].action.target')).toBe(true);
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
