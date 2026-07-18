// Typed engine event catalog (ADR-004): maps event name → payload type.
//
// Minimal at P0-T4: only the lifecycle event that actually exists today. It is
// extended as real modules land (states, hotspots, focus, …). Keeping it honest
// and small is deliberate — the bus is compile-time checked against this map.

export interface EngineDisposedEvent {
  /** Epoch milliseconds at which disposal occurred. */
  readonly at: number;
}

export interface EngineEventMap {
  'engine:disposed': EngineDisposedEvent;
}
