// State Manager (chapter 09, roadmap P6-T1) — the headless statechart. A `base`
// region is mutually EXCLUSIVE (one active base); modifier regions are PARALLEL
// on/off (X-ray, cutaway…). A state is a set of declarative LAYERS: entering it
// PUBLISHES them to the resolver, leaving it REMOVES them (recomposition, never an
// imperative restore — L6). The manager produces ONLY data-only layers/intents; it
// never touches the camera, an Object3D, a material or an adapter (L5). Transforms
// are ABSOLUTE offsets from the rest pose, so switching states never accumulates
// drift. Headless (L8/L9). Camera intents flow through the resolver's cameraIntent
// (the existing camera adapter executes them); focus (100) outranks state (30).
import type { Address, StateConfig, StateLayerConfig } from '@explorer-engine/schema';
import type { RenderStateResolver } from '../render-state/resolver';
import type { EventBus } from '../events/event-bus';
import type { EngineEventMap } from '../types/events';

/** Layer source prefix for a base state (priority band `state`, ~30). */
const baseSource = (id: string) => `state:${id}`;
/** Layer source prefix for a modifier state (priority band `modifier`, ~50). */
const modifierSource = (id: string) => `modifier:${id}`;

export interface StateManagerOptions {
  readonly resolver: RenderStateResolver;
  readonly states: readonly StateConfig[];
  /** Base state entered at construction; `null` = rest pose. */
  readonly initialState: string | null;
  readonly events?: EventBus<EngineEventMap>;
}

/** Serialisable macroscopic state (chapter 09 §9.6 / chapter 20 subset). */
export interface SerializedState {
  readonly base: string | null;
  readonly modifiers: readonly string[];
}

export interface StateManager {
  /** Enter a state: switches the base (exclusive) or activates a modifier region. */
  goToState(id: string): boolean;
  /** Switch the exclusive base region (validates `allowedFrom`). */
  goToBase(id: string): boolean;
  /** Turn a modifier on/off (default: toggle). Honours `excludes`. */
  toggleModifier(id: string, on?: boolean): boolean;
  /** Return to the previously active base (history). No-op if empty. */
  back(): boolean;
  /** Return to the initial state and drop all modifiers. */
  reset(): void;
  /** Remove every state/modifier layer (rest pose). */
  clear(): void;
  getBase(): string | null;
  getModifiers(): readonly string[];
  isModifierActive(id: string): boolean;
  /** Serialisable snapshot (base + modifiers). */
  serialize(): SerializedState;
  /** Restore a snapshot (clears, then enters base + modifiers). */
  apply(snapshot: SerializedState): void;
  readonly stateCount: number;
  dispose(): void;
}

export function createStateManager(options: StateManagerOptions): StateManager {
  const { resolver, events } = options;
  const byId = new Map<string, StateConfig>();
  for (const s of options.states) byId.set(s.id, s);

  let base: string | null = null;
  const modifiers = new Set<string>();
  const history: string[] = [];
  let disposed = false;

  const isBase = (s: StateConfig) => s.region === 'base';

  /** Publish a state's layers (+ camera intent) under the given source. */
  const publish = (state: StateConfig, source: string) => {
    const transition = state.transition ?? undefined;
    for (const layer of state.layers) addLayer(source, layer, transition);
    if (state.cameraIntent) {
      resolver.addLayer({
        source,
        target: { kind: 'component', id: state.id }, // intent ignores the target
        channel: 'cameraIntent',
        value: { position: state.cameraIntent.position, target: state.cameraIntent.target },
      });
    }
  };

  const addLayer = (
    source: string,
    layer: StateLayerConfig,
    transition: StateConfig['transition'] | undefined,
  ) => {
    const target: Address = layer.target;
    const tr = transition ?? undefined;
    switch (layer.channel) {
      case 'transform':
        resolver.addLayer({
          source,
          target,
          channel: 'transform',
          value: layer.value,
          ...(tr ? { transition: tr } : {}),
        });
        break;
      case 'opacity':
        resolver.addLayer({
          source,
          target,
          channel: 'opacity',
          value: layer.value,
          ...(tr ? { transition: tr } : {}),
        });
        break;
      case 'colorOverride':
        resolver.addLayer({
          source,
          target,
          channel: 'colorOverride',
          value: layer.value,
          ...(tr ? { transition: tr } : {}),
        });
        break;
      case 'visibility':
        resolver.addLayer({
          source,
          target,
          channel: 'visibility',
          value: layer.value,
          ...(tr ? { transition: tr } : {}),
        });
        break;
      case 'clip':
        resolver.addLayer({
          source,
          target,
          channel: 'clip',
          value: layer.value,
          ...(tr ? { transition: tr } : {}),
        });
        break;
    }
  };

  const emitChanged = () => {
    events?.emit('state:changed', { base, modifiers: [...modifiers] });
  };

  /** Switch the base region; `record` pushes the previous base to history. */
  const switchBase = (id: string, record: boolean): boolean => {
    if (disposed) return false;
    const state = byId.get(id);
    if (!state || !isBase(state)) return false;
    if (base === id) return true; // idempotent
    if (state.allowedFrom !== null && base !== null && !state.allowedFrom.includes(base)) {
      return false; // transition not allowed
    }
    events?.emit('state:changing', { from: base, to: id });
    if (base !== null) {
      if (record) history.push(base);
      resolver.removeBySource(baseSource(base));
    }
    base = id;
    publish(state, baseSource(id));
    emitChanged();
    return true;
  };

  const setModifier = (id: string, on: boolean): boolean => {
    if (disposed) return false;
    const state = byId.get(id);
    if (!state || isBase(state)) return false;
    if (modifiers.has(id) === on) return true; // idempotent

    if (on) {
      // Honour mutual exclusions (this state's `excludes` and states that exclude it).
      for (const other of [...modifiers]) {
        const o = byId.get(other);
        if (!o) continue;
        const conflict =
          state.excludes.includes(other) ||
          state.excludes.includes(o.region) ||
          o.excludes.includes(id) ||
          o.excludes.includes(state.region);
        if (conflict) turnOff(other);
      }
      modifiers.add(id);
      publish(state, modifierSource(id));
    } else {
      turnOff(id);
    }
    events?.emit('modifier:changed', { id, on });
    emitChanged();
    return true;
  };

  const turnOff = (id: string) => {
    if (!modifiers.has(id)) return;
    modifiers.delete(id);
    resolver.removeBySource(modifierSource(id));
  };

  const clearAll = () => {
    if (base !== null) {
      resolver.removeBySource(baseSource(base));
      base = null;
    }
    for (const id of [...modifiers]) turnOff(id);
    history.length = 0;
  };

  // Enter the initial base at construction.
  if (options.initialState !== null) {
    const initial = byId.get(options.initialState);
    if (initial && isBase(initial)) switchBase(initial.id, false);
  }

  return {
    goToState(id) {
      const state = byId.get(id);
      if (!state) return false;
      return isBase(state) ? switchBase(id, true) : setModifier(id, true);
    },
    goToBase: (id) => switchBase(id, true),
    toggleModifier(id, on) {
      const state = byId.get(id);
      if (!state || isBase(state)) return false;
      return setModifier(id, on ?? !modifiers.has(id));
    },
    back() {
      const prev = history.pop();
      if (prev === undefined) return false;
      return switchBase(prev, false);
    },
    reset() {
      if (disposed) return;
      clearAll();
      if (options.initialState !== null) {
        const initial = byId.get(options.initialState);
        if (initial && isBase(initial)) switchBase(initial.id, false);
      }
    },
    clear() {
      if (disposed) return;
      clearAll();
      emitChanged();
    },
    getBase: () => base,
    getModifiers: () => [...modifiers],
    isModifierActive: (id) => modifiers.has(id),
    serialize: () => ({ base, modifiers: [...modifiers] }),
    apply(snapshot) {
      if (disposed) return;
      clearAll();
      if (snapshot.base !== null) {
        const s = byId.get(snapshot.base);
        if (s && isBase(s)) switchBase(s.id, false);
      }
      for (const id of snapshot.modifiers) {
        const s = byId.get(id);
        if (s && !isBase(s)) setModifier(id, true);
      }
    },
    get stateCount() {
      return byId.size;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (base !== null) resolver.removeBySource(baseSource(base));
      for (const id of modifiers) resolver.removeBySource(modifierSource(id));
      modifiers.clear();
      history.length = 0;
      base = null;
    },
  };
}
