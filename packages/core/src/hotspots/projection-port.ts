// ProjectionPort (chapter 07 §7.3, C9/C13, ADR-002) — projects 3D hotspot anchors
// to 2D screen coordinates and reports occlusion. This is HOT per-frame data, so
// it flows through a PORT, never the event bus (L11). The math needs the camera
// and scene geometry, so a renderer adapter implements it; occlusion is a THROTTLED
// CPU raycast with NO synchronous GPU→CPU readback (L21 / chapter 07 §7.4.1).
import type { Vec3 } from '../ports/camera-port';

/** A resolved hotspot anchor the adapter can project (core → adapter, data-only). */
export interface AnchorSpec {
  readonly id: string;
  /** Node identities whose combined centre is the anchor (empty ⇒ fixed position). */
  readonly identities: readonly string[];
  /** Fixed model-space anchor position, or null when anchored to nodes. */
  readonly position: Vec3 | null;
  /** Constant offset added to the anchor point, or null. */
  readonly offset: Vec3 | null;
  /** Whether the adapter should compute an occlusion test for this anchor. */
  readonly occludable: boolean;
}

/** The projected screen state of one anchor (adapter → core, data-only). */
export interface ProjectionResult {
  readonly id: string;
  /** Screen x in CSS pixels (top-left origin). */
  readonly x: number;
  /** Screen y in CSS pixels (top-left origin). */
  readonly y: number;
  /** Camera-space depth (distance); larger = farther. Drives z-ordering. */
  readonly depth: number;
  /** Within the viewport AND in front of the camera. */
  readonly onScreen: boolean;
  /** Behind occluding geometry (false when not occludable or not tested). */
  readonly occluded: boolean;
}

export interface ProjectionPort {
  /**
   * Project the given anchors. Implementations SHOULD skip work when neither the
   * camera nor the geometry moved (dirty flag) and throttle occlusion to a few Hz.
   */
  project(anchors: readonly AnchorSpec[]): readonly ProjectionResult[];
}
