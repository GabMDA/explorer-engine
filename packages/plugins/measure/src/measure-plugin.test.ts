import { describe, it, expect, vi } from 'vitest';
import { createMeasurePlugin, distanceBetween } from './measure-plugin';
import type { PluginContext, PickHit } from '@explorer-engine/plugin-sdk';

function fakeContext(overrides: Partial<PluginContext> = {}): PluginContext {
  const emitted: { event: string; payload: unknown }[] = [];
  const ctx = {
    pluginId: 'measure',
    events: {
      emit: (event: string, payload: unknown) => emitted.push({ event, payload }),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
    },
    config: { options: {}, resolved: {} },
    resolver: {
      addLayer: vi.fn(() => ({ id: 1 })),
      updateLayer: vi.fn(),
      removeLayer: vi.fn(),
      clear: vi.fn(),
    },
    ui: { registerSlot: vi.fn(), renderSlot: vi.fn() },
    raycaster: { pick: vi.fn(() => null as PickHit | null) },
    ...overrides,
  } as unknown as PluginContext;
  (ctx as unknown as { __emitted: typeof emitted }).__emitted = emitted;
  return ctx;
}

function emittedOf(ctx: PluginContext): { event: string; payload: unknown }[] {
  return (ctx as unknown as { __emitted: { event: string; payload: unknown }[] }).__emitted;
}

const hit = (identity: string, point: readonly [number, number, number]): PickHit =>
  ({ identity, point, distance: 1 }) as PickHit;

describe('distanceBetween', () => {
  it('computes Euclidean distance', () => {
    expect(distanceBetween([0, 0, 0], [3, 4, 0])).toBeCloseTo(5);
  });

  it('is zero for identical points', () => {
    expect(distanceBetween([1, 2, 3], [1, 2, 3])).toBe(0);
  });
});

describe('createMeasurePlugin', () => {
  it('exposes id and the measure capability', () => {
    const plugin = createMeasurePlugin();
    expect(plugin.id).toBe('measure');
    expect(plugin.providesCapabilities).toEqual(['measure']);
  });

  it('ignores picks while inactive', () => {
    const plugin = createMeasurePlugin();
    const ctx = fakeContext({ raycaster: { pick: vi.fn(() => hit('n1', [0, 0, 0])) } });
    plugin.register?.(ctx);

    expect(plugin.pickAt(0, 0)).toBe(false);
    expect(plugin.getPoints()).toEqual([]);
  });

  it('records a point per pick and completes on the second, emitting typed events', () => {
    const plugin = createMeasurePlugin();
    const ctx = fakeContext({
      raycaster: {
        pick: vi
          .fn()
          .mockReturnValueOnce(hit('n1', [0, 0, 0]))
          .mockReturnValueOnce(hit('n2', [3, 4, 0])),
      },
    });
    plugin.register?.(ctx);
    plugin.setActive(true);

    expect(plugin.pickAt(-0.2, 0.1)).toBe(true);
    expect(plugin.getPoints()).toEqual([[0, 0, 0]]);
    expect(plugin.getDistance()).toBeNull();
    expect(emittedOf(ctx)).toContainEqual({
      event: 'measure:point-added',
      payload: { id: 'measure', index: 0, point: [0, 0, 0] },
    });

    expect(plugin.pickAt(0.2, 0.1)).toBe(true);
    expect(plugin.getPoints()).toEqual([
      [0, 0, 0],
      [3, 4, 0],
    ]);
    expect(plugin.getDistance()).toBeCloseTo(5);
    expect(emittedOf(ctx)).toContainEqual({
      event: 'measure:completed',
      payload: { id: 'measure', distance: 5 },
    });
  });

  it('a pick that hits nothing is a no-op', () => {
    const plugin = createMeasurePlugin();
    const ctx = fakeContext({ raycaster: { pick: vi.fn(() => null) } });
    plugin.register?.(ctx);
    plugin.setActive(true);

    expect(plugin.pickAt(0, 0)).toBe(false);
    expect(plugin.getPoints()).toEqual([]);
  });

  it('a third pick starts a new measurement', () => {
    const plugin = createMeasurePlugin();
    const ctx = fakeContext({
      raycaster: {
        pick: vi
          .fn()
          .mockReturnValueOnce(hit('n1', [0, 0, 0]))
          .mockReturnValueOnce(hit('n2', [3, 4, 0]))
          .mockReturnValueOnce(hit('n3', [10, 0, 0])),
      },
    });
    plugin.register?.(ctx);
    plugin.setActive(true);
    plugin.pickAt(0, 0);
    plugin.pickAt(0, 0);
    expect(plugin.getPoints()).toHaveLength(2);

    plugin.pickAt(0, 0);

    expect(plugin.getPoints()).toEqual([[10, 0, 0]]);
    expect(plugin.getDistance()).toBeNull();
  });

  it('marks each picked node via a colorOverride layer through the RSR facade', () => {
    const plugin = createMeasurePlugin({ markColor: '#ff0000' });
    const ctx = fakeContext({ raycaster: { pick: vi.fn(() => hit('n1', [1, 1, 1])) } });
    plugin.register?.(ctx);
    plugin.setActive(true);

    plugin.pickAt(0, 0);

    expect(ctx.resolver.addLayer).toHaveBeenCalledWith({
      target: { kind: 'node', id: 'n1' },
      channel: 'colorOverride',
      value: { color: '#ff0000', intensity: 1 },
    });
  });

  it('renders an overlay via the UI slot mechanism and clears it on reset', () => {
    const plugin = createMeasurePlugin();
    const ctx = fakeContext({ raycaster: { pick: vi.fn(() => hit('n1', [0, 0, 0])) } });
    plugin.register?.(ctx);
    expect(ctx.ui?.registerSlot).toHaveBeenCalledWith('measure-overlay');

    plugin.setActive(true);
    plugin.pickAt(0, 0);
    expect(ctx.ui?.renderSlot).toHaveBeenLastCalledWith(
      'measure-overlay',
      expect.objectContaining({ type: 'div' }),
    );

    plugin.reset();
    expect(ctx.ui?.renderSlot).toHaveBeenLastCalledWith('measure-overlay', null);
    expect(ctx.resolver.clear).toHaveBeenCalled();
    expect(plugin.getPoints()).toEqual([]);
  });

  it('dispose() cleans up completely: points, RSR layers, and the overlay', async () => {
    const plugin = createMeasurePlugin();
    const ctx = fakeContext({ raycaster: { pick: vi.fn(() => hit('n1', [1, 2, 3])) } });
    plugin.register?.(ctx);
    plugin.setActive(true);
    plugin.pickAt(0, 0);

    await plugin.dispose?.(ctx);

    expect(ctx.resolver.clear).toHaveBeenCalled();
    expect(ctx.ui?.renderSlot).toHaveBeenLastCalledWith('measure-overlay', null);
    expect(plugin.getPoints()).toEqual([]);
    expect(plugin.isActive()).toBe(false);
  });

  it('degrades gracefully with no raycaster/ui facets wired', () => {
    const plugin = createMeasurePlugin();
    const ctx = fakeContext({ raycaster: undefined, ui: undefined });
    plugin.register?.(ctx);
    plugin.setActive(true);

    expect(() => plugin.pickAt(0, 0)).not.toThrow();
    expect(plugin.pickAt(0, 0)).toBe(false);
  });
});
