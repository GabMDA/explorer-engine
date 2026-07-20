import { describe, it, expect, vi } from 'vitest';
import { createAnimationEngine } from './engine';
import { numberTween } from './tween';

describe('createAnimationEngine', () => {
  it('advances a tween deterministically with injected time and fires lifecycle events', () => {
    const requestRender = vi.fn();
    const engine = createAnimationEngine({ requestRender, maxDeltaMs: 1e9 });
    const values: number[] = [];
    const onStart = vi.fn();
    const onComplete = vi.fn();
    engine.play(
      numberTween({ from: 0, to: 100, duration: 1000, onUpdate: (v) => values.push(v) }),
      {
        onStart,
        onComplete,
      },
    );
    expect(onStart).toHaveBeenCalledOnce();
    expect(requestRender).toHaveBeenCalled();
    expect(engine.hasActive).toBe(true);

    engine.update(0); // baseline (no delta)
    engine.update(500); // → 50
    engine.update(1000); // → 100, complete
    expect(values.at(-1)).toBe(100);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(engine.hasActive).toBe(false); // frame ownership released
  });

  it('is FPS-independent: many small steps == one big step', () => {
    const run = (steps: number[]) => {
      const engine = createAnimationEngine({ maxDeltaMs: 1e9 });
      let v = 0;
      engine.play(numberTween({ from: 0, to: 1000, duration: 1000, onUpdate: (x) => (v = x) }));
      let t = 0;
      engine.update(0);
      for (const s of steps) {
        t += s;
        engine.update(t);
      }
      return v;
    };
    // Same total elapsed (1000ms), different step granularity → same result.
    expect(run([500, 500])).toBeCloseTo(run([200, 200, 200, 200, 200]), 6);
  });

  it('pauses and resumes without losing progress', () => {
    const engine = createAnimationEngine({ maxDeltaMs: 1e9 });
    let v = 0;
    const h = engine.play(
      numberTween({ from: 0, to: 100, duration: 1000, onUpdate: (x) => (v = x) }),
    );
    engine.update(0);
    engine.update(500); // v = 50
    h.pause();
    engine.update(1500); // paused → ignored
    expect(v).toBe(50);
    expect(h.state).toBe('paused');
    h.resume();
    engine.update(2000); // delta 500 since last update → 50 + 50 = 100
    expect(v).toBe(100);
  });

  it('cancels in place without firing complete', () => {
    const engine = createAnimationEngine({ maxDeltaMs: 1e9 });
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    let v = 0;
    const h = engine.play(
      numberTween({ from: 0, to: 100, duration: 1000, onUpdate: (x) => (v = x) }),
      { onComplete, onCancel },
    );
    engine.update(0);
    engine.update(300); // v = 30
    h.cancel();
    expect(h.state).toBe('cancelled');
    expect(v).toBe(30); // stays in place
    engine.update(1000);
    expect(v).toBe(30);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(engine.hasActive).toBe(false);
  });

  it('supports clean replacement (cancel old, play new)', () => {
    const engine = createAnimationEngine({ maxDeltaMs: 1e9 });
    let v = 0;
    const first = engine.play(
      numberTween({ from: 0, to: 100, duration: 1000, onUpdate: (x) => (v = x) }),
    );
    engine.update(0);
    engine.update(500); // v = 50
    first.cancel();
    engine.play(numberTween({ from: v, to: 0, duration: 500, onUpdate: (x) => (v = x) }));
    engine.update(500); // baseline for new playback timing already set; delta 0 vs last update(500)
    engine.update(1000); // delta 500 → done → 0
    expect(v).toBe(0);
    expect(engine.activeCount).toBe(0);
  });

  it('completes instantly under reduced motion (no frames needed)', () => {
    const engine = createAnimationEngine({ reducedMotion: true });
    let v = 0;
    const onComplete = vi.fn();
    engine.play(numberTween({ from: 0, to: 42, duration: 1000, onUpdate: (x) => (v = x) }), {
      onComplete,
    });
    expect(v).toBe(42);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(engine.hasActive).toBe(false); // never needed the loop
  });

  it('clamps a huge delta (background-tab guard)', () => {
    const engine = createAnimationEngine({ maxDeltaMs: 100 });
    let v = 0;
    engine.play(numberTween({ from: 0, to: 1000, duration: 1000, onUpdate: (x) => (v = x) }));
    engine.update(0);
    engine.update(100000); // clamped to 100ms → 10% progress
    expect(v).toBe(100);
  });

  it('cancelAll and dispose stop everything', () => {
    const engine = createAnimationEngine({ maxDeltaMs: 1e9 });
    engine.play(numberTween({ from: 0, to: 1, duration: 1000, onUpdate: () => {} }));
    engine.play(numberTween({ from: 0, to: 1, duration: 1000, onUpdate: () => {} }));
    expect(engine.activeCount).toBe(2);
    engine.cancelAll();
    expect(engine.activeCount).toBe(0);
    engine.dispose();
    const h = engine.play(numberTween({ from: 0, to: 1, duration: 1000, onUpdate: () => {} }));
    expect(h.state).toBe('cancelled'); // play after dispose is inert
    expect(engine.update(5000)).toBe(0);
  });
});
