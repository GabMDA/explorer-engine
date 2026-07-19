// CameraPort — a backend-agnostic handle to a camera the core can aim and keep
// aspect-correct on resize, without knowing about Three.js/WebGL/DOM (L8/L9).

/** A 3D vector as a plain tuple (no backend types). */
export type Vec3 = readonly [number, number, number];

export interface CameraPort {
  /** Update the aspect ratio (width / height), typically on resize. */
  setAspect(aspect: number): void;
  /** Place the camera at `position` and aim it at `target`. */
  setView(position: Vec3, target: Vec3): void;
  /** Release any resources held by the camera. Idempotent. */
  dispose(): void;
}
