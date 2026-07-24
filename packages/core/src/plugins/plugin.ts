// Plugin contract + Plugin Context (chapter 10, ADR-006). A plugin is a plain
// object conforming to `Plugin`; it never touches engine internals directly (L16)
// — it only ever sees the restricted, stable `PluginContext` facade handed to it
// by the Plugin Manager. Headless (L8/L9): everything referenced here is a core
// type — no DOM, no Three.js, no ui-webcomponents.
import type { Address, ResolvedConfig } from '@explorer-engine/schema';
import type { EventBus } from '../events/event-bus';
import type { EngineEventMap } from '../types/events';
import type { Logger } from '../diagnostics/logger';
import type { ComponentModel } from '../render-state/component-model';
import type { Channel, ChannelValueMap } from '../render-state/channels';
import type { LayerHandle, RenderLayer } from '../render-state/resolver';
import type { AnimationEngine } from '../animation';
import type { PickHit } from '../selection/raycaster-port';
import type { UiPort } from '../ports/ui-port';

/**
 * A plugin's restricted, `source`-pinned view of the Render State Resolver
 * (ch.10 §10.3, L16): every layer it publishes is automatically tagged
 * `plugin:<id>` and its priority is floored at 200 — the band reserved for
 * plugins (ch.19 §19.6) — regardless of what the plugin passes. A plugin never
 * mutates the scene directly; contributing a layer is its only visual lever.
 */
export interface PluginRenderStateFacade {
  addLayer<C extends Channel>(layer: Omit<RenderLayer<C>, 'source'>): LayerHandle;
  updateLayer<C extends Channel>(handle: LayerHandle, value: ChannelValueMap[C]): void;
  removeLayer(handle: LayerHandle): void;
  /** Remove every layer this plugin has published. Called automatically on dispose. */
  clear(): void;
}

/** A plugin's read-only view of the current Focus stack (ch.10 §10.3). */
export interface PluginFocusFacade {
  focus(target: Address): boolean;
  back(): void;
  getCurrent(): Address | null;
}

/** A plugin's view of the State Manager: request transitions, read the current state. */
export interface PluginStateFacade {
  goToState(id: string): boolean;
  getBase(): string | null;
  getModifiers(): readonly string[];
}

/**
 * The façade the Plugin Manager hands to every hook of a given plugin (ch.10
 * §10.3). Stable for the plugin's whole lifetime. Optional facets are simply
 * absent when the host didn't wire the corresponding manager — a plugin MUST
 * degrade gracefully when one is missing (L23), never throw.
 */
export interface PluginContext {
  readonly pluginId: string;
  /** The shared typed event bus (ADR-004) — the privileged communication channel. */
  readonly events: EventBus<EngineEventMap>;
  /** Namespaced logger (`child(pluginId)`) — diagnostics never go unlogged (L24). */
  readonly logger: Logger;
  /** This plugin's own `config.plugins[].options`, plus read-only global config. */
  readonly config: {
    readonly options: Readonly<Record<string, unknown>>;
    readonly resolved: ResolvedConfig;
  };
  /** Contribute visual state exclusively through layers (L5/L16). */
  readonly resolver: PluginRenderStateFacade;
  /** Read-only scene/component queries (ids, groups, node identities). */
  readonly components: ComponentModel;
  /** Load assets through the shared Resource Manager (cancellation policy, C16). */
  readonly resources: {
    load(path: string): Promise<{ readonly bytes: Uint8Array; readonly url: string }>;
  };
  /** Create tweens/timelines; `play` only — a plugin may never cancel another's. */
  readonly animation: { play: AnimationEngine['play'] };
  readonly focus?: PluginFocusFacade;
  readonly state?: PluginStateFacade;
  /** UI extension points (slots) — never a full UiPort (no shell/panel control). */
  readonly ui?: Pick<UiPort, 'registerSlot' | 'renderSlot'>;
  /** Read-only picking (world-space hit point) — e.g. for a measuring tool. */
  readonly raycaster?: { pick(ndcX: number, ndcY: number): PickHit | null };
}

/**
 * A plugin (ch.10 §10.2). All lifecycle hooks are optional — implement only
 * what you need. Hooks may be async; the Plugin Manager awaits and isolates
 * each one (L17) — a rejected/thrown hook disables just that plugin.
 */
export interface Plugin {
  readonly id: string;
  readonly name?: string;
  readonly version?: string;
  /** Capability ids this plugin needs from the runtime (any provider). Missing
   * one at resolution time disables this plugin with a diagnostic (ch.10 §10.5.2). */
  readonly requiredCapabilities?: readonly string[];
  /** Capability ids this plugin uses if present, degrading gracefully otherwise. */
  readonly optionalCapabilities?: readonly string[];
  /** Plugin ids that must be initialized before this one. Ordering ONLY — grants
   * no access to their internals (L15, ch.10 §10.6bis). */
  readonly orderAfter?: readonly string[];
  /** Plugin ids this one cannot coexist with; one of the pair is disabled. */
  readonly incompatibleWith?: readonly string[];
  /** Capability ids this plugin provides to the runtime (satisfies others'
   * `requiredCapabilities`/`optionalCapabilities`). */
  readonly providesCapabilities?: readonly string[];

  /** Discovery: declare capabilities/namespace. No I/O expected. */
  register?(ctx: PluginContext): void;
  /** Config is available; prepare internal state, subscribe to events. */
  init?(ctx: PluginContext): void | Promise<void>;
  /** The experience is ready: create hotspots/UI, start behaviors. */
  start?(ctx: PluginContext): void | Promise<void>;
  /** Pause / before a package change: suspend behaviors. */
  stop?(ctx: PluginContext): void | Promise<void>;
  /** Teardown: release EVERYTHING (listeners, layers, resources) (L20). */
  dispose?(ctx: PluginContext): void | Promise<void>;
}
