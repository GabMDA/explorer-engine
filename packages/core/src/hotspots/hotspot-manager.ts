// Hotspot Manager (chapter 07, roadmap P4-T2..T4) — the HEADLESS logic of hotspots:
// it instantiates them from config, resolves each typed anchor to node identities
// (via the component model), keeps their lifecycle/visual/occlusion state, exposes a
// data-only snapshot for the UI to render, and dispatches actions as TYPED events.
// It performs no projection (ProjectionPort/adapter) and no DOM (UI adapter). The
// projected positions are hot data delivered through `applyProjection`, not the bus
// (L11). Chapter 07 §7.11: logic here, marker rendering in the UI.
import type { HotspotAction, HotspotConfig, ResolvedConfig } from '@explorer-engine/schema';
import type { ComponentModel } from '../render-state/component-model';
import type { AnchorSpec, ProjectionResult } from './projection-port';
import type { EventBus } from '../events/event-bus';
import type { EngineEventMap } from '../types/events';
import type { Vec3 } from '../ports/camera-port';

/** Marker lifecycle/visual state (chapter 07 §7.6.1). */
export type HotspotVisualState = 'idle' | 'hover' | 'active' | 'occluded' | 'hidden';

/** Data-only snapshot of one hotspot for the UI to render a marker + list entry. */
export interface HotspotView {
  readonly id: string;
  readonly label: string;
  /** Screen position in CSS pixels (top-left origin). */
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  /** Fully renderable: state-visible, on-screen and not occluded-away. */
  readonly visible: boolean;
  readonly occluded: boolean;
  readonly state: HotspotVisualState;
  readonly priority: number;
}

export interface HotspotManagerOptions {
  readonly config: ResolvedConfig;
  readonly components: ComponentModel;
  /** Typed bus for hotspot:activated / hotspot:hover. */
  readonly events?: EventBus<EngineEventMap>;
}

export interface HotspotManager {
  /** Anchor specs for the projector — only for state-visible hotspots. */
  anchors(): readonly AnchorSpec[];
  /** Ingest fresh projection results (positions + occlusion). Hot data, not the bus. */
  applyProjection(results: readonly ProjectionResult[]): void;
  /** Data-only snapshot for the UI, sorted by priority then depth (near last). */
  view(): readonly HotspotView[];
  /** Set hover on a hotspot id (or null to clear). */
  hover(id: string | null): void;
  /** Activate a hotspot: mark active and emit its typed action. No-op if unknown/hidden. */
  activate(id: string): void;
  /** Update state-driven visibility (`visibleInStates`); null = no active state. */
  setActiveState(stateId: string | null): void;
  readonly count: number;
  dispose(): void;
}

interface Runtime {
  readonly config: HotspotConfig;
  readonly spec: AnchorSpec;
  x: number;
  y: number;
  depth: number;
  onScreen: boolean;
  occluded: boolean;
  hover: boolean;
  active: boolean;
  stateVisible: boolean;
}

function toVec3(t: readonly [number, number, number]): Vec3 {
  return [t[0], t[1], t[2]];
}

function buildSpec(config: HotspotConfig, components: ComponentModel): AnchorSpec {
  const offset = config.offset ? toVec3(config.offset) : null;
  if (config.anchor.kind === 'position') {
    return {
      id: config.id,
      identities: [],
      position: toVec3(config.anchor.position),
      offset,
      occludable: config.occludable,
    };
  }
  const identities = components.expand({ kind: config.anchor.kind, id: config.anchor.id });
  return { id: config.id, identities, position: null, offset, occludable: config.occludable };
}

export function createHotspotManager(options: HotspotManagerOptions): HotspotManager {
  const { components, events } = options;
  const runtimes = new Map<string, Runtime>();
  let disposed = false;

  for (const config of options.config.hotspots) {
    runtimes.set(config.id, {
      config,
      spec: buildSpec(config, components),
      x: 0,
      y: 0,
      depth: 0,
      onScreen: false,
      occluded: false,
      hover: false,
      active: false,
      stateVisible: true,
    });
  }

  const isVisibleAnchor = (r: Runtime): boolean =>
    r.stateVisible && (r.spec.position !== null || r.spec.identities.length > 0);

  const visualState = (r: Runtime): HotspotVisualState => {
    if (!r.stateVisible || !r.onScreen) return 'hidden';
    if (r.config.occludable && r.occluded) return 'occluded';
    if (r.active) return 'active';
    if (r.hover) return 'hover';
    return 'idle';
  };

  const isRenderable = (r: Runtime): boolean =>
    r.stateVisible && r.onScreen && !(r.config.occludable && r.occluded);

  return {
    anchors() {
      const out: AnchorSpec[] = [];
      for (const r of runtimes.values()) if (isVisibleAnchor(r)) out.push(r.spec);
      return out;
    },

    applyProjection(results) {
      const seen = new Set<string>();
      for (const result of results) {
        const r = runtimes.get(result.id);
        if (!r) continue;
        r.x = result.x;
        r.y = result.y;
        r.depth = result.depth;
        r.onScreen = result.onScreen;
        r.occluded = result.occluded;
        seen.add(result.id);
      }
      // Anchors not projected this pass are off-screen (e.g. hidden by state).
      for (const r of runtimes.values()) if (!seen.has(r.config.id)) r.onScreen = false;
    },

    view() {
      const out: HotspotView[] = [];
      for (const r of runtimes.values()) {
        out.push({
          id: r.config.id,
          label: r.config.label,
          x: r.x,
          y: r.y,
          depth: r.depth,
          visible: isRenderable(r),
          occluded: r.occluded,
          state: visualState(r),
          priority: r.config.priority,
        });
      }
      // Higher priority and nearer (smaller depth) render on top → sort them last.
      out.sort((a, b) => a.priority - b.priority || b.depth - a.depth);
      return out;
    },

    hover(id) {
      if (disposed) return;
      let changed = false;
      for (const r of runtimes.values()) {
        const next = r.config.id === id;
        if (r.hover !== next) {
          r.hover = next;
          changed = true;
        }
      }
      if (changed) events?.emit('hotspot:hover', { id: id ?? null });
    },

    activate(id) {
      if (disposed) return;
      const r = runtimes.get(id);
      // State-hidden hotspots cannot be activated; occluded/off-screen ones CAN —
      // the accessible list must reach points that are not currently on screen
      // (chapter 07 §7.9).
      if (!r || !r.stateVisible) return;
      for (const other of runtimes.values()) other.active = other.config.id === id;
      const action: HotspotAction = r.config.action;
      events?.emit('hotspot:activated', { id, action });
    },

    setActiveState(stateId) {
      for (const r of runtimes.values()) {
        r.stateVisible =
          stateId === null ||
          r.config.visibleInStates === null ||
          r.config.visibleInStates.includes(stateId);
      }
    },

    get count() {
      return runtimes.size;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      runtimes.clear();
    },
  };
}
