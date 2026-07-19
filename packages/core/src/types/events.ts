// Typed engine event catalog (ADR-004): maps event name → payload type.
//
// Extended as real modules land. Payloads are data-only and carry no per-frame
// data — hot data flows through ports, never the bus (ENGINE_CONSTITUTION L11).
// The bus is compile-time checked against this map.
import type { BoundingBox } from '../ports/scene-port';
import type { ModelLoadPhase } from '../model/model-loader-port';

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

export interface EngineEventMap {
  'engine:disposed': EngineDisposedEvent;
  'model:loading': ModelLoadingEvent;
  'model:loaded': ModelLoadedEvent;
  'model:error': ModelErrorEvent;
}
