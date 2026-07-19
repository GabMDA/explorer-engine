import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCameraManager } from './camera-manager';

describe('CameraManager', () => {
  it('creates a perspective camera at the requested view', () => {
    const manager = createCameraManager({ position: [0, 0, 5], target: [0, 0, 0] });
    const camera = manager.getThreeCamera();
    expect(camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(camera.position.toArray()).toEqual([0, 0, 5]);
  });

  it('setAspect updates the aspect ratio and projection', () => {
    const manager = createCameraManager();
    manager.setAspect(16 / 9);
    const camera = manager.getThreeCamera() as THREE.PerspectiveCamera;
    expect(camera.aspect).toBeCloseTo(16 / 9);
  });

  it('setView repositions the camera', () => {
    const manager = createCameraManager();
    manager.setView([1, 2, 3], [0, 0, 0]);
    expect(manager.getThreeCamera().position.toArray()).toEqual([1, 2, 3]);
  });
});
