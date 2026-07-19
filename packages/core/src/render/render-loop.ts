// On-demand render loop (roadmap P1-T5 ; contract C7, chapter 02 / chapter 14).
//
// The engine renders ONLY when something invalidates the frame — never a
// continuous 60 FPS loop on a stable scene (ENGINE_CONSTITUTION L18). This
// headless component owns the invalidation/scheduling logic; it stays DOM- and
// Three.js-free (L8/L9) by scheduling frames through an injected
// {@link FrameScheduler} rather than requestAnimationFrame.
//
// Guarantees:
//   - at most ONE frame is ever pending (invalidations coalesce);
//   - `requestRender()` during a render schedules exactly one follow-up frame
//     (the next render is never lost);
//   - `dispose()` cancels any pending frame and blocks all further scheduling.
import type { FrameScheduler, FrameRequestToken } from './frame-scheduler';

export interface RenderLoopOptions {
  /** Draws one frame. Invoked by the loop when a render has been requested. */
  readonly render: () => void;
  /** Backend-agnostic frame scheduler (rAF in the host, deterministic in tests). */
  readonly scheduler: FrameScheduler;
}

export interface RenderLoop {
  /**
   * Request a single frame. Idempotent while a frame is already pending (the
   * invalidations coalesce into one frame). Called if invoked during a render,
   * the loop guarantees one follow-up frame after the current one. No-op once
   * disposed.
   */
  requestRender(): void;
  /** Whether a frame is currently scheduled and not yet run. */
  readonly hasPendingFrame: boolean;
  /** Whether the loop has been disposed. */
  readonly isDisposed: boolean;
  /**
   * Stop the loop for good: cancel any pending frame and reject all further
   * `requestRender()` calls. Idempotent.
   */
  dispose(): void;
}

export function createRenderLoop(options: RenderLoopOptions): RenderLoop {
  const { render, scheduler } = options;

  let pendingToken: FrameRequestToken | null = null;
  let rendering = false;
  let invalidatedDuringRender = false;
  let disposed = false;

  const onFrame = () => {
    pendingToken = null;
    if (disposed) return;

    rendering = true;
    invalidatedDuringRender = false;
    try {
      render();
    } finally {
      rendering = false;
    }

    // A `requestRender()` issued *during* the render schedules the next frame now
    // (it was deferred to avoid re-entrant scheduling). Never lost.
    if (invalidatedDuringRender) requestRender();
  };

  function requestRender(): void {
    if (disposed) return;
    // Defer scheduling until the current render finishes, then schedule once.
    if (rendering) {
      invalidatedDuringRender = true;
      return;
    }
    // Coalesce: a frame is already pending, so this invalidation needs no new one.
    if (pendingToken !== null) return;
    pendingToken = scheduler.request(onFrame);
  }

  return {
    requestRender,
    get hasPendingFrame() {
      return pendingToken !== null;
    },
    get isDisposed() {
      return disposed;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (pendingToken !== null) {
        scheduler.cancel(pendingToken);
        pendingToken = null;
      }
    },
  };
}
