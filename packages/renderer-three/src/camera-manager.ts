// Camera Manager (chapter 02 §2.5) — Three.js implementation of the core's
// CameraPort. Wraps a perspective camera; minimal for P1-T2 (aspect + view).
import * as THREE from 'three';
import type { CameraPort, Vec3 } from '@explorer-engine/core';
import type { ThreeCameraHandle } from './internal/handles';

export interface CameraManager extends CameraPort, ThreeCameraHandle {}

export interface CameraManagerOptions {
  readonly fov?: number;
  readonly near?: number;
  readonly far?: number;
  readonly position?: Vec3;
  readonly target?: Vec3;
}

export function createCameraManager(options: CameraManagerOptions = {}): CameraManager {
  const camera = new THREE.PerspectiveCamera(
    options.fov ?? 50,
    1,
    options.near ?? 0.1,
    options.far ?? 100,
  );

  const position = options.position ?? [3, 2, 4];
  const target = options.target ?? [0, 0, 0];
  camera.position.set(position[0], position[1], position[2]);
  camera.lookAt(target[0], target[1], target[2]);

  return {
    getThreeCamera: () => camera,

    setAspect(aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },

    setView(nextPosition, nextTarget) {
      camera.position.set(nextPosition[0], nextPosition[1], nextPosition[2]);
      camera.lookAt(nextTarget[0], nextTarget[1], nextTarget[2]);
    },

    dispose() {
      // Nothing to release for a plain perspective camera.
    },
  };
}
