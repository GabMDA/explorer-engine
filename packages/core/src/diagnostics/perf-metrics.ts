// Performance metrics (roadmap P9-T2 ; chapter 14 §14.1.1/§14.8). Headless
// instrumentation: FPS, frame time and scripting time, smoothed, plus an
// optional pass-through of renderer statistics. Collected with zero
// allocation per frame (ENGINE_CONSTITUTION L19) — every field is a plain
// number updated in place; nothing is stored per-frame in an array.
//
// `beginFrame()`/`endFrame()` are meant to bracket exactly the same unit of
// work the render loop already performs once per rendered frame (chapter 02
// §"requestRender()", C7) — they add no scheduling of their own and never
// trigger a render themselves.
import type { RendererStats } from '../ports/renderer-port';

export type { RendererStats };

export interface PerfMetricsOptions {
  /**
   * Injectable clock in milliseconds. Defaults to `Date.now`, which needs no
   * DOM lib (ENGINE_CONSTITUTION L8/L9) and keeps this module usable in
   * tests/Node. A host with sub-millisecond precision may inject
   * `performance.now` instead.
   */
  readonly now?: () => number;
  /**
   * Exponential-moving-average smoothing factor in `(0, 1]`. Higher reacts
   * faster to spikes; lower is steadier for on-screen display. Defaults to
   * `0.1` (ch.14 §14.8).
   */
  readonly smoothing?: number;
  /**
   * The render loop is on-demand (ENGINE_CONSTITUTION L18): a static scene
   * legitimately renders no frame for seconds. A gap since the previous
   * `beginFrame` larger than this (ms) is therefore an IDLE gap, not a slow
   * frame — it is excluded from `fps`/`frameTimeMs` (which would otherwise
   * read a nonsensical "0.2 FPS" right after resuming from idle). Defaults
   * to 250ms — comfortably above any real frame, well below a deliberate
   * pause. `scriptingTimeMs` is unaffected: it always reflects actual work.
   */
  readonly maxFrameGapMs?: number;
}

/** A single consistent read of every metric (chapter 14 §14.8 overlay). */
export interface PerfSnapshot {
  readonly fps: number;
  readonly frameTimeMs: number;
  readonly scriptingTimeMs: number;
  readonly rendererStats: RendererStats | null;
}

export interface PerfMetrics {
  /** Mark the start of a frame's script execution. Call once per rendered frame. */
  beginFrame(): void;
  /**
   * Mark the end of a frame's script execution (after the renderer's
   * `render()` call returns). Derives this frame's scripting time, the frame
   * time (delta since the previous `beginFrame`) and FPS — all smoothed.
   */
  endFrame(): void;
  /**
   * Attach the latest renderer statistics, when the active `RendererPort`
   * exposes `getStats()`. Pass `null` when unavailable — `fps`/`frameTimeMs`/
   * `scriptingTimeMs` never depend on this being set (ch.14 §14.8).
   */
  setRendererStats(stats: RendererStats | null): void;
  /** Smoothed frames-per-second, derived from consecutive `beginFrame` calls. */
  readonly fps: number;
  /** Smoothed total frame time in ms (≈ `1000 / fps`). */
  readonly frameTimeMs: number;
  /**
   * Smoothed scripting time in ms — the work done inside one `beginFrame`/
   * `endFrame` bracket, distinct from the full frame interval when the loop
   * idles between frames (ch.14 §14.1.1).
   */
  readonly scriptingTimeMs: number;
  readonly rendererStats: RendererStats | null;
  /** A single immutable read of the four fields above. */
  snapshot(): PerfSnapshot;
  /** Reset smoothed values (fps/frameTimeMs/scriptingTimeMs). Keeps the last renderer stats. */
  reset(): void;
}

export function createPerfMetrics(options: PerfMetricsOptions = {}): PerfMetrics {
  const now = options.now ?? Date.now;
  const alpha = options.smoothing ?? 0.1;
  const maxFrameGapMs = options.maxFrameGapMs ?? 250;

  let frameStart = 0;
  let lastFrameStart: number | null = null;
  let fps = 0;
  let frameTimeMs = 0;
  let scriptingTimeMs = 0;
  let rendererStats: RendererStats | null = null;

  return {
    beginFrame() {
      frameStart = now();
    },
    endFrame() {
      const end = now();
      const scripting = end - frameStart;
      scriptingTimeMs =
        scriptingTimeMs === 0 ? scripting : scriptingTimeMs + alpha * (scripting - scriptingTimeMs);

      if (lastFrameStart !== null) {
        const delta = frameStart - lastFrameStart;
        // A gap beyond maxFrameGapMs is the on-demand loop legitimately idling
        // (L18), not a slow frame — excluded from fps/frameTimeMs (ch.14 §14.1.1).
        if (delta > 0 && delta <= maxFrameGapMs) {
          frameTimeMs = frameTimeMs === 0 ? delta : frameTimeMs + alpha * (delta - frameTimeMs);
          const instantFps = 1000 / delta;
          fps = fps === 0 ? instantFps : fps + alpha * (instantFps - fps);
        }
      }
      lastFrameStart = frameStart;
    },
    setRendererStats(stats) {
      rendererStats = stats;
    },
    get fps() {
      return fps;
    },
    get frameTimeMs() {
      return frameTimeMs;
    },
    get scriptingTimeMs() {
      return scriptingTimeMs;
    },
    get rendererStats() {
      return rendererStats;
    },
    snapshot(): PerfSnapshot {
      return { fps, frameTimeMs, scriptingTimeMs, rendererStats };
    },
    reset() {
      lastFrameStart = null;
      fps = 0;
      frameTimeMs = 0;
      scriptingTimeMs = 0;
    },
  };
}
