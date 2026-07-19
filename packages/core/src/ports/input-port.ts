// Input contracts (ADR-002). Backend-agnostic and DOM-free: the core defines
// what a control scheme consumes; a DOM input adapter (e.g. @explorer-engine/
// input-dom) translates raw browser events into these calls. No DOM here (L8/L9).

/**
 * The normalized control gestures a camera-control scheme understands.
 * Deltas are in screen pixels; `zoom` delta is unitless (positive = zoom in).
 */
export interface ControlInput {
  /** Orbit by a screen-space drag delta. */
  orbit(dxPixels: number, dyPixels: number): void;
  /** Zoom/dolly by a normalized delta (positive = closer). */
  zoom(delta: number): void;
  /** Pan by a screen-space drag delta. */
  pan(dxPixels: number, dyPixels: number): void;
}

/** Lifecycle of an input source that feeds a {@link ControlInput}. */
export interface InputPort {
  /** Detach every input listener/resource. Idempotent. */
  dispose(): void;
}
