// Camera intent controller (chapter 08 §8.3, chapter 19 §19.5, roadmap P5-T3) —
// the CAMERA ADAPTER that consumes the resolver's exclusive `cameraIntent` and
// executes the actual camera move. It contains NO business logic: it reads the
// resolved intent (data-only) and animates the camera pose toward it via the core
// Animation Engine, applying each frame through the CameraPort / OrbitControls.
// Return-to-overview is intrinsic: when the intent clears (focus removed → RSR
// recomposes to none), it animates back to the captured home pose (no imperative
// restore). Renders on demand DURING the transition only (the engine holds the
// frame while active, then the loop goes dormant, L18). It owns the home/reference
// pose (renderer-three keeps the camera reference).
import type {
  RenderStateResolver,
  AnimationEngine,
  PlaybackHandle,
  OrbitControls,
  CameraPort,
  TransitionSpec,
  Vec3,
} from '@explorer-engine/core';
import { createTween, lerpVec3, DEFAULT_FOCUS_TRANSITION } from '@explorer-engine/core';

interface Pose {
  readonly position: Vec3;
  readonly target: Vec3;
}

export interface CameraIntentControllerOptions {
  readonly resolver: RenderStateResolver;
  /** The camera to drive (its pose is written through this port). */
  readonly camera: CameraPort;
  /** When present, poses are applied through the controls so orbiting resumes cleanly. */
  readonly controls?: OrbitControls;
  readonly animation: AnimationEngine;
  /** Transition timing for camera moves. Defaults to the focus default (600ms). */
  readonly transition?: TransitionSpec;
  readonly requestRender?: () => void;
  /** Distance below which two poses are considered equal (skip the move). */
  readonly epsilon?: number;
}

export interface CameraIntentController {
  /** Read the current camera intent and start/replace a transition toward it. */
  sync(): void;
  /** Seed the pose returned to when the intent clears (the overview). */
  setHome(position: Vec3, target: Vec3): void;
  isTransitioning(): boolean;
  /** The last pose applied by the controller. */
  getView(): Pose;
  dispose(): void;
}

function poseEquals(a: Pose, b: Pose, eps: number): boolean {
  const d = (u: Vec3, v: Vec3) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
  return d(a.position, b.position) <= eps && d(a.target, b.target) <= eps;
}

export function createCameraIntentController(
  options: CameraIntentControllerOptions,
): CameraIntentController {
  const { resolver, camera, controls, animation } = options;
  const transition = options.transition ?? DEFAULT_FOCUS_TRANSITION;
  const requestRender = options.requestRender ?? (() => {});
  const eps = options.epsilon ?? 1e-4;

  let lastApplied: Pose = controls
    ? controls.getView()
    : { position: [3, 2, 4], target: [0, 0, 0] };
  let home: Pose | null = null;
  let handle: PlaybackHandle | null = null;
  let disposed = false;

  const currentPose = (): Pose => (controls ? controls.getView() : lastApplied);

  const applyPose = (position: Vec3, target: Vec3) => {
    if (controls) controls.setView(position, target);
    else camera.setView(position, target);
    lastApplied = { position, target };
  };

  const transitionTo = (dest: Pose) => {
    if (disposed) return;
    const from = currentPose();
    if (poseEquals(from, dest, eps)) {
      handle?.cancel();
      handle = null;
      applyPose(dest.position, dest.target);
      return;
    }
    handle?.cancel();
    const tween = createTween<Pose>({
      from,
      to: dest,
      duration: transition.duration,
      delay: transition.delay,
      easing: transition.easing,
      interpolate: (a, b, t) => ({
        position: lerpVec3(a.position, b.position, t),
        target: lerpVec3(a.target, b.target, t),
      }),
      onUpdate: (pose) => applyPose(pose.position, pose.target),
    });
    handle = animation.play(tween, {
      onComplete: () => {
        applyPose(dest.position, dest.target);
        handle = null;
        requestRender();
      },
    });
    requestRender();
  };

  return {
    sync() {
      if (disposed) return;
      const intent = resolver.getCameraIntent();
      if (intent) {
        if (home === null) home = currentPose(); // capture overview before the first focus
        transitionTo({ position: intent.value.position, target: intent.value.target });
      } else if (home !== null) {
        transitionTo(home);
      }
    },
    setHome(position, target) {
      home = { position, target };
      lastApplied = { position, target };
    },
    isTransitioning: () => handle !== null && handle.state === 'running',
    getView: () => lastApplied,
    dispose() {
      if (disposed) return;
      disposed = true;
      handle?.cancel();
      handle = null;
    },
  };
}
