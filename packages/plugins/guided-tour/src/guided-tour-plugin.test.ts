import { describe, it, expect, vi } from 'vitest';
import { createGuidedTourPlugin } from './guided-tour-plugin';
import type { PluginContext } from '@explorer-engine/plugin-sdk';

function fakeContext(overrides: Partial<PluginContext> = {}): PluginContext {
  const emitted: { event: string; payload: unknown }[] = [];
  const ctx = {
    pluginId: 'guided-tour',
    events: {
      emit: (event: string, payload: unknown) => emitted.push({ event, payload }),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
    },
    config: { options: {}, resolved: {} },
    resolver: { addLayer: vi.fn(), updateLayer: vi.fn(), removeLayer: vi.fn(), clear: vi.fn() },
    focus: { focus: vi.fn(() => true), back: vi.fn(), getCurrent: vi.fn(() => null) },
    ui: { registerSlot: vi.fn(), renderSlot: vi.fn() },
    ...overrides,
  } as unknown as PluginContext;
  (ctx as unknown as { __emitted: typeof emitted }).__emitted = emitted;
  return ctx;
}

function emittedOf(ctx: PluginContext): { event: string; payload: unknown }[] {
  return (ctx as unknown as { __emitted: { event: string; payload: unknown }[] }).__emitted;
}

async function boot(plugin: ReturnType<typeof createGuidedTourPlugin>, ctx: PluginContext) {
  await plugin.register?.(ctx);
  await plugin.init?.(ctx);
  await plugin.start?.(ctx);
}

describe('createGuidedTourPlugin', () => {
  it('exposes id and the scenario capability', () => {
    const plugin = createGuidedTourPlugin({ steps: ['a', 'b'] });
    expect(plugin.id).toBe('guided-tour');
    expect(plugin.providesCapabilities).toEqual(['scenario']);
  });

  it('does not start automatically unless autoStart is set', async () => {
    const plugin = createGuidedTourPlugin({ steps: ['a', 'b'] });
    const ctx = fakeContext();
    await boot(plugin, ctx);
    expect(plugin.getCurrentStepIndex()).toBeNull();
  });

  it('autoStart begins the tour at step 0 on start()', async () => {
    const plugin = createGuidedTourPlugin({ steps: ['a', 'b'], autoStart: true });
    const ctx = fakeContext();
    await boot(plugin, ctx);
    expect(plugin.getCurrentStepIndex()).toBe(0);
    expect(ctx.focus?.focus).toHaveBeenCalledWith({ kind: 'component', id: 'a' });
    expect(emittedOf(ctx)).toContainEqual({
      event: 'tour:step',
      payload: { id: 'guided-tour', index: 0, total: 2, target: 'a' },
    });
  });

  it('navigates forward and backward through steps', async () => {
    const plugin = createGuidedTourPlugin({ steps: ['a', 'b', 'c'] });
    const ctx = fakeContext();
    await boot(plugin, ctx);

    expect(plugin.startTour()).toBe(true);
    expect(plugin.getCurrentStepIndex()).toBe(0);
    expect(plugin.next()).toBe(true);
    expect(plugin.getCurrentStepIndex()).toBe(1);
    expect(plugin.previous()).toBe(true);
    expect(plugin.getCurrentStepIndex()).toBe(0);
    expect(plugin.previous()).toBe(false); // already at step 0
  });

  it('completes naturally after the last step (no loop) and emits tour:completed', async () => {
    const plugin = createGuidedTourPlugin({ steps: ['a', 'b'] });
    const ctx = fakeContext();
    await boot(plugin, ctx);
    plugin.startTour();

    expect(plugin.next()).toBe(true); // -> step 1 (last)
    expect(plugin.next()).toBe(false); // completes, does not enter a new step

    expect(plugin.getCurrentStepIndex()).toBeNull();
    expect(emittedOf(ctx)).toContainEqual({
      event: 'tour:completed',
      payload: { id: 'guided-tour', interrupted: false },
    });
  });

  it('loops back to step 0 instead of completing when loop is true', async () => {
    const plugin = createGuidedTourPlugin({ steps: ['a', 'b'], loop: true });
    const ctx = fakeContext();
    await boot(plugin, ctx);
    plugin.startTour();
    plugin.next(); // -> 1

    expect(plugin.next()).toBe(true); // loops
    expect(plugin.getCurrentStepIndex()).toBe(0);
  });

  it('stopTour() interrupts and emits tour:completed with interrupted: true', async () => {
    const plugin = createGuidedTourPlugin({ steps: ['a', 'b'] });
    const ctx = fakeContext();
    await boot(plugin, ctx);
    plugin.startTour();

    plugin.stopTour();

    expect(plugin.getCurrentStepIndex()).toBeNull();
    expect(emittedOf(ctx)).toContainEqual({
      event: 'tour:completed',
      payload: { id: 'guided-tour', interrupted: true },
    });
  });

  it("the Plugin Manager's stop hook interrupts an in-progress tour cleanly", async () => {
    const plugin = createGuidedTourPlugin({ steps: ['a', 'b'] });
    const ctx = fakeContext();
    await boot(plugin, ctx);
    plugin.startTour();

    await plugin.stop?.(ctx);

    expect(plugin.getCurrentStepIndex()).toBeNull();
    expect(emittedOf(ctx)).toContainEqual({
      event: 'tour:completed',
      payload: { id: 'guided-tour', interrupted: true },
    });
  });

  it('config.plugins[].options overrides the constructor defaults at init time', async () => {
    const plugin = createGuidedTourPlugin({ steps: ['a'] });
    const ctx = fakeContext({
      config: { options: { steps: ['x', 'y'], loop: true }, resolved: {} } as never,
    });
    await boot(plugin, ctx);

    plugin.startTour();
    plugin.next();
    expect(plugin.next()).toBe(true); // loops per overridden options, not the ctor default
    expect(plugin.getCurrentStepIndex()).toBe(0);
  });

  it('renders a status descriptor via the UI slot and clears it on dispose', async () => {
    const plugin = createGuidedTourPlugin({ steps: ['a', 'b'], narration: ['hello', undefined] });
    const ctx = fakeContext();
    await boot(plugin, ctx);

    plugin.startTour();
    expect(ctx.ui?.registerSlot).toHaveBeenCalledWith('guided-tour-status');
    expect(ctx.ui?.renderSlot).toHaveBeenLastCalledWith(
      'guided-tour-status',
      expect.objectContaining({ type: 'div' }),
    );

    await plugin.dispose?.(ctx);
    expect(ctx.ui?.renderSlot).toHaveBeenLastCalledWith('guided-tour-status', null);
    expect(plugin.getCurrentStepIndex()).toBeNull();
  });

  it('degrades gracefully with no focus/ui facets wired', async () => {
    const plugin = createGuidedTourPlugin({ steps: ['a', 'b'] });
    const ctx = fakeContext({ focus: undefined, ui: undefined });
    await boot(plugin, ctx);

    expect(() => plugin.startTour()).not.toThrow();
    expect(plugin.getCurrentStepIndex()).toBe(0);
  });

  it('startTour() returns false when there are no steps', async () => {
    const plugin = createGuidedTourPlugin({ steps: [] });
    const ctx = fakeContext();
    await boot(plugin, ctx);

    expect(plugin.startTour()).toBe(false);
  });
});
