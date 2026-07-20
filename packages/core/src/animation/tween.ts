// Tween & timeline building blocks (chapter 11 §11.2). An `Animation` is a PURE,
// deterministic mapping from a local time (ms) to applied side effects via `seek`.
// It carries NO clock of its own — the Animation Engine converts injected absolute
// time into local time and drives `seek`. This keeps everything time-based,
// FPS-independent and testable with an injected clock (chapter 11 §11.6.2). Headless.
import type { EaseName } from '@explorer-engine/schema';
import { resolveEasing } from './easing';
import { lerp, lerpVec3, clamp01 } from './interpolate';
import type { Vec3 } from '../ports/camera-port';

/** A deterministic, seekable animation. `duration` is the total local span (ms). */
export interface Animation {
  readonly duration: number;
  /** Apply the animation's effect at local time `localMs`. Pure & idempotent. */
  seek(localMs: number): void;
}

export interface TweenSpec<T> {
  readonly from: T;
  readonly to: T;
  /** Active span in ms (excludes delay). */
  readonly duration: number;
  readonly easing?: EaseName;
  /** Delay before the active span begins. Default 0. */
  readonly delay?: number;
  /** Pure interpolator for `T` (e.g. lerp for numbers). */
  readonly interpolate: (from: T, to: T, t: number) => T;
  /** Applies the current value. Called on every `seek`. */
  readonly onUpdate: (value: T) => void;
}

/** Create a generic tween. Total duration = delay + duration. */
export function createTween<T>(spec: TweenSpec<T>): Animation {
  const delay = Math.max(0, spec.delay ?? 0);
  const span = Math.max(0, spec.duration);
  const ease = resolveEasing(spec.easing ?? 'linear');
  return {
    duration: delay + span,
    seek(localMs: number): void {
      const t = span <= 0 ? (localMs >= delay ? 1 : 0) : clamp01((localMs - delay) / span);
      spec.onUpdate(spec.interpolate(spec.from, spec.to, ease(t)));
    },
  };
}

/** Convenience: tween a scalar. */
export function numberTween(spec: {
  readonly from: number;
  readonly to: number;
  readonly duration: number;
  readonly easing?: EaseName;
  readonly delay?: number;
  readonly onUpdate: (value: number) => void;
}): Animation {
  return createTween<number>({ ...spec, interpolate: lerp });
}

/** Convenience: tween a 3-vector (fresh tuple each update — callers may copy it). */
export function vec3Tween(spec: {
  readonly from: Vec3;
  readonly to: Vec3;
  readonly duration: number;
  readonly easing?: EaseName;
  readonly delay?: number;
  readonly onUpdate: (value: [number, number, number]) => void;
}): Animation {
  return createTween<Vec3>({
    ...spec,
    interpolate: (from, to, t) => lerpVec3(from, to, t),
    onUpdate: (v) => spec.onUpdate(v as [number, number, number]),
  });
}
