// Plugin Manager (chapter 02 §2.18, chapter 10, ADR-006). Headless orchestrator:
// discovers/loads plugins, resolves capabilities + `orderAfter` into a single
// topological run order (rejecting cycles — L15), runs register→init→start per
// plugin in that order, and isolates every hook so ONE failing plugin never
// breaks the engine or its siblings (L17). It never constructs a PluginContext
// itself — the composition root injects a `createContext` factory per plugin, so
// this module stays decoupled from any concrete manager (RSR/Focus/State/UI).
import type { EventBus } from '../events/event-bus';
import type { EngineEventMap, PluginErrorPhase } from '../types/events';
import type { Logger } from '../diagnostics/logger';
import type { Plugin, PluginContext } from './plugin';

export interface PluginManagerOptions {
  readonly events?: EventBus<EngineEventMap>;
  readonly logger?: Logger;
}

export interface PluginManager {
  /** Add a plugin + its context factory to the registry. Only effective before
   * `start()`; a duplicate id or a late registration is logged and ignored
   * (never throws — L23/L24). */
  registerPlugin(plugin: Plugin, createContext: (plugin: Plugin) => PluginContext): void;
  /**
   * Resolve capabilities/`orderAfter`/incompatibilities into a run order, then
   * run register→init→start for every resolved plugin, in that order. Rejected
   * or failing plugins are isolated with a `plugin:error` diagnostic and simply
   * don't start. Idempotent — a second call is a no-op.
   */
  start(): Promise<void>;
  /** Run `stop` on every active plugin, in REVERSE start order. */
  stop(): Promise<void>;
  /** `stop()` then `dispose` on every plugin that ever got a context (even one
   * that failed register/init/start — partial allocations still get cleaned up).
   * Also force-clears each plugin's RSR layers as a backstop (L20). Idempotent. */
  dispose(): Promise<void>;
  getPlugin(id: string): Plugin | undefined;
  /** Ids currently started and not yet stopped. */
  getActivePluginIds(): readonly string[];
  readonly pluginCount: number;
}

interface Registration {
  readonly plugin: Plugin;
  readonly createContext: (plugin: Plugin) => PluginContext;
}

type Hook = 'register' | 'init' | 'start' | 'stop' | 'dispose';

/**
 * Resolves which registered plugins actually run, and in what order. Single
 * pass: the set of "provided" capabilities is the union of every REGISTERED
 * plugin's `providesCapabilities`, independent of whether that provider itself
 * later gets rejected — a documented simplification (no fixpoint iteration),
 * sufficient for the roadmap's validation criteria.
 */
function resolvePlugins(
  ids: readonly string[],
  plugins: ReadonlyMap<string, Plugin>,
  onRejected: (id: string, message: string) => void,
): readonly Plugin[] {
  const rejected = new Set<string>();

  const provided = new Set<string>();
  for (const id of ids) {
    for (const capability of plugins.get(id)?.providesCapabilities ?? []) provided.add(capability);
  }

  for (const id of ids) {
    const plugin = plugins.get(id);
    if (!plugin) continue;
    const missing = (plugin.requiredCapabilities ?? []).filter((c) => !provided.has(c));
    if (missing.length > 0) {
      rejected.add(id);
      onRejected(id, `missing required capability: ${missing.join(', ')}`);
    }
  }

  // Incompatibilities: deterministically drop the later-registered of the pair.
  for (const id of ids) {
    if (rejected.has(id)) continue;
    const plugin = plugins.get(id);
    if (!plugin) continue;
    for (const otherId of plugin.incompatibleWith ?? []) {
      if (rejected.has(otherId) || !plugins.has(otherId) || otherId === id) continue;
      const loserId = ids.indexOf(id) < ids.indexOf(otherId) ? otherId : id;
      rejected.add(loserId);
      onRejected(loserId, `incompatible with "${loserId === id ? otherId : id}"`);
      if (loserId === id) break; // this plugin is out; stop scanning its own list
    }
  }

  // orderAfter DAG among the survivors — Kahn's algorithm, stable on registration
  // order. An orderAfter reference to an unknown/rejected id is dropped with a
  // diagnostic (sequencing-only, never a hard gate — L15/ch.10 §10.6bis rule 4).
  const remaining = ids.filter((id) => !rejected.has(id));
  const remainingSet = new Set(remaining);
  const dependents = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const id of remaining) indegree.set(id, 0);
  for (const id of remaining) {
    const plugin = plugins.get(id);
    for (const dep of plugin?.orderAfter ?? []) {
      if (!remainingSet.has(dep)) {
        onRejected(id, `orderAfter references unknown or unresolved plugin "${dep}" (ignored)`);
        continue;
      }
      const list = dependents.get(dep);
      if (list) list.push(id);
      else dependents.set(dep, [id]);
      indegree.set(id, (indegree.get(id) ?? 0) + 1);
    }
  }

  const order: string[] = [];
  const queue = remaining.filter((id) => indegree.get(id) === 0);
  while (queue.length > 0) {
    queue.sort((a, b) => remaining.indexOf(a) - remaining.indexOf(b));
    const id = queue.shift() as string;
    order.push(id);
    for (const dependent of dependents.get(id) ?? []) {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) queue.push(dependent);
    }
  }
  const orderSet = new Set(order);
  for (const id of remaining) {
    if (!orderSet.has(id)) onRejected(id, 'orderAfter cycle detected — not initialized');
  }

  return order.map((id) => plugins.get(id)).filter((p): p is Plugin => p !== undefined);
}

export function createPluginManager(options: PluginManagerOptions = {}): PluginManager {
  const { events, logger } = options;
  const registrations = new Map<string, Registration>();
  const contexts = new Map<string, PluginContext>();
  const active = new Set<string>();
  const startedOrder: string[] = [];
  let started = false;
  let disposed = false;

  const emitError = (id: string, phase: PluginErrorPhase, message: string): void => {
    logger?.error(`[plugin:${id}] ${phase}: ${message}`);
    events?.emit('plugin:error', { id, phase, message });
  };

  const runHook = async (plugin: Plugin, ctx: PluginContext, hook: Hook): Promise<boolean> => {
    const fn = plugin[hook];
    if (!fn) return true;
    try {
      await fn(ctx);
      return true;
    } catch (error) {
      emitError(plugin.id, hook, error instanceof Error ? error.message : String(error));
      return false;
    }
  };

  return {
    registerPlugin(plugin, createContext) {
      if (disposed) return;
      if (started) {
        emitError(plugin.id, 'resolve', 'registered after start() — ignored');
        return;
      }
      if (registrations.has(plugin.id)) {
        emitError(plugin.id, 'resolve', 'duplicate plugin id — ignored');
        return;
      }
      registrations.set(plugin.id, { plugin, createContext });
    },

    async start() {
      if (disposed || started) return;
      started = true;
      const ids = [...registrations.keys()];
      const plugins = new Map(ids.map((id) => [id, registrations.get(id) as Registration]));
      const resolved = resolvePlugins(
        ids,
        new Map(ids.map((id) => [id, (plugins.get(id) as Registration).plugin])),
        (id, message) => emitError(id, 'resolve', message),
      );

      for (const plugin of resolved) {
        const registration = registrations.get(plugin.id);
        if (!registration) continue;
        const ctx = registration.createContext(plugin);
        contexts.set(plugin.id, ctx);

        const registeredOk = await runHook(plugin, ctx, 'register');
        if (!registeredOk) continue;
        events?.emit('plugin:registered', { id: plugin.id });

        const initOk = await runHook(plugin, ctx, 'init');
        if (!initOk) continue;

        const startOk = await runHook(plugin, ctx, 'start');
        if (!startOk) continue;

        active.add(plugin.id);
        startedOrder.push(plugin.id);
        events?.emit('plugin:started', { id: plugin.id });
      }
    },

    async stop() {
      if (disposed) return;
      for (const id of [...startedOrder].reverse()) {
        if (!active.has(id)) continue;
        const registration = registrations.get(id);
        const ctx = contexts.get(id);
        if (!registration || !ctx) continue;
        const ok = await runHook(registration.plugin, ctx, 'stop');
        active.delete(id);
        if (ok) events?.emit('plugin:stopped', { id });
      }
    },

    async dispose() {
      if (disposed) return;
      disposed = true;
      for (const id of [...startedOrder].reverse()) {
        if (!active.has(id)) continue;
        const registration = registrations.get(id);
        const ctx = contexts.get(id);
        if (registration && ctx) await runHook(registration.plugin, ctx, 'stop');
        active.delete(id);
      }
      for (const id of registrations.keys()) {
        const registration = registrations.get(id);
        const ctx = contexts.get(id);
        if (!registration || !ctx) continue; // never resolved/started — nothing to release
        const ok = await runHook(registration.plugin, ctx, 'dispose');
        ctx.resolver.clear(); // backstop: guarantee no orphaned layers regardless (L20)
        if (ok) events?.emit('plugin:disposed', { id });
      }
      registrations.clear();
      contexts.clear();
      active.clear();
      startedOrder.length = 0;
    },

    getPlugin: (id) => registrations.get(id)?.plugin,
    getActivePluginIds: () => [...active],
    get pluginCount() {
      return registrations.size;
    },
  };
}
