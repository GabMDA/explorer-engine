// Lighting Manager (chapter 02 §2.7) — Three.js implementation of the core's
// LightingPort. Turns a data-only LightingPreset into real Three.js lights, adds
// them to the scene, and owns their lifecycle so applying a new preset or
// disposing never leaks (removes + disposes the previous lights first).
//
// Per correction C6 it does NOT reference the Environment Manager: it only reads
// the preset data and mutates the shared scene graph.
import * as THREE from 'three';
import type { LightingPort, LightingPreset, LightSpec } from '@explorer-engine/core';
import type { ThreeSceneHandle } from './internal/handles';

function buildLight(spec: LightSpec): THREE.Light {
  switch (spec.kind) {
    case 'ambient':
      return new THREE.AmbientLight(spec.color ?? 0xffffff, spec.intensity ?? 1);
    case 'hemisphere':
      return new THREE.HemisphereLight(
        spec.skyColor ?? 0xffffff,
        spec.groundColor ?? 0x000000,
        spec.intensity ?? 1,
      );
    case 'directional': {
      const light = new THREE.DirectionalLight(spec.color ?? 0xffffff, spec.intensity ?? 1);
      const [x, y, z] = spec.position ?? [0, 1, 0];
      light.position.set(x, y, z);
      return light;
    }
    case 'point': {
      const light = new THREE.PointLight(
        spec.color ?? 0xffffff,
        spec.intensity ?? 1,
        spec.distance ?? 0,
        spec.decay ?? 2,
      );
      const [x, y, z] = spec.position ?? [0, 0, 0];
      light.position.set(x, y, z);
      return light;
    }
  }
}

function disposeLight(light: THREE.Light): void {
  // Discrete lights hold no geometry/material; only shadow maps allocate GPU
  // resources. Light.dispose() releases them when present.
  light.dispose();
}

export interface LightingManager extends LightingPort {
  /** Id of the currently applied preset, or `null` before any apply / after dispose. */
  readonly current: string | null;
}

export function createLightingManager(scene: ThreeSceneHandle): LightingManager {
  const root = scene.getThreeScene();
  let lights: THREE.Light[] = [];
  let currentId: string | null = null;

  const clear = () => {
    for (const light of lights) {
      root.remove(light);
      disposeLight(light);
    }
    lights = [];
  };

  return {
    get current() {
      return currentId;
    },
    apply(preset: LightingPreset) {
      clear();
      lights = preset.lights.map(buildLight);
      for (const light of lights) root.add(light);
      currentId = preset.id;
    },
    dispose() {
      clear();
      currentId = null;
    },
  };
}
