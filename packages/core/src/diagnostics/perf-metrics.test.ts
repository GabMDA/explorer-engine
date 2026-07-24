import { describe, it, expect } from 'vitest';
import { createPerfMetrics } from './perf-metrics';

/** A deterministic fake clock: each call to `tick(ms)` advances it, `now()` reads it. */
function fakeClock() {
  let t = 0;
  return {
    now: () => t,
    tick: (ms: number) => {
      t += ms;
    },
  };
}

describe('createPerfMetrics', () => {
  it('starts at zero before any frame', () => {
    const metrics = createPerfMetrics();
    expect(metrics.fps).toBe(0);
    expect(metrics.frameTimeMs).toBe(0);
    expect(metrics.scriptingTimeMs).toBe(0);
    expect(metrics.rendererStats).toBeNull();
  });

  it('computes scripting time from a single begin/end bracket (no smoothing needed on first sample)', () => {
    const clock = fakeClock();
    const metrics = createPerfMetrics({ now: clock.now, smoothing: 1 });
    metrics.beginFrame();
    clock.tick(5);
    metrics.endFrame();
    expect(metrics.scriptingTimeMs).toBeCloseTo(5);
  });

  it('computes fps/frameTimeMs from the delta between consecutive beginFrame calls', () => {
    const clock = fakeClock();
    const metrics = createPerfMetrics({ now: clock.now, smoothing: 1 }); // smoothing=1: no EMA lag, exact reads
    metrics.beginFrame(); // t=0
    metrics.endFrame();
    clock.tick(16); // simulate ~60 FPS spacing
    metrics.beginFrame(); // t=16
    metrics.endFrame();
    expect(metrics.frameTimeMs).toBeCloseTo(16);
    expect(metrics.fps).toBeCloseTo(1000 / 16);
  });

  it('smooths across frames with a partial EMA factor', () => {
    const clock = fakeClock();
    const metrics = createPerfMetrics({ now: clock.now, smoothing: 0.5 });
    // Frame 1: 10ms scripting.
    metrics.beginFrame();
    clock.tick(10);
    metrics.endFrame();
    const firstScripting = metrics.scriptingTimeMs;
    expect(firstScripting).toBeCloseTo(10); // first sample seeds the EMA directly

    // Frame 2: 20ms scripting — EMA moves halfway toward it, never jumps straight there.
    clock.tick(6); // gap before the next frame begins
    metrics.beginFrame();
    clock.tick(20);
    metrics.endFrame();
    expect(metrics.scriptingTimeMs).toBeCloseTo(15); // 10 + 0.5*(20-10)
    expect(metrics.scriptingTimeMs).not.toBeCloseTo(20);
  });

  it('setRendererStats/rendererStats round-trip and degrade gracefully to null', () => {
    const metrics = createPerfMetrics();
    expect(metrics.rendererStats).toBeNull();
    const stats = { drawCalls: 3, triangles: 100, geometries: 2, textures: 1, programs: 1 };
    metrics.setRendererStats(stats);
    expect(metrics.rendererStats).toEqual(stats);
    metrics.setRendererStats(null);
    expect(metrics.rendererStats).toBeNull();
  });

  it('snapshot() returns a single consistent read of every field', () => {
    const clock = fakeClock();
    const metrics = createPerfMetrics({ now: clock.now, smoothing: 1 });
    metrics.beginFrame();
    clock.tick(8);
    metrics.endFrame();
    const stats = { drawCalls: 1, triangles: 10, geometries: 1, textures: 0, programs: null };
    metrics.setRendererStats(stats);
    expect(metrics.snapshot()).toEqual({
      fps: metrics.fps,
      frameTimeMs: metrics.frameTimeMs,
      scriptingTimeMs: metrics.scriptingTimeMs,
      rendererStats: stats,
    });
  });

  it('reset() clears smoothed values but keeps the last renderer stats', () => {
    const clock = fakeClock();
    const metrics = createPerfMetrics({ now: clock.now, smoothing: 1 });
    metrics.beginFrame();
    clock.tick(16);
    metrics.endFrame();
    metrics.setRendererStats({
      drawCalls: 5,
      triangles: 1,
      geometries: 1,
      textures: 1,
      programs: 1,
    });

    metrics.reset();

    expect(metrics.fps).toBe(0);
    expect(metrics.frameTimeMs).toBe(0);
    expect(metrics.scriptingTimeMs).toBe(0);
    expect(metrics.rendererStats).toEqual({
      drawCalls: 5,
      triangles: 1,
      geometries: 1,
      textures: 1,
      programs: 1,
    });
  });

  it('excludes an idle gap (on-demand render loop, L18) from fps/frameTimeMs, keeping scriptingTimeMs valid', () => {
    const clock = fakeClock();
    const metrics = createPerfMetrics({ now: clock.now, smoothing: 1 });
    metrics.beginFrame(); // frame 1 — establishes lastFrameStart only, no fps yet
    clock.tick(5);
    metrics.endFrame();
    clock.tick(16); // frame 2 — a normal ~60 FPS gap, now fps is a real reading
    metrics.beginFrame();
    clock.tick(5);
    metrics.endFrame();
    expect(metrics.fps).toBeGreaterThan(0);
    const fpsBeforeIdle = metrics.fps;
    const frameTimeBeforeIdle = metrics.frameTimeMs;

    // The scene goes static for 3s (on-demand: legitimately no frame rendered),
    // then a single interaction resumes rendering.
    clock.tick(3000);
    metrics.beginFrame();
    clock.tick(6);
    metrics.endFrame();

    expect(metrics.fps).toBe(fpsBeforeIdle); // unchanged — the 3s gap was never a "frame"
    expect(metrics.frameTimeMs).toBe(frameTimeBeforeIdle);
    expect(metrics.scriptingTimeMs).toBeCloseTo(6); // scripting time still reflects real work
  });

  it('respects a custom maxFrameGapMs', () => {
    const clock = fakeClock();
    const metrics = createPerfMetrics({ now: clock.now, smoothing: 1, maxFrameGapMs: 1000 });
    metrics.beginFrame();
    metrics.endFrame();
    clock.tick(500); // within the custom (higher) gap tolerance
    metrics.beginFrame();
    metrics.endFrame();
    expect(metrics.frameTimeMs).toBeCloseTo(500);
  });

  it('ignores a non-positive delta between beginFrame calls (clock going backwards)', () => {
    const clock = fakeClock();
    const metrics = createPerfMetrics({ now: clock.now, smoothing: 1 });
    metrics.beginFrame();
    metrics.endFrame();
    clock.tick(-1); // pathological, but must never divide-by-zero/negative into fps
    metrics.beginFrame();
    metrics.endFrame();
    expect(Number.isFinite(metrics.fps)).toBe(true);
    expect(metrics.fps).toBe(0); // unchanged: the non-positive delta was skipped
  });
});
