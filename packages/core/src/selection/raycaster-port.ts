// RaycasterPort (chapter 08 §8.2.1, ADR-002) — the data-only contract the core
// uses to pick a node under a screen point. Raycasting needs the camera and the
// scene geometry, so a renderer adapter implements it (renderer-three); the core
// receives only a node IDENTITY and a world point — never a Three.js object (L8/L9).
import type { Vec3 } from '../ports/camera-port';

/** A picking hit resolved to a stable node identity (explorerId or name). */
export interface PickHit {
  /** Identity of the nearest addressable ancestor of the hit object. */
  readonly identity: string;
  /** World-space hit point. */
  readonly point: Vec3;
  /** Distance from the camera to the hit, in world units. */
  readonly distance: number;
}

export interface RaycasterPort {
  /**
   * Pick at normalized device coordinates (`x`, `y` ∈ [-1, 1], y up). Returns the
   * nearest hit resolved to a node identity, or null when nothing addressable is hit.
   */
  pick(ndcX: number, ndcY: number): PickHit | null;
}
