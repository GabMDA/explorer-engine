// Generic, type-agnostic interpolation (chapter 11 §11.2.1). Headless and pure:
// the Animation Engine interpolates VALUES (numbers, vectors) and the consumer
// decides what they mean (camera pose, opacity, transform offset…). No Three.js,
// no DOM. Vector helpers write into an out-param to avoid per-frame allocation (L19).
import type { Vec3 } from '../ports/camera-port';

/** Linear interpolation of two scalars. */
export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Linear interpolation of two 3-vectors, into `out` (defaults to a fresh tuple). */
export function lerpVec3(
  from: Vec3,
  to: Vec3,
  t: number,
  out: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  out[0] = from[0] + (to[0] - from[0]) * t;
  out[1] = from[1] + (to[1] - from[1]) * t;
  out[2] = from[2] + (to[2] - from[2]) * t;
  return out;
}

/** Clamp `t` into [0,1] (progress guard). */
export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
