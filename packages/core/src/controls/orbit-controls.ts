// Orbit controls (Controls Manager, chapter 02 §2.6) — HEADLESS.
//
// Pure spherical-coordinate math that turns normalized control gestures into
// camera moves via a CameraPort. No DOM, no Three.js (ENGINE_CONSTITUTION L8/L9):
// a DOM input adapter feeds gestures in; a renderer adapter owns the actual
// camera. Damping is applied in update(), which the host drives per frame.
import type { CameraPort, Vec3 } from '../ports/camera-port';
import type { ControlInput } from '../ports/input-port';
import type { Unsubscribe } from '../events/event-bus';

export interface OrbitControlsOptions {
  /** Orbit target (look-at point). Default [0,0,0]. */
  readonly target?: Vec3;
  /** Initial camera position, used to derive the starting orbit. Default [3,2,4]. */
  readonly position?: Vec3;
  readonly minDistance?: number;
  readonly maxDistance?: number;
  /** Polar-angle limits in radians (0 = looking down the +Y pole). */
  readonly minPolarAngle?: number;
  readonly maxPolarAngle?: number;
  /** Radians of orbit per pixel dragged. */
  readonly rotateSpeed?: number;
  readonly zoomSpeed?: number;
  readonly panSpeed?: number;
  /** Smoothing per update in (0,1]; 1 = no damping (snap). Default 0.18. */
  readonly dampingFactor?: number;
  readonly enableRotate?: boolean;
  readonly enableZoom?: boolean;
  readonly enablePan?: boolean;
}

export interface OrbitControls extends ControlInput {
  /** Ease toward the goal, write the camera, and report whether it is still moving. */
  update(): boolean;
  /**
   * Re-seat the orbit at a new camera pose (e.g. after auto-framing a loaded
   * model). Sets both the goal AND the current state so there is no easing jump,
   * and future gestures orbit around the new `target`.
   */
  setView(position: Vec3, target: Vec3): void;
  /** Subscribe to "a new goal was set" notifications (to wake a render loop). */
  onChange(handler: () => void): Unsubscribe;
  /** Current camera position + orbit target (the eased "current" pose). */
  getView(): { position: Vec3; target: Vec3 };
  /** Release listeners. Idempotent. */
  dispose(): void;
}

interface OrbitState {
  azimuth: number;
  polar: number;
  radius: number;
  tx: number;
  ty: number;
  tz: number;
}

const EPSILON = 1e-4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createOrbitControls(
  camera: CameraPort,
  options: OrbitControlsOptions = {},
): OrbitControls {
  const minDistance = options.minDistance ?? 1.5;
  const maxDistance = options.maxDistance ?? 20;
  const minPolar = options.minPolarAngle ?? 0.05;
  const maxPolar = options.maxPolarAngle ?? Math.PI - 0.05;
  const rotateSpeed = options.rotateSpeed ?? 0.005;
  const zoomSpeed = options.zoomSpeed ?? 0.3;
  const panSpeed = options.panSpeed ?? 0.002;
  const damping = clamp(options.dampingFactor ?? 0.18, EPSILON, 1);
  const enableRotate = options.enableRotate ?? true;
  const enableZoom = options.enableZoom ?? true;
  const enablePan = options.enablePan ?? true;

  const [px, py, pz] = options.position ?? [3, 2, 4];
  const [tx, ty, tz] = options.target ?? [0, 0, 0];
  const ox = px - tx;
  const oy = py - ty;
  const oz = pz - tz;
  const radius0 = clamp(Math.hypot(ox, oy, oz) || minDistance, minDistance, maxDistance);

  const goal: OrbitState = {
    azimuth: Math.atan2(ox, oz),
    polar: clamp(Math.acos(clamp(oy / radius0, -1, 1)), minPolar, maxPolar),
    radius: radius0,
    tx,
    ty,
    tz,
  };
  const current: OrbitState = { ...goal };

  const handlers = new Set<() => void>();
  let disposed = false;

  const notify = () => {
    for (const handler of [...handlers]) handler();
  };

  const orbit: OrbitControls['orbit'] = (dx, dy) => {
    if (disposed || !enableRotate) return;
    goal.azimuth -= dx * rotateSpeed;
    goal.polar = clamp(goal.polar - dy * rotateSpeed, minPolar, maxPolar);
    notify();
  };

  const zoom: OrbitControls['zoom'] = (delta) => {
    if (disposed || !enableZoom) return;
    goal.radius = clamp(goal.radius * Math.exp(-delta * zoomSpeed), minDistance, maxDistance);
    notify();
  };

  const pan: OrbitControls['pan'] = (dx, dy) => {
    if (disposed || !enablePan) return;
    // Camera basis from the current spherical orientation.
    const sinP = Math.sin(current.polar);
    const forward: Vec3 = [
      sinP * Math.sin(current.azimuth),
      Math.cos(current.polar),
      sinP * Math.cos(current.azimuth),
    ];
    // right = normalize(cross(worldUp, forward)); up = cross(forward, right)
    const rx = forward[2];
    const rz = -forward[0];
    const rLen = Math.hypot(rx, rz) || 1;
    const right: Vec3 = [rx / rLen, 0, rz / rLen];
    const up: Vec3 = [
      forward[1] * right[2] - forward[2] * right[1],
      forward[2] * right[0] - forward[0] * right[2],
      forward[0] * right[1] - forward[1] * right[0],
    ];
    const k = panSpeed * current.radius;
    goal.tx += (-dx * right[0] + dy * up[0]) * k;
    goal.ty += (-dx * right[1] + dy * up[1]) * k;
    goal.tz += (-dx * right[2] + dy * up[2]) * k;
    notify();
  };

  const setView: OrbitControls['setView'] = (position, target) => {
    if (disposed) return;
    const dx = position[0] - target[0];
    const dy = position[1] - target[1];
    const dz = position[2] - target[2];
    const r = clamp(Math.hypot(dx, dy, dz) || minDistance, minDistance, maxDistance);
    goal.azimuth = Math.atan2(dx, dz);
    goal.polar = clamp(Math.acos(clamp(dy / r, -1, 1)), minPolar, maxPolar);
    goal.radius = r;
    goal.tx = target[0];
    goal.ty = target[1];
    goal.tz = target[2];
    // Snap current to goal: no easing jump, and update() writes the pose at once.
    current.azimuth = goal.azimuth;
    current.polar = goal.polar;
    current.radius = goal.radius;
    current.tx = goal.tx;
    current.ty = goal.ty;
    current.tz = goal.tz;
    notify();
  };

  const update: OrbitControls['update'] = () => {
    if (disposed) return false;
    current.azimuth += (goal.azimuth - current.azimuth) * damping;
    current.polar += (goal.polar - current.polar) * damping;
    current.radius += (goal.radius - current.radius) * damping;
    current.tx += (goal.tx - current.tx) * damping;
    current.ty += (goal.ty - current.ty) * damping;
    current.tz += (goal.tz - current.tz) * damping;

    const sinP = Math.sin(current.polar);
    const position: Vec3 = [
      current.tx + current.radius * sinP * Math.sin(current.azimuth),
      current.ty + current.radius * Math.cos(current.polar),
      current.tz + current.radius * sinP * Math.cos(current.azimuth),
    ];
    camera.setView(position, [current.tx, current.ty, current.tz]);

    const moving =
      Math.abs(goal.azimuth - current.azimuth) +
        Math.abs(goal.polar - current.polar) +
        Math.abs(goal.radius - current.radius) +
        Math.abs(goal.tx - current.tx) +
        Math.abs(goal.ty - current.ty) +
        Math.abs(goal.tz - current.tz) >
      EPSILON;
    return moving;
  };

  return {
    orbit,
    zoom,
    pan,
    update,
    setView,
    onChange(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    getView() {
      const sinP = Math.sin(current.polar);
      const position: Vec3 = [
        current.tx + current.radius * sinP * Math.sin(current.azimuth),
        current.ty + current.radius * Math.cos(current.polar),
        current.tz + current.radius * sinP * Math.cos(current.azimuth),
      ];
      return { position, target: [current.tx, current.ty, current.tz] };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      handlers.clear();
    },
  };
}
