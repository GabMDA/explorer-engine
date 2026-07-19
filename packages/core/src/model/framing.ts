// Automatic camera framing (roadmap P2-T2). Pure, headless math (no Three.js/DOM):
// given a model's axis-aligned bounding box and the camera's vertical FOV + aspect,
// compute a camera position/target that fits the whole model in view with a margin.
// Only data-only types cross this boundary (BoundingBox, Vec3, numbers) — L8/L9.
import type { BoundingBox } from '../ports/scene-port';
import type { Vec3 } from '../ports/camera-port';

export interface FramingOptions {
  /** Vertical field of view, in radians. */
  readonly fovYRadians: number;
  /** Viewport aspect ratio (width / height). Defaults to 1. */
  readonly aspect?: number;
  /** Direction from the target to the camera (need not be normalized). Default [0.7,0.5,1]. */
  readonly direction?: Vec3;
  /** Zoom-out factor (> 1 leaves empty space around the model). Default 1.2. */
  readonly margin?: number;
}

export interface FramingResult {
  /** Where to place the camera. */
  readonly position: Vec3;
  /** Where the camera should look (the model centre). */
  readonly target: Vec3;
  /** Distance from target to camera. */
  readonly distance: number;
  /** Bounding-sphere radius used for the fit. */
  readonly radius: number;
  /** A safe near plane for this framing (informational; applied only if a port allows). */
  readonly near: number;
  /** A safe far plane for this framing (informational). */
  readonly far: number;
}

const EPSILON = 1e-4;
const DEFAULT_DIRECTION: Vec3 = [0.7, 0.5, 1];

function clampFov(fov: number): number {
  if (!Number.isFinite(fov)) return Math.PI / 4;
  return Math.min(Math.PI - 0.01, Math.max(0.01, fov));
}

/**
 * Compute a camera pose that frames `box`. Handles an empty/degenerate box by
 * falling back to a unit radius, and always returns finite, safe values.
 */
export function computeCameraFraming(box: BoundingBox, options: FramingOptions): FramingResult {
  const { min, max } = box;
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const ex = (max[0] - min[0]) / 2;
  const ey = (max[1] - min[1]) / 2;
  const ez = (max[2] - min[2]) / 2;
  const rawRadius = Math.hypot(ex, ey, ez);
  const radius = rawRadius > EPSILON ? rawRadius : 1; // empty/degenerate → unit fallback

  const fovY = clampFov(options.fovYRadians);
  const aspect = options.aspect !== undefined && options.aspect > 0 ? options.aspect : 1;
  const margin = options.margin !== undefined && options.margin > 0 ? options.margin : 1.2;

  // Fit the bounding sphere in both the vertical and horizontal FOV; take the
  // larger (safer) distance so nothing is cropped in either dimension.
  const distV = radius / Math.sin(fovY / 2);
  const fovX = 2 * Math.atan(Math.tan(fovY / 2) * aspect);
  const distH = radius / Math.sin(fovX / 2);
  const distance = Math.max(distV, distH) * margin;

  const d = options.direction ?? DEFAULT_DIRECTION;
  const dLen = Math.hypot(d[0], d[1], d[2]) || 1;
  const dir: Vec3 = [d[0] / dLen, d[1] / dLen, d[2] / dLen];

  const position: Vec3 = [
    center[0] + dir[0] * distance,
    center[1] + dir[1] * distance,
    center[2] + dir[2] * distance,
  ];

  const near = Math.max(distance - radius, distance * 0.01, 1e-3);
  const far = distance + radius * 2 + 1e-3;

  return { position, target: center, distance, radius, near, far };
}
