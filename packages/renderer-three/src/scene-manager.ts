// Scene Manager (chapter 02 §2.4) — Three.js implementation of the core's
// ScenePort. Owns the root scene graph, tracks disposable resources, exposes the
// bounding box, and provides a simple in-code demo scene for P1-T2.
import * as THREE from 'three';
import type { ScenePort, BoundingBox } from '@explorer-engine/core';
import type { ThreeSceneHandle } from './internal/handles';

export interface SceneManager extends ScenePort, ThreeSceneHandle {
  /** Add an object to the root scene. */
  add(object: THREE.Object3D): void;
  /** Remove an object from the root scene. */
  remove(object: THREE.Object3D): void;
}

function toTuple(v: THREE.Vector3): [number, number, number] {
  return [v.x, v.y, v.z];
}

export function createSceneManager(): SceneManager {
  const scene = new THREE.Scene();
  let disposed = false;

  return {
    getThreeScene: () => scene,

    add(object) {
      scene.add(object);
    },

    remove(object) {
      scene.remove(object);
    },

    getBoundingBox(): BoundingBox | null {
      const box = new THREE.Box3().setFromObject(scene);
      if (box.isEmpty()) return null;
      return { min: toTuple(box.min), max: toTuple(box.max) };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      scene.traverse((object) => {
        const mesh = object as Partial<THREE.Mesh>;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) {
          for (const m of material) m.dispose();
        } else {
          material?.dispose();
        }
      });
      scene.clear();
    },
  };
}

/**
 * Build a minimal, self-contained demo scene (P1-T2): a single lit unit cube,
 * created in code with no external asset. Used for the first real visual check.
 */
export function createDemoScene(): SceneManager {
  const manager = createSceneManager();

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x3ba7ff, roughness: 0.45, metalness: 0.1 }),
  );
  manager.add(cube);

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
  keyLight.position.set(3, 4, 5);
  manager.add(keyLight);

  const ambient = new THREE.HemisphereLight(0xffffff, 0x223344, 0.6);
  manager.add(ambient);

  return manager;
}
