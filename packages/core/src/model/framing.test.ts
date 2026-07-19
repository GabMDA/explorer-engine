import { describe, it, expect } from 'vitest';
import { computeCameraFraming } from './framing';
import type { BoundingBox } from '../ports/scene-port';

const box = (min: [number, number, number], max: [number, number, number]): BoundingBox => ({
  min,
  max,
});
const finite = (...ns: number[]) => ns.every((n) => Number.isFinite(n));

describe('computeCameraFraming', () => {
  it('frames a centred unit cube: target at origin, camera pulled back, finite values', () => {
    const r = computeCameraFraming(box([-1, -1, -1], [1, 1, 1]), { fovYRadians: Math.PI / 4 });
    expect(r.target).toEqual([0, 0, 0]);
    expect(r.distance).toBeGreaterThan(r.radius);
    expect(finite(...r.position, r.distance, r.radius, r.near, r.far)).toBe(true);
    // camera sits away from the target
    expect(Math.hypot(...r.position)).toBeCloseTo(r.distance, 5);
  });

  it('targets the centre of an off-centre box', () => {
    const r = computeCameraFraming(box([10, 10, 10], [12, 14, 16]), { fovYRadians: Math.PI / 4 });
    expect(r.target).toEqual([11, 12, 13]);
  });

  it('a narrower (portrait) aspect pushes the camera further than a wide one', () => {
    const b = box([-1, -1, -1], [1, 1, 1]);
    const wide = computeCameraFraming(b, { fovYRadians: Math.PI / 4, aspect: 2 });
    const tall = computeCameraFraming(b, { fovYRadians: Math.PI / 4, aspect: 0.5 });
    expect(tall.distance).toBeGreaterThan(wide.distance);
  });

  it('a larger FOV lets the camera sit closer', () => {
    const b = box([-1, -1, -1], [1, 1, 1]);
    const narrow = computeCameraFraming(b, { fovYRadians: Math.PI / 6 });
    const wide = computeCameraFraming(b, { fovYRadians: Math.PI / 2 });
    expect(wide.distance).toBeLessThan(narrow.distance);
  });

  it('handles a degenerate (zero-size) box with a unit fallback and safe values', () => {
    const r = computeCameraFraming(box([5, 5, 5], [5, 5, 5]), { fovYRadians: Math.PI / 4 });
    expect(r.radius).toBe(1);
    expect(r.target).toEqual([5, 5, 5]);
    expect(finite(...r.position, r.distance, r.near, r.far)).toBe(true);
    expect(r.near).toBeGreaterThan(0);
    expect(r.far).toBeGreaterThan(r.near);
  });

  it('applies a margin so the camera is farther than a tight fit', () => {
    const b = box([-1, -1, -1], [1, 1, 1]);
    const tight = computeCameraFraming(b, { fovYRadians: Math.PI / 4, margin: 1 });
    const loose = computeCameraFraming(b, { fovYRadians: Math.PI / 4, margin: 1.5 });
    expect(loose.distance).toBeGreaterThan(tight.distance);
  });
});
