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
import type { Address } from '@explorer-engine/schema';
import type { ComponentModel } from './component-model';
import type { RenderStatePort, NodeStateUpdate } from './render-state-port';
import {
  composeVisualState,
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

  const layers = new Map<number, StoredLayer>();
  const visualLayersByIdentity = new Map<string, Set<number>>();
  const dirty = new Set<string>();
  const lastPushed = new Map<string, EffectiveVisualState>();
  let nextId = 1;
  let seq = 0;
  let disposed = false;

  const markDirty = (identities: readonly string[]) => {
    for (const identity of identities) dirty.add(identity);
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
      };
      layers.set(id, stored);
      if (isIntentChannel(stored.channel)) {
        onIntentChange();
      } else {
        indexVisual(stored);
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
      else markDirty(layer.identities);
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
      if (disposed || dirty.size === 0) return;
      const updates: NodeStateUpdate[] = [];
      for (const identity of dirty) {
        const state = resolveNode(identity);
        const previous = lastPushed.get(identity);
        if (previous && visualStateEquals(previous, state)) continue;
        const isRest = state === REST_VISUAL_STATE || visualStateEquals(state, REST_VISUAL_STATE);
        // Never touched and already at rest → nothing to reset (avoids a spurious apply).
        if (!previous && isRest) continue;
        updates.push({ identity, state });
        if (isRest) lastPushed.delete(identity);
        else lastPushed.set(identity, state);
      }
      dirty.clear();
      if (updates.length > 0) port.applyNodeStates(updates);
    },

    get layerCount() {
      return layers.size;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      layers.clear();
      visualLayersByIdentity.clear();
      dirty.clear();
      lastPushed.clear();
    },
  };
}
