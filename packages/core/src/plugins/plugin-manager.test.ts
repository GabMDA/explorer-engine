import { describe, it, expect, vi } from 'vitest';
import { createPluginManager } from './plugin-manager';
import { EventBus } from '../events/event-bus';
import type { EngineEventMap } from '../types/events';
import type { Plugin, PluginContext } from './plugin';

/** A minimal context sufficient for the manager's own concerns: it never reads
 * anything beyond `resolver.clear()` (the dispose backstop) — everything else is
 * only ever forwarded verbatim to the plugin's own hooks. */
function fakeContext(pluginId: string): PluginContext {
  return {
    pluginId,
    events: new EventBus<EngineEventMap>(),
    resolver: {
      addLayer: vi.fn(() => ({ id: 1 })),
      updateLayer: vi.fn(),
      removeLayer: vi.fn(),
      clear: vi.fn(),
    },
  } as unknown as PluginContext;
}

function trackedPlugin(overrides: Partial<Plugin> & { id: string }): {
  plugin: Plugin;
  calls: string[];
} {
  const calls: string[] = [];
  const plugin: Plugin = {
    register: () => {
      calls.push('register');
    },
    init: () => {
      calls.push('init');
    },
    start: () => {
      calls.push('start');
    },
    stop: () => {
      calls.push('stop');
    },
    dispose: () => {
      calls.push('dispose');
    },
    ...overrides,
  };
  return { plugin, calls };
}

describe('createPluginManager — happy path', () => {
  it('runs register -> init -> start in order, emitting lifecycle events', async () => {
    const events = new EventBus<EngineEventMap>();
    const registered = vi.fn();
    const started = vi.fn();
    events.on('plugin:registered', registered);
    events.on('plugin:started', started);
    const manager = createPluginManager({ events });
    const { plugin, calls } = trackedPlugin({ id: 'a' });

    manager.registerPlugin(plugin, () => fakeContext('a'));
    await manager.start();

    expect(calls).toEqual(['register', 'init', 'start']);
    expect(registered).toHaveBeenCalledWith({ id: 'a' });
    expect(started).toHaveBeenCalledWith({ id: 'a' });
    expect(manager.getActivePluginIds()).toEqual(['a']);
    expect(manager.pluginCount).toBe(1);
  });

  it('stop() runs in reverse start order; dispose() runs on every started plugin', async () => {
    const manager = createPluginManager();
    const order: string[] = [];
    const make = (id: string) =>
      trackedPlugin({
        id,
        start: () => {
          order.push(`start:${id}`);
        },
        stop: () => {
          order.push(`stop:${id}`);
        },
      }).plugin;
    manager.registerPlugin(make('a'), () => fakeContext('a'));
    manager.registerPlugin(make('b'), () => fakeContext('b'));
    await manager.start();

    await manager.stop();

    expect(order).toEqual(['start:a', 'start:b', 'stop:b', 'stop:a']);
    expect(manager.getActivePluginIds()).toEqual([]);
  });

  it('dispose() releases every plugin and force-clears its RSR layers', async () => {
    const events = new EventBus<EngineEventMap>();
    const disposed = vi.fn();
    events.on('plugin:disposed', disposed);
    const manager = createPluginManager({ events });
    const ctx = fakeContext('a');
    const { plugin } = trackedPlugin({ id: 'a' });
    manager.registerPlugin(plugin, () => ctx);
    await manager.start();

    await manager.dispose();

    expect(ctx.resolver.clear).toHaveBeenCalledTimes(1);
    expect(disposed).toHaveBeenCalledWith({ id: 'a' });
    expect(manager.pluginCount).toBe(0);
  });

  it('dispose() is idempotent', async () => {
    const manager = createPluginManager();
    manager.registerPlugin(trackedPlugin({ id: 'a' }).plugin, () => fakeContext('a'));
    await manager.start();

    await manager.dispose();
    await expect(manager.dispose()).resolves.toBeUndefined();
  });
});

describe('createPluginManager — error isolation (L17)', () => {
  it('a throwing register isolates that plugin only; others still start', async () => {
    const events = new EventBus<EngineEventMap>();
    const errors: unknown[] = [];
    events.on('plugin:error', (e) => errors.push(e));
    const manager = createPluginManager({ events });
    const bad = trackedPlugin({
      id: 'bad',
      register: () => {
        throw new Error('boom');
      },
    });
    const good = trackedPlugin({ id: 'good' });
    manager.registerPlugin(bad.plugin, () => fakeContext('bad'));
    manager.registerPlugin(good.plugin, () => fakeContext('good'));

    await manager.start();

    expect(bad.calls).toEqual([]); // init/start never ran after register threw
    expect(good.calls).toEqual(['register', 'init', 'start']);
    expect(manager.getActivePluginIds()).toEqual(['good']);
    expect(errors).toEqual([{ id: 'bad', phase: 'register', message: 'boom' }]);
  });

  it('isolates a rejecting async init', async () => {
    const events = new EventBus<EngineEventMap>();
    const errors: unknown[] = [];
    events.on('plugin:error', (e) => errors.push(e));
    const manager = createPluginManager({ events });
    manager.registerPlugin(
      {
        id: 'bad',
        init: async () => {
          throw new Error('async boom');
        },
      },
      () => fakeContext('bad'),
    );

    await manager.start();

    expect(manager.getActivePluginIds()).toEqual([]);
    expect(errors).toEqual([{ id: 'bad', phase: 'init', message: 'async boom' }]);
  });

  it('isolates a throwing stop and still marks the plugin stopped', async () => {
    const events = new EventBus<EngineEventMap>();
    const errors: unknown[] = [];
    events.on('plugin:error', (e) => errors.push(e));
    const manager = createPluginManager({ events });
    manager.registerPlugin(
      {
        id: 'bad',
        stop: () => {
          throw new Error('stop boom');
        },
      },
      () => fakeContext('bad'),
    );
    await manager.start();

    await manager.stop();

    expect(manager.getActivePluginIds()).toEqual([]);
    expect(errors).toEqual([{ id: 'bad', phase: 'stop', message: 'stop boom' }]);
  });

  it('isolates a throwing dispose and still force-clears its layers', async () => {
    const events = new EventBus<EngineEventMap>();
    const errors: unknown[] = [];
    events.on('plugin:error', (e) => errors.push(e));
    const manager = createPluginManager({ events });
    const ctx = fakeContext('bad');
    manager.registerPlugin(
      {
        id: 'bad',
        dispose: () => {
          throw new Error('dispose boom');
        },
      },
      () => ctx,
    );
    await manager.start();

    await manager.dispose();

    expect(ctx.resolver.clear).toHaveBeenCalledTimes(1);
    expect(errors.at(-1)).toEqual({ id: 'bad', phase: 'dispose', message: 'dispose boom' });
  });
});

describe('createPluginManager — orderAfter (chapter 10 §10.5.2)', () => {
  it('respects a valid orderAfter chain regardless of registration order', async () => {
    const order: string[] = [];
    const manager = createPluginManager();
    const make = (id: string, orderAfter?: readonly string[]) =>
      trackedPlugin({
        id,
        orderAfter,
        start: () => {
          order.push(id);
        },
      }).plugin;
    // Register in reverse of the intended run order.
    manager.registerPlugin(make('c', ['b']), () => fakeContext('c'));
    manager.registerPlugin(make('b', ['a']), () => fakeContext('b'));
    manager.registerPlugin(make('a'), () => fakeContext('a'));

    await manager.start();

    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('rejects a 2-node cycle with a resolve-phase diagnostic; neither plugin starts', async () => {
    const events = new EventBus<EngineEventMap>();
    const errors: { id: string; phase: string }[] = [];
    events.on('plugin:error', (e) => errors.push({ id: e.id, phase: e.phase }));
    const manager = createPluginManager({ events });
    manager.registerPlugin(trackedPlugin({ id: 'a', orderAfter: ['b'] }).plugin, () =>
      fakeContext('a'),
    );
    manager.registerPlugin(trackedPlugin({ id: 'b', orderAfter: ['a'] }).plugin, () =>
      fakeContext('b'),
    );

    await manager.start();

    expect(manager.getActivePluginIds()).toEqual([]);
    expect(errors).toEqual(
      expect.arrayContaining([
        { id: 'a', phase: 'resolve' },
        { id: 'b', phase: 'resolve' },
      ]),
    );
  });

  it('drops an orderAfter reference to an unknown plugin (sequencing-only, never a hard gate)', async () => {
    const manager = createPluginManager();
    const { plugin, calls } = trackedPlugin({ id: 'a', orderAfter: ['ghost'] });
    manager.registerPlugin(plugin, () => fakeContext('a'));

    await manager.start();

    expect(calls).toEqual(['register', 'init', 'start']);
    expect(manager.getActivePluginIds()).toEqual(['a']);
  });
});

describe('createPluginManager — capabilities (ch.10 §10.5.1bis/§10.5.2)', () => {
  it('disables a plugin whose required capability nobody provides', async () => {
    const events = new EventBus<EngineEventMap>();
    const errors: unknown[] = [];
    events.on('plugin:error', (e) => errors.push(e));
    const manager = createPluginManager({ events });
    manager.registerPlugin(
      trackedPlugin({ id: 'a', requiredCapabilities: ['scenario'] }).plugin,
      () => fakeContext('a'),
    );

    await manager.start();

    expect(manager.getActivePluginIds()).toEqual([]);
    expect(errors).toEqual([
      { id: 'a', phase: 'resolve', message: 'missing required capability: scenario' },
    ]);
  });

  it('starts fine when a provider plugin supplies the required capability', async () => {
    const manager = createPluginManager();
    manager.registerPlugin(
      trackedPlugin({ id: 'consumer', requiredCapabilities: ['scenario'] }).plugin,
      () => fakeContext('consumer'),
    );
    manager.registerPlugin(
      trackedPlugin({ id: 'provider', providesCapabilities: ['scenario'] }).plugin,
      () => fakeContext('provider'),
    );

    await manager.start();

    expect([...manager.getActivePluginIds()].sort()).toEqual(['consumer', 'provider']);
  });

  it('a missing OPTIONAL capability never disables the plugin', async () => {
    const manager = createPluginManager();
    manager.registerPlugin(
      trackedPlugin({ id: 'a', optionalCapabilities: ['spatial-audio'] }).plugin,
      () => fakeContext('a'),
    );

    await manager.start();

    expect(manager.getActivePluginIds()).toEqual(['a']);
  });
});

describe('createPluginManager — incompatibleWith', () => {
  it('deterministically disables the later-registered of an incompatible pair', async () => {
    const events = new EventBus<EngineEventMap>();
    const errors: unknown[] = [];
    events.on('plugin:error', (e) => errors.push(e));
    const manager = createPluginManager({ events });
    manager.registerPlugin(trackedPlugin({ id: 'first' }).plugin, () => fakeContext('first'));
    manager.registerPlugin(
      trackedPlugin({ id: 'second', incompatibleWith: ['first'] }).plugin,
      () => fakeContext('second'),
    );

    await manager.start();

    expect(manager.getActivePluginIds()).toEqual(['first']);
    expect(errors).toEqual([
      { id: 'second', phase: 'resolve', message: 'incompatible with "first"' },
    ]);
  });
});

describe('createPluginManager — registration edge cases', () => {
  it('ignores a duplicate plugin id with a diagnostic', async () => {
    const events = new EventBus<EngineEventMap>();
    const errors: unknown[] = [];
    events.on('plugin:error', (e) => errors.push(e));
    const manager = createPluginManager({ events });
    manager.registerPlugin(trackedPlugin({ id: 'a' }).plugin, () => fakeContext('a'));
    manager.registerPlugin(trackedPlugin({ id: 'a' }).plugin, () => fakeContext('a'));

    expect(manager.pluginCount).toBe(1);
    expect(errors).toEqual([
      { id: 'a', phase: 'resolve', message: 'duplicate plugin id — ignored' },
    ]);
  });

  it('ignores a registration attempted after start()', async () => {
    const events = new EventBus<EngineEventMap>();
    const errors: unknown[] = [];
    events.on('plugin:error', (e) => errors.push(e));
    const manager = createPluginManager({ events });
    await manager.start();

    manager.registerPlugin(trackedPlugin({ id: 'late' }).plugin, () => fakeContext('late'));

    expect(manager.pluginCount).toBe(0);
    expect(errors).toEqual([
      { id: 'late', phase: 'resolve', message: 'registered after start() — ignored' },
    ]);
  });

  it('start() is idempotent (a second call is a no-op)', async () => {
    const manager = createPluginManager();
    const { plugin, calls } = trackedPlugin({ id: 'a' });
    manager.registerPlugin(plugin, () => fakeContext('a'));

    await manager.start();
    await manager.start();

    expect(calls).toEqual(['register', 'init', 'start']); // not run twice
  });

  it('getPlugin returns the registered plugin definition', () => {
    const manager = createPluginManager();
    const { plugin } = trackedPlugin({ id: 'a' });
    manager.registerPlugin(plugin, () => fakeContext('a'));

    expect(manager.getPlugin('a')).toBe(plugin);
    expect(manager.getPlugin('nope')).toBeUndefined();
  });
});
