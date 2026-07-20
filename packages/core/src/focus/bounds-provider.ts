// BoundsProvider (chapter 08 §8.3, ADR-002) — the data-only contract the Focus
// Manager uses to learn the geometric bounds of a typed target, WITHOUT touching
// Three.js (L8/L9). A renderer adapter resolves an Address to the world-space AABB
// of its nodes; the core does the framing math on plain numbers only.
import type { Address } from '@explorer-engine/schema';
import type { BoundingBox } from '../ports/scene-port';

export interface BoundsProvider {
  /** World-space AABB of the target's nodes, or null when it resolves to nothing. */
  boundsOf(address: Address): BoundingBox | null;
}

/** Current viewport framing parameters (host supplies from camera + renderer). */
export type FrameHint = () => { readonly fovYRadians: number; readonly aspect: number };
