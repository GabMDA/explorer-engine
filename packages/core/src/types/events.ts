// Typed engine event catalog (ADR-004): maps event name → payload type.
//
// Extended as real modules land. Payloads are data-only and carry no per-frame
// data — hot data flows through ports, never the bus (ENGINE_CONSTITUTION L11).
// The bus is compile-time checked against this map.
import type { BoundingBox } from '../ports/scene-port';
import type { ModelLoadPhase } from '../model/model-loader-port';
import type { Address, HotspotAction } from '@explorer-engine/schema';

export interface EngineDisposedEvent {
  /** Epoch milliseconds at which disposal occurred. */
  readonly at: number;
}

/** A model load entered a new phase (P2-T2). */
export interface ModelLoadingEvent {
  readonly url: string;
  readonly phase: ModelLoadPhase;
}

/** A model finished loading and was inserted + framed (P2-T2). */
export interface ModelLoadedEvent {
  readonly url: string;
  readonly boundingBox: BoundingBox;
}

/** A model load failed (P2-T2). No backend objects, just a message. */
export interface ModelErrorEvent {
  readonly url: string;
  readonly message: string;
}

/** Selection changed to a component (P4-T1). Discrete — never per-frame (L11). */
export interface SelectionChangedEvent {
  readonly component: string;
}

/** Hover moved to a component, or cleared (`null`). Discrete (L11). */
export interface SelectionHoverEvent {
  readonly component: string | null;
}

/** A hotspot was activated; carries its typed config action (P4-T4). */
export interface HotspotActivatedEvent {
  readonly id: string;
  readonly action: HotspotAction;
}

/** Hover moved to a hotspot, or cleared (`null`). Discrete (L11). */
export interface HotspotHoverEvent {
  readonly id: string | null;
}

/** A focus level was entered (P5-T4). */
export interface FocusStartedEvent {
  readonly target: Address;
}

/** A focus level was exited; `current` is the new top of the stack (or null). */
export interface FocusEndedEvent {
  readonly target: Address;
  readonly current: Address | null;
}

export interface EngineEventMap {
  'engine:disposed': EngineDisposedEvent;
  'model:loading': ModelLoadingEvent;
  'model:loaded': ModelLoadedEvent;
  'model:error': ModelErrorEvent;
  'selection:changed': SelectionChangedEvent;
  'selection:cleared': Record<string, never>;
  'selection:hover': SelectionHoverEvent;
  'hotspot:activated': HotspotActivatedEvent;
  'hotspot:hover': HotspotHoverEvent;
  'focus:started': FocusStartedEvent;
  'focus:ended': FocusEndedEvent;
}
