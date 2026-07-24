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

  const withStates = (states: unknown, initialState?: unknown) => ({
    schemaVersion: '1.0',
    model: { src: 'm.glb' },
    components: [
      { id: 'gpu', nodes: [{ explorerId: 'gpu' }], group: 'internals' },
      { id: 'panel', nodes: [{ explorerId: 'panel' }], group: 'shell' },
    ],
    states,
    ...(initialState !== undefined ? { initialState } : {}),
  });

  it('accepts declarative states (base + modifier) with layers and camera intent', () => {
    const r = validateConfig(
      withStates(
        [
          { id: 'closed', label: 'Closed', region: 'base' },
          {
            id: 'exploded',
            label: 'Exploded',
            region: 'base',
            allowedFrom: ['closed'],
            layers: [
              {
                target: { kind: 'component', id: 'gpu' },
                channel: 'transform',
                value: { translate: [0, -0.3, 0] },
              },
            ],
            cameraIntent: { position: [2, 1, 3], target: [0, 0, 0] },
            transition: { duration: 800, easing: 'easeInOut' },
          },
          {
            id: 'xray',
            label: 'X-ray',
            region: 'modifier-opacity',
            layers: [{ target: { kind: 'group', id: 'shell' }, channel: 'opacity', value: 0.2 }],
          },
          {
            id: 'cutaway',
            label: 'Cutaway',
            region: 'modifier-clip',
            layers: [
              {
                target: { kind: 'group', id: 'internals' },
                channel: 'clip',
                value: [{ normal: [1, 0, 0], offset: 0 }],
              },
            ],
          },
        ],
        'closed',
      ),
    );
    expect(r.ok).toBe(true);
    expect(r.value?.states).toHaveLength(4);
    expect(r.value?.initialState).toBe('closed');
    expect(r.value?.states[1]?.cameraIntent).toEqual({ position: [2, 1, 3], target: [0, 0, 0] });
    expect(r.value?.states[3]?.layers[0]?.channel).toBe('clip');
  });

  it('rejects duplicate state ids, unknown layer targets, bad allowedFrom, invalid initialState', () => {
    const r = validateConfig(
      withStates(
        [
          { id: 'a', region: 'base' },
          { id: 'a', region: 'base' }, // duplicate
          {
            id: 'b',
            region: 'base',
            allowedFrom: ['ghost'], // unknown base
            layers: [{ target: { kind: 'component', id: 'nope' }, channel: 'opacity', value: 0.5 }],
          },
        ],
        'missing', // unknown base
      ),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path === 'states[1].id')).toBe(true);
    expect(r.errors.some((e) => e.path === 'states[2].allowedFrom[0]')).toBe(true);
    expect(r.errors.some((e) => e.path === 'states[2].layers[0].target')).toBe(true);
    expect(r.errors.some((e) => e.path === 'initialState')).toBe(true);
  });

  it('rejects a relative transform and an unknown state layer channel', () => {
    const r = validateConfig(
      withStates([
        {
          id: 'open',
          region: 'base',
          layers: [
            {
              target: { kind: 'component', id: 'gpu' },
              channel: 'transform',
              value: { translate: [1, 0, 0], relative: true },
            },
            { target: { kind: 'component', id: 'gpu' }, channel: 'bogus', value: 1 },
          ],
        },
      ]),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path === 'states[0].layers[0].value.relative')).toBe(true);
    expect(r.errors.some((e) => e.path === 'states[0].layers[1].channel')).toBe(true);
  });
});

describe('validateConfig — theme (chapter 13)', () => {
  it('defaults to preset "auto" with no token overrides', () => {
    const r = validateConfig(minimal);
    expect(r.value?.theme.preset).toBe('auto');
    expect(r.value?.theme.tokens).toEqual({});
  });

  it('accepts a valid preset and token overrides', () => {
    const r = validateConfig({
      ...minimal,
      theme: { preset: 'dark', tokens: { colorAccent: '#c9a227' }, hotspotStyle: { size: '16px' } },
    });
    expect(r.ok).toBe(true);
    expect(r.value?.theme.preset).toBe('dark');
    expect(r.value?.theme.tokens['colorAccent']).toBe('#c9a227');
    expect(r.value?.theme.hotspotStyle['size']).toBe('16px');
  });

  it('rejects an unknown preset and a non-string token value', () => {
    const r = validateConfig({
      ...minimal,
      theme: { preset: 'neon', tokens: { colorAccent: 42 } },
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path === 'theme.preset')).toBe(true);
    expect(r.errors.some((e) => e.path === 'theme.tokens.colorAccent')).toBe(true);
  });

  it('warns (does not block) when overrides fail WCAG AA contrast', () => {
    const r = validateConfig({
      ...minimal,
      theme: { tokens: { colorText: '#dddddd', colorBackground: '#ffffff' } },
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.message.includes('WCAG 2.1 AA'))).toBe(true);
  });
});

describe('validateConfig — i18n (chapter 05 §5.3.15)', () => {
  it('defaults locales to [meta.defaultLocale]', () => {
    const r = validateConfig({ ...minimal, meta: { defaultLocale: 'fr' } });
    expect(r.value?.i18n.locales).toEqual(['fr']);
    expect(r.value?.i18n.sources).toEqual({});
  });

  it('accepts explicit locales and sources', () => {
    const r = validateConfig({
      ...minimal,
      i18n: { locales: ['en', 'fr'], sources: { fr: 'locales/fr.json' } },
    });
    expect(r.ok).toBe(true);
    expect(r.value?.i18n.locales).toEqual(['en', 'fr']);
    expect(r.value?.i18n.sources['fr']).toBe('locales/fr.json');
  });

  it('rejects a non-array locales and warns on a source outside locales', () => {
    const r = validateConfig({ ...minimal, i18n: { locales: 'en', sources: { de: 'de.json' } } });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path === 'i18n.locales')).toBe(true);
  });

  it('warns when a source locale is not listed', () => {
    const r = validateConfig({
      ...minimal,
      i18n: { locales: ['en'], sources: { de: 'de.json' } },
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.path === 'i18n.sources.de')).toBe(true);
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
