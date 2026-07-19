// Package-internal bridge between the core's backend-agnostic ports and the
// underlying Three.js objects. NOT part of the public API. Only other modules of
// renderer-three (the renderer) use these to obtain the concrete THREE instances
// from a ScenePort / CameraPort produced by this same package.
import type * as THREE from 'three';

export interface ThreeSceneHandle {
  /** The underlying Three.js scene. */
  getThreeScene(): THREE.Scene;
}

export interface ThreeCameraHandle {
  /** The underlying Three.js camera. */
  getThreeCamera(): THREE.Camera;
}

export interface ThreeRendererHandle {
  /** The underlying Three.js WebGL renderer (needed for PMREM env-map baking). */
  getThreeRenderer(): THREE.WebGLRenderer;
}
