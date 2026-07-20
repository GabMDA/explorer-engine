import { describe, it, expect } from 'vitest';
import { createTween, numberTween, vec3Tween } from './tween';
import { createTimeline, sequence, parallel } from './timeline';

describe('createTween / numberTween', () => {
  it('interpolates linearly over the duration (seek is deterministic)', () => {
    const seen: number[] = [];
    const tw = numberTween({ from: 0, to: 100, duration: 1000, onUpdate: (v) => seen.push(v) });
    expect(tw.duration).toBe(1000);
    tw.seek(0);
    tw.seek(250);
    tw.seek(500);
    tw.seek(1000);
    expect(seen).toEqual([0, 25, 50, 100]);
  });

  it('holds at `from` during the delay, then runs', () => {
    const seen: number[] = [];
    const tw = numberTween({
      from: 10,
      to: 20,
      duration: 100,
      delay: 50,
      onUpdate: (v) => seen.push(v),
    });
    expect(tw.duration).toBe(150); // delay + duration
    tw.seek(0);
    tw.seek(50);
    tw.seek(100);
    tw.seek(150);
    expect(seen).toEqual([10, 10, 15, 20]);
  });

  it('applies easing to progress', () => {
    let value = 0;
    const tw = numberTween({
      from: 0,
      to: 1,
      duration: 100,
      easing: 'easeIn',
      onUpdate: (v) => (value = v),
    });
    tw.seek(50); // easeIn(0.5) = 0.25
    expect(value).toBeCloseTo(0.25, 6);
  });

  it('clamps progress beyond the duration', () => {
    let value = 0;
    const tw = numberTween({ from: 0, to: 10, duration: 100, onUpdate: (v) => (value = v) });
    tw.seek(999);
    expect(value).toBe(10);
  });

  it('vec3Tween interpolates each component', () => {
    let v: [number, number, number] = [0, 0, 0];
    const tw = vec3Tween({
      from: [0, 0, 0],
      to: [10, 20, 30],
      duration: 100,
      onUpdate: (x) => (v = x),
    });
    tw.seek(50);
    expect(v).toEqual([5, 10, 15]);
  });

  it('supports a generic interpolator (compound value)', () => {
    let pose = { x: 0, y: 0 };
    const tw = createTween<{ x: number; y: number }>({
      from: { x: 0, y: 0 },
      to: { x: 10, y: 100 },
      duration: 100,
      interpolate: (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }),
      onUpdate: (p) => (pose = p),
    });
    tw.seek(50);
    expect(pose).toEqual({ x: 5, y: 50 });
  });
});

describe('timeline', () => {
  it('computes duration as the furthest child end', () => {
    const a = numberTween({ from: 0, to: 1, duration: 100, onUpdate: () => {} });
    const b = numberTween({ from: 0, to: 1, duration: 100, onUpdate: () => {} });
    const tl = createTimeline([
      { at: 0, animation: a },
      { at: 500, animation: b },
    ]);
    expect(tl.duration).toBe(600);
  });

  it('runs children in parallel', () => {
    let x = 0;
    let y = 0;
    const tl = parallel([
      numberTween({ from: 0, to: 10, duration: 100, onUpdate: (v) => (x = v) }),
      numberTween({ from: 0, to: 20, duration: 100, onUpdate: (v) => (y = v) }),
    ]);
    tl.seek(50);
    expect(x).toBe(5);
    expect(y).toBe(10);
  });

  it('sequences children back-to-back and never lets a later child overwrite an earlier one early', () => {
    const order: string[] = [];
    let value = -1;
    const tl = sequence([
      numberTween({
        from: 0,
        to: 10,
        duration: 100,
        onUpdate: (v) => {
          value = v;
          order.push('a');
        },
      }),
      numberTween({
        from: 100,
        to: 200,
        duration: 100,
        onUpdate: (v) => {
          value = v;
          order.push('b');
        },
      }),
    ]);
    expect(tl.duration).toBe(200);
    tl.seek(50); // only 'a' has started
    expect(value).toBe(5);
    expect(order.includes('b')).toBe(false);
    tl.seek(150); // 'a' done (holds at 10), 'b' running; array order → b applied last
    expect(value).toBe(150);
  });

  it('honours offsets', () => {
    let v = -1;
    const tl = createTimeline([
      {
        at: 200,
        animation: numberTween({ from: 0, to: 100, duration: 100, onUpdate: (x) => (v = x) }),
      },
    ]);
    tl.seek(100); // before start → not applied
    expect(v).toBe(-1);
    tl.seek(250); // 50ms into the child
    expect(v).toBe(50);
  });
});
