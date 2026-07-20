// Render State Resolver (chapter 19, ADR-001, L5–L7) — the SINGLE authority over
// visual state. No module mutates the scene: every subsystem (selection, focus,
// states, modifiers, plugins) PUBLISHES declarative layers here; the resolver
// composes the effective state per node and applies it through the RenderStatePort.
//
// Guarantees (chapter 19 §19.8):
//   • composition is per-channel and INDEPENDENT of publication order (deterministic);
//   • reversibility is by construction — remove a layer, recompose, done (never
//     an imperative "restore" of a saved original, L6);
//   • only DIRTY nodes are recomposed and only CHANGED states are pushed (no
//     per-frame allocation on a stable scene, L19); a change calls requestRender().
//
// Headless & data-only (L8/L9). The camera/lighting INTENT channels are exclusive
// and global; they are resolved and queryable here for the Focus/State managers
// that land later — the resolver already owns the contract.
import type { Address, TransitionSpec } from '@explorer-engine/schema';
import type { ComponentModel } from './component-model';
import type { RenderStatePort, NodeStateUpdate } from './render-state-port';
import { createTween } from '../animation/tween';
import type { AnimationEngine, PlaybackHandle } from '../animation/engine';
import {
  composeVisualState,
  interpolateVisualState,
  isIntentChannel,
  visualStateEquals,
  REST_VISUAL_STATE,
  type Channel,
  type ChannelValueMap,
  type EffectiveVisualState,
  type CameraIntentValue,
  type LightingIntentValue,
  type VisualChannel,
  type VisualContribution,
} from './channels';

/** Who published a layer — used for retrieval, removal and debugging (chapter 19). */
export type LayerSource = string;

/** A declarative contribution to the resolver (chapter 19 §19.3.1). */
export interface RenderLayer<C extends Channel = Channel> {
  readonly source: LayerSource;
  readonly target: Address;
  readonly channel: C;
  readonly value: ChannelValueMap[C];
  /** Departs ties on `(target, channel)`. Defaults to the source's normative band. */
  readonly priority?: number;
  /**
   * How the affected nodes reach their new composed state (chapter 19 §19.4 step 4).
   * Requires an Animation Engine on the resolver; continuous channels (opacity,
   * transform) interpolate, discrete channels snap. Omitted ⇒ IMMEDIATE application
   * (unchanged behaviour). Applies to visual channels only — camera/lighting intent
   * transitions are executed by their adapter.
   */
  readonly transition?: TransitionSpec;
}

/** Opaque handle to a published layer; pass it back to update/remove the layer. */
export interface LayerHandle {
  readonly id: number;
}

/** The resolved winner of an exclusive intent channel. */
export interface ResolvedIntent<V> {
  readonly value: V;
  readonly source: LayerSource;
  readonly priority: number;
}

export interface RenderStateResolverOptions {
  readonly components: ComponentModel;
  readonly port: RenderStatePort;
  /** Wake the on-demand render loop when a layer changes the composed state. */
  readonly requestRender?: () => void;
  /** Notified when the winning camera/lighting intent changes (for P5/P6 adapters). */
  readonly onIntentChange?: () => void;
  /** Enables layer `transition`s (interpolation). Omit ⇒ everything is immediate. */
  readonly animation?: AnimationEngine;
}

export interface RenderStateResolver {
  addLayer<C extends Channel>(layer: RenderLayer<C>): LayerHandle;
  updateLayer<C extends Channel>(handle: LayerHandle, value: ChannelValueMap[C]): void;
  removeLayer(handle: LayerHandle): void;
  /** Remove every layer published by `source`. */
  removeBySource(source: LayerSource): void;
  /** Effective visual state of a single node identity (composition query). */
  resolveNode(identity: string): EffectiveVisualState;
  /** The winning camera intent, or null. */
  getCameraIntent(): ResolvedIntent<CameraIntentValue> | null;
  /** The winning lighting intent, or null. */
  getLightingIntent(): ResolvedIntent<LightingIntentValue> | null;
  /** Recompose dirty nodes and push CHANGED states to the port. Cheap when clean. */
  flush(): void;
  /** Number of published layers (debugging/tests). */
  readonly layerCount: number;
  /** Drop all layers and internal state. Idempotent. */
  dispose(): void;
}

interface StoredLayer {
  readonly id: number;
  readonly source: LayerSource;
  readonly target: Address;
  readonly channel: Channel;
  value: unknown;
  readonly priority: number;
  readonly seq: number;
  /** Node identities the target expands to (empty for intent layers). */
  readonly identities: readonly string[];
  readonly transition?: TransitionSpec;
}

interface ActiveTransition {
  handle: PlaybackHandle | null;
  current: EffectiveVisualState;
}

/** Normative default priority bands (chapter 19 §19.6). */
const DEFAULT_PRIORITY: Record<string, number> = {
  default: 0,
  'state:base': 30,
  'modifier:': 50,
  'selection:hover': 70,
  'selection:active': 75,
  focus: 100,
};

function defaultPriorityFor(source: LayerSource): number {
  if (DEFAULT_PRIORITY[source] !== undefined) return DEFAULT_PRIORITY[source];
  if (source.startsWith('modifier:')) return DEFAULT_PRIORITY['modifier:'] ?? 50;
  if (source.startsWith('plugin:')) return 200;
  if (source.startsWith('state:')) return DEFAULT_PRIORITY['state:base'] ?? 30;
  return 0;
}

export function createRenderStateResolver(
  options: RenderStateResolverOptions,
): RenderStateResolver {
  const { components, port } = options;
  const requestRender = options.requestRender ?? (() => {});
  const onIntentChange = options.onIntentChange ?? (() => {});
  const animation = options.animation;

  const layers = new Map<number, StoredLayer>();
  const visualLayersByIdentity = new Map<string, Set<number>>();
  /** Nodes whose COMPOSITION changed (a layer was added/updated/removed). */
  const dirty = new Set<string>();
  /** Nodes whose in-flight transition advanced this frame (tween ticks). */
  const animating = new Set<string>();
  const lastPushed = new Map<string, EffectiveVisualState>();
  /** Transition spec to apply to a node's NEXT recomposition (consumed by flush). */
  const pendingTransition = new Map<string, TransitionSpec>();
  /** In-flight per-node transitions (interpolation state). */
  const activeTransitions = new Map<string, ActiveTransition>();
  let nextId = 1;
  let seq = 0;
  let disposed = false;

  const markDirty = (identities: readonly string[]) => {
    for (const identity of identities) dirty.add(identity);
  };

  const markAnimating = (identity: string) => {
    animating.add(identity);
  };

  const scheduleTransition = (identities: readonly string[], spec: TransitionSpec | undefined) => {
    if (!spec || !animation) return;
    for (const identity of identities) pendingTransition.set(identity, spec);
  };

  const cancelTransition = (identity: string) => {
    const active = activeTransitions.get(identity);
    if (active) {
      active.handle?.cancel();
      activeTransitions.delete(identity);
    }
  };

  const indexVisual = (layer: StoredLayer) => {
    for (const identity of layer.identities) {
      let set = visualLayersByIdentity.get(identity);
      if (!set) {
        set = new Set();
        visualLayersByIdentity.set(identity, set);
      }
      set.add(layer.id);
    }
  };

  const deindexVisual = (layer: StoredLayer) => {
    for (const identity of layer.identities) {
      const set = visualLayersByIdentity.get(identity);
      if (!set) continue;
      set.delete(layer.id);
      if (set.size === 0) visualLayersByIdentity.delete(identity);
    }
  };

  const contributionsFor = (identity: string): VisualContribution[] => {
    const set = visualLayersByIdentity.get(identity);
    if (!set) return [];
    const out: VisualContribution[] = [];
    for (const layerId of set) {
      const layer = layers.get(layerId);
      if (!layer) continue;
      out.push({
        channel: layer.channel as VisualChannel,
        value: layer.value as ChannelValueMap[VisualChannel],
        priority: layer.priority,
        seq: layer.seq,
      });
    }
    return out;
  };

  const resolveNode = (identity: string): EffectiveVisualState =>
    composeVisualState(contributionsFor(identity));

  /**
   * Begin (or replace) an interpolated transition toward `target` for a node, and
   * return the state to push THIS frame (the current displayed value). Requires an
   * animation engine. Continuous channels lerp; discrete channels snap (chapter 19).
   */
  const startTransition = (
    identity: string,
    target: EffectiveVisualState,
    spec: TransitionSpec,
  ): EffectiveVisualState => {
    const engine = animation;
    if (!engine) return target;
    const existing = activeTransitions.get(identity);
    const from = existing ? existing.current : (lastPushed.get(identity) ?? REST_VISUAL_STATE);
    // Already there → cancel any in-flight transition and snap.
    if (visualStateEquals(from, target)) {
      cancelTransition(identity);
      return target;
    }
    if (existing) existing.handle?.cancel();
    const entry: ActiveTransition = { handle: null, current: from };
    activeTransitions.set(identity, entry);

    const tween = createTween<number>({
      from: 0,
      to: 1,
      duration: spec.duration,
      delay: spec.delay,
      easing: spec.easing,
      interpolate: (a, b, t) => a + (b - a) * t,
      onUpdate: (p) => {
        entry.current = interpolateVisualState(from, target, p);
        markAnimating(identity);
        requestRender();
      },
    });
    entry.handle = engine.play(tween, {
      onComplete: () => {
        entry.current = target;
        activeTransitions.delete(identity);
        markAnimating(identity);
        requestRender();
      },
    });
    return entry.current; // seek(0) already ran → the from-ish start state
  };

  const resolveIntent = <V>(channel: Channel): ResolvedIntent<V> | null => {
    let best: StoredLayer | null = null;
    for (const layer of layers.values()) {
      if (layer.channel !== channel) continue;
      if (
        best === null ||
        layer.priority > best.priority ||
        (layer.priority === best.priority && layer.seq > best.seq)
      ) {
        best = layer;
      }
    }
    return best ? { value: best.value as V, source: best.source, priority: best.priority } : null;
  };

  return {
    addLayer(layer) {
      if (disposed) return { id: -1 };
      const id = nextId++;
      const stored: StoredLayer = {
        id,
        source: layer.source,
        target: layer.target,
        channel: layer.channel,
        value: layer.value,
        priority: layer.priority ?? defaultPriorityFor(layer.source),
        seq: seq++,
        identities: isIntentChannel(layer.channel) ? [] : components.expand(layer.target),
        ...(layer.transition ? { transition: layer.transition } : {}),
      };
      layers.set(id, stored);
      if (isIntentChannel(stored.channel)) {
        onIntentChange();
      } else {
        indexVisual(stored);
        scheduleTransition(stored.identities, stored.transition);
        markDirty(stored.identities);
      }
      requestRender();
      return { id };
    },

    updateLayer(handle, value) {
      const layer = layers.get(handle.id);
      if (!layer) return;
      layer.value = value;
      if (isIntentChannel(layer.channel)) onIntentChange();
      else {
        scheduleTransition(layer.identities, layer.transition);
        markDirty(layer.identities);
      }
      requestRender();
    },

    removeLayer(handle) {
      const layer = layers.get(handle.id);
      if (!layer) return;
      layers.delete(handle.id);
      if (isIntentChannel(layer.channel)) {
        onIntentChange();
      } else {
        deindexVisual(layer);
        scheduleTransition(layer.identities, layer.transition);
        markDirty(layer.identities);
      }
      requestRender();
    },

    removeBySource(source) {
      let removedIntent = false;
      for (const layer of [...layers.values()]) {
        if (layer.source !== source) continue;
        layers.delete(layer.id);
        if (isIntentChannel(layer.channel)) removedIntent = true;
        else {
          deindexVisual(layer);
          scheduleTransition(layer.identities, layer.transition);
          markDirty(layer.identities);
        }
      }
      if (removedIntent) onIntentChange();
      requestRender();
    },

    resolveNode,

    getCameraIntent: () => resolveIntent<CameraIntentValue>('cameraIntent'),
    getLightingIntent: () => resolveIntent<LightingIntentValue>('lightingIntent'),

    flush() {
      if (disposed || (dirty.size === 0 && animating.size === 0)) return;
      const updates: NodeStateUpdate[] = [];
      // Snapshot the identities to process; a starting transition re-marks its node
      // (into `animating`), handled on later frames — the first frame is pushed here.
      const ids = new Set<string>([...dirty, ...animating]);
      for (const identity of ids) {
        const layerChanged = dirty.has(identity);
        const target = resolveNode(identity);

        let pushState: EffectiveVisualState;
        if (layerChanged) {
          const spec = pendingTransition.get(identity);
          pendingTransition.delete(identity);
          if (spec && animation) {
            pushState = startTransition(identity, target, spec);
          } else {
            cancelTransition(identity); // an immediate change overrides any transition
            pushState = target;
          }
        } else {
          // Tween tick only: push the in-flight value, or the target once it ended.
          const active = activeTransitions.get(identity);
          pushState = active ? active.current : target;
        }

        const previous = lastPushed.get(identity);
        if (previous && visualStateEquals(previous, pushState)) continue;
        const isRest =
          pushState === REST_VISUAL_STATE || visualStateEquals(pushState, REST_VISUAL_STATE);
        if (!previous && isRest) continue; // never touched, already at rest
        updates.push({ identity, state: pushState });
        if (isRest) lastPushed.delete(identity);
        else lastPushed.set(identity, pushState);
      }
      dirty.clear();
      animating.clear();
      if (updates.length > 0) port.applyNodeStates(updates);
    },

    get layerCount() {
      return layers.size;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const active of activeTransitions.values()) active.handle?.cancel();
      activeTransitions.clear();
      pendingTransition.clear();
      layers.clear();
      visualLayersByIdentity.clear();
      dirty.clear();
      animating.clear();
      lastPushed.clear();
    },
  };
}
