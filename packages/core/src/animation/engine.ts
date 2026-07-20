// Animation Engine (chapter 11) — the headless, generic temporal service. It owns
// NO clock: the host drives it with `update(nowMs)` (injected time → determinism &
// FPS independence, §11.6.2). It advances active playbacks by a CLAMPED delta
// (frame-drop guard), fires lifecycle events, and supports pause/resume/cancel and
// clean replacement. Frame ownership (§11.8.1): a new/resumed playback calls
// requestRender to wake the loop; the host keeps ticking while `hasActive`, then
// the loop goes dormant — NO setInterval, NO permanent 60 FPS loop (L18). Reduced
// motion completes instantly (§11.9). Generic and Three.js-free (L8/L9).
import type { Animation } from './tween';

export type PlaybackState = 'running' | 'paused' | 'completed' | 'cancelled';

export interface PlaybackHandle {
  /** Suspend advancement (idempotent; no-op unless running). */
  pause(): void;
  /** Resume advancement and wake the render loop (idempotent). */
  resume(): void;
  /** Stop in place without firing `complete`; fires `cancel`. Idempotent. */
  cancel(): void;
  readonly state: PlaybackState;
  /** Progress ∈ [0,1]. */
  readonly progress: number;
}

export interface PlayOptions {
  readonly onStart?: () => void;
  readonly onUpdate?: (progress: number) => void;
  readonly onComplete?: () => void;
  readonly onCancel?: () => void;
}

export interface AnimationEngineOptions {
  /** Wake the on-demand loop when a playback needs frames. */
  readonly requestRender?: () => void;
  /** Upper bound on a single advance step, ms (bg-tab guard). Default 100. */
  readonly maxDeltaMs?: number;
  /** When true, playbacks jump straight to their end (prefers-reduced-motion). */
  readonly reducedMotion?: boolean;
}

export interface AnimationEngine {
  /** Start `animation`; returns a handle to pause/resume/cancel it. */
  play(animation: Animation, opts?: PlayOptions): PlaybackHandle;
  /** Advance all running playbacks to absolute time `nowMs`. Returns active count. */
  update(nowMs: number): number;
  readonly activeCount: number;
  readonly hasActive: boolean;
  /** Cancel every active playback. */
  cancelAll(): void;
  /** Cancel everything and block further play/update. Idempotent. */
  dispose(): void;
}

interface Playback {
  readonly animation: Animation;
  readonly opts: PlayOptions;
  local: number;
  state: PlaybackState;
  handle: PlaybackHandle;
}

export function createAnimationEngine(options: AnimationEngineOptions = {}): AnimationEngine {
  const requestRender = options.requestRender ?? (() => {});
  const maxDelta = options.maxDeltaMs ?? 100;
  const reducedMotion = options.reducedMotion ?? false;

  const active = new Set<Playback>();
  let lastNow: number | null = null;
  let disposed = false;

  const progressOf = (pb: Playback): number =>
    pb.animation.duration <= 0 ? 1 : Math.min(1, pb.local / pb.animation.duration);

  const finish = (pb: Playback, state: 'completed' | 'cancelled') => {
    active.delete(pb);
    pb.state = state;
    if (state === 'completed') pb.opts.onComplete?.();
    else pb.opts.onCancel?.();
  };

  return {
    play(animation, opts = {}) {
      const pb: Playback = {
        animation,
        opts,
        local: 0,
        state: 'running',
        handle: undefined as unknown as PlaybackHandle,
      };
      pb.handle = {
        get state() {
          return pb.state;
        },
        get progress() {
          return progressOf(pb);
        },
        pause() {
          if (pb.state === 'running') pb.state = 'paused';
        },
        resume() {
          if (pb.state === 'paused') {
            pb.state = 'running';
            active.add(pb);
            requestRender();
          }
        },
        cancel() {
          if (pb.state === 'running' || pb.state === 'paused') finish(pb, 'cancelled');
        },
      };

      if (disposed) {
        pb.state = 'cancelled';
        return pb.handle;
      }

      opts.onStart?.();
      // Reduced motion (or a zero-length animation): jump straight to the end.
      if (reducedMotion || animation.duration <= 0) {
        animation.seek(animation.duration);
        pb.local = animation.duration;
        opts.onUpdate?.(1);
        finish(pb, 'completed');
        return pb.handle;
      }

      // Establish the initial value at t=0 so the first rendered frame is correct.
      animation.seek(0);
      opts.onUpdate?.(0);
      active.add(pb);
      requestRender();
      return pb.handle;
    },

    update(nowMs) {
      if (disposed) return 0;
      const previous = lastNow;
      lastNow = nowMs;
      if (previous === null) return active.size; // baseline frame: no delta yet
      const delta = Math.min(Math.max(0, nowMs - previous), maxDelta);
      if (delta === 0) return active.size;

      // Snapshot: callbacks may add/cancel playbacks during iteration.
      for (const pb of [...active]) {
        if (pb.state !== 'running') continue;
        pb.local += delta;
        const end = pb.animation.duration;
        const clamped = Math.min(pb.local, end);
        pb.animation.seek(clamped);
        pb.opts.onUpdate?.(progressOf(pb));
        if (pb.local >= end) finish(pb, 'completed');
      }
      return active.size;
    },

    get activeCount() {
      return active.size;
    },
    get hasActive() {
      return active.size > 0;
    },

    cancelAll() {
      for (const pb of [...active]) finish(pb, 'cancelled');
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const pb of [...active]) finish(pb, 'cancelled');
      active.clear();
    },
  };
}
