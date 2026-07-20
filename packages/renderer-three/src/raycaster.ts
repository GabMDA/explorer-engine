// Raycaster adapter (chapter 08 §8.2.1, roadmap P4-T1) — the Three.js side of the
// core RaycasterPort. It casts a ray from the camera through a screen point, finds
// the nearest VISIBLE hit, walks up to the nearest addressable ancestor and returns
// its stable identity (explorerId preferred, name fallback) plus the world point.
// The core receives identity + point only — never an Object3D (L8/L9).
import * as THREE from 'three';
import type { RaycasterPort, PickHit } from '@explorer-engine/core';
import type { SceneManager } from './scene-manager';
import type { CameraManager } from './camera-manager';

export interface RaycasterAdapterOptions {
  readonly scene: SceneManager;
  readonly camera: CameraManager;
}

/** Stable identity of the nearest addressable ancestor, or null. */
function identityOf(object: THREE.Object3D): string | null {
  let node: THREE.Object3D | null = object;
  while (node) {
    const raw = (node.userData as { explorerId?: unknown }).explorerId;
    if (typeof raw === 'string' && raw.length > 0) return raw;
    if (node.name.length > 0) return node.name;
    node = node.parent;
  }
  return null;
}

/** True when the object and all its ancestors are visible. */
function isVisibleChain(object: THREE.Object3D): boolean {
  let node: THREE.Object3D | null = object;
  while (node) {
    if (!node.visible) return false;
    node = node.parent;
  }
  return true;
}

export function createRaycasterAdapter(options: RaycasterAdapterOptions): RaycasterPort {
  const { scene, camera } = options;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  return {
    pick(ndcX: number, ndcY: number): PickHit | null {
      const cam = camera.getThreeCamera();
      const root = scene.getThreeScene();
      // Picking is a discrete user action; make sure world matrices are current so
      // it never depends on a render having just run (cheap — cached when clean).
      cam.updateMatrixWorld();
      root.updateMatrixWorld();
      pointer.set(ndcX, ndcY);
      raycaster.setFromCamera(pointer, cam);
      const hits = raycaster.intersectObjects(root.children, true);
      for (const hit of hits) {
        if (!isVisibleChain(hit.object)) continue; // ignore RSR-hidden geometry
        const identity = identityOf(hit.object);
        if (identity === null) continue;
        return {
          identity,
          point: [hit.point.x, hit.point.y, hit.point.z],
          distance: hit.distance,
        };
      }
      return null;
    },
  };
}
