// Scene Manager (chapter 02 §2.4) — Three.js implementation of the core's
// ScenePort. Owns the root scene graph, tracks disposable resources, exposes the
// bounding box, and provides a simple in-code demo scene for P1-T2.
import * as THREE from 'three';
import type { ScenePort, BoundingBox } from '@explorer-engine/core';
import type { ThreeSceneHandle } from './internal/handles';
import type { NodeIndex } from './node-index';

export interface SceneManager extends ScenePort, ThreeSceneHandle {
  /** Add an object to the root scene. */
  add(object: THREE.Object3D): void;
  /** Remove an object from the root scene. */
  remove(object: THREE.Object3D): void;
  /** The node index of the currently loaded model, or null (P2-T4). */
  getNodeIndex(): NodeIndex | null;
  /** Set (or clear) the node index. Called by the Model Loader after insertion. */
  setNodeIndex(index: NodeIndex | null): void;
}

function toTuple(v: THREE.Vector3): [number, number, number] {
  return [v.x, v.y, v.z];
}

export function createSceneManager(): SceneManager {
  const scene = new THREE.Scene();
  let nodeIndex: NodeIndex | null = null;
  let disposed = false;

  return {
    getThreeScene: () => scene,

    add(object) {
      scene.add(object);
    },

    remove(object) {
      scene.remove(object);
    },

    getNodeIndex: () => nodeIndex,
    setNodeIndex(index) {
      nodeIndex = index;
    },

    getBoundingBox(): BoundingBox | null {
      const box = new THREE.Box3().setFromObject(scene);
      if (box.isEmpty()) return null;
      return { min: toTuple(box.min), max: toTuple(box.max) };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      nodeIndex = null;
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

export interface DemoSceneOptions {
  /**
   * Include the built-in demo lights. Default `true` (P1-T2/T3 self-contained
   * scene). Pass `false` when a Lighting Manager owns the lighting (P1-T4).
   */
  readonly includeLights?: boolean;
}

/**
 * Build a minimal, self-contained demo scene: a single unit cube created in code
 * with no external asset. By default it is self-lit (P1-T2/T3). With
 * `includeLights: false` it ships only the object, leaving lighting/environment
 * to the Lighting and Environment Managers (P1-T4).
 */
export function createDemoScene(options: DemoSceneOptions = {}): SceneManager {
  const manager = createSceneManager();

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x3ba7ff, roughness: 0.45, metalness: 0.1 }),
  );
  manager.add(cube);

  if (options.includeLights ?? true) {
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(3, 4, 5);
    manager.add(keyLight);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x223344, 0.6);
    manager.add(ambient);
  }

  return manager;
}
