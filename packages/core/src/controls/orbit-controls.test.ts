import { describe, it, expect, vi } from 'vitest';
import { createOrbitControls } from './orbit-controls';
import type { CameraPort, Vec3 } from '../ports/camera-port';

function fakeCamera() {
  const views: { position: Vec3; target: Vec3 }[] = [];
  const port: CameraPort = {
    setAspect: () => {},
    setView: (position, target) => views.push({ position, target }),
    dispose: () => {},
  };
  return { port, views };
}

function last(views: { position: Vec3; target: Vec3 }[]): { position: Vec3; target: Vec3 } {
  const value = views[views.length - 1];
  if (value === undefined) throw new Error('no view recorded');
  return value;
}
const distance = (p: Vec3, t: Vec3) => Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]);

describe('createOrbitControls', () => {
  it('starts at the configured view (no drift before input)', () => {
    const { port, views } = fakeCamera();
    const controls = createOrbitControls(port, {
      position: [0, 0, 5],
      target: [0, 0, 0],
      dampingFactor: 1,
    });
    const moving = controls.update();
    expect(moving).toBe(false);
    const { position } = last(views);
    expect(position[0]).toBeCloseTo(0);
    expect(position[1]).toBeCloseTo(0);
    expect(position[2]).toBeCloseTo(5);
  });

  it('orbit rotates the camera around the target (distance preserved)', () => {
    const { port, views } = fakeCamera();
    const controls = createOrbitControls(port, {
      position: [0, 0, 5],
      target: [0, 0, 0],
      dampingFactor: 1,
      rotateSpeed: 0.01,
    });
    controls.orbit(100, 0); // horizontal drag → azimuth change
    controls.update();
    const { position } = last(views);
    expect(position[0]).not.toBeCloseTo(0); // moved off the +Z axis
    expect(distance(position, [0, 0, 0])).toBeCloseTo(5); // radius unchanged
  });

  it('zoom changes distance and respects min/max limits', () => {
    const { port, views } = fakeCamera();
    const controls = createOrbitControls(port, {
      position: [0, 0, 5],
      target: [0, 0, 0],
      dampingFactor: 1,
      minDistance: 2,
      maxDistance: 8,
      zoomSpeed: 0.5,
    });
    controls.zoom(20); // zoom way in → clamps to minDistance
    controls.update();
    expect(distance(last(views).position, [0, 0, 0])).toBeCloseTo(2);

    controls.zoom(-40); // zoom way out → clamps to maxDistance
    controls.update();
    expect(distance(last(views).position, [0, 0, 0])).toBeCloseTo(8);
  });

  it('polar limits prevent flipping over the pole', () => {
    const { port, views } = fakeCamera();
    const controls = createOrbitControls(port, {
      position: [0, 0, 5],
      target: [0, 0, 0],
      dampingFactor: 1,
      minPolarAngle: 0.2,
      maxPolarAngle: Math.PI - 0.2,
      rotateSpeed: 0.01,
    });
    controls.orbit(0, 100000); // huge vertical drag
    controls.update();
    const { position } = last(views);
    // clamped near the max polar angle → y stays below the top pole
    expect(position[1]).toBeLessThan(5);
  });

  it('pan moves the look-at target', () => {
    const { port, views } = fakeCamera();
    const controls = createOrbitControls(port, {
      position: [0, 0, 5],
      target: [0, 0, 0],
      dampingFactor: 1,
      panSpeed: 0.01,
    });
    controls.pan(100, 0);
    controls.update();
    const { target } = last(views);
    expect(target[0] !== 0 || target[1] !== 0).toBe(true);
  });

  it('applies damping over multiple updates then settles', () => {
    const { port } = fakeCamera();
    const controls = createOrbitControls(port, {
      position: [0, 0, 5],
      target: [0, 0, 0],
      dampingFactor: 0.5,
      rotateSpeed: 0.01,
    });
    controls.orbit(200, 0);
    expect(controls.update()).toBe(true); // still easing toward goal
    let guard = 0;
    while (controls.update() && guard < 1000) guard += 1;
    expect(controls.update()).toBe(false); // settled
  });

  it('notifies onChange for input and stops after dispose', () => {
    const { port } = fakeCamera();
    const controls = createOrbitControls(port, { dampingFactor: 1 });
    const onChange = vi.fn();
    const unsubscribe = controls.onChange(onChange);
    controls.orbit(10, 0);
    controls.zoom(1);
    controls.pan(5, 5);
    expect(onChange).toHaveBeenCalledTimes(3);

    unsubscribe();
    controls.orbit(10, 0);
    expect(onChange).toHaveBeenCalledTimes(3);

    controls.dispose();
    expect(controls.update()).toBe(false);
  });

  it('setView re-targets without an easing jump and notifies onChange', () => {
    const { port, views } = fakeCamera();
    const controls = createOrbitControls(port, {
      position: [0, 0, 5],
      target: [0, 0, 0],
      dampingFactor: 0.2, // damped: proves setView snaps (no easing) despite low factor
      minDistance: 1,
      maxDistance: 100,
    });
    const onChange = vi.fn();
    controls.onChange(onChange);

    controls.setView([11, 12, 16], [11, 12, 13]); // frame an off-centre model
    expect(onChange).toHaveBeenCalledTimes(1);

    // First update writes the new pose immediately (no jump) and settles at once.
    const moving = controls.update();
    const view = last(views);
    expect(view.target[0]).toBeCloseTo(11);
    expect(view.target[1]).toBeCloseTo(12);
    expect(view.target[2]).toBeCloseTo(13);
    expect(distance(view.position, [11, 12, 13])).toBeCloseTo(3); // radius = |pos-target|
    expect(moving).toBe(false); // current == goal → no residual motion / first-interaction jump
  });

  it('respects enableRotate / enableZoom / enablePan flags', () => {
    const { port, views } = fakeCamera();
    const controls = createOrbitControls(port, {
      position: [0, 0, 5],
      dampingFactor: 1,
      enableRotate: false,
      enableZoom: false,
      enablePan: false,
    });
    controls.orbit(100, 100);
    controls.zoom(10);
    controls.pan(50, 50);
    controls.update();
    const { position, target } = last(views);
    expect(position[2]).toBeCloseTo(5);
    expect(target).toEqual([0, 0, 0]);
  });
});
