// Bounds provider adapter (chapter 08 §8.3) — the Three.js side of the core
// BoundsProvider. It resolves a typed Address to the world-space AABB of its nodes
// via the component model (identities) + node index (objects), and returns a
// data-only BoundingBox. The Focus Manager does the framing math headlessly; only
// numbers cross the boundary (L8/L9). Three.js stays confined here (L9).
import * as THREE from 'three';
import type { Address, BoundingBox, BoundsProvider, ComponentModel } from '@explorer-engine/core';
import type { SceneManager } from './scene-manager';

export interface BoundsProviderOptions {
  readonly scene: SceneManager;
  readonly components: ComponentModel;
}

const _box = new THREE.Box3();
const _min = new THREE.Vector3();
const _max = new THREE.Vector3();

export function createBoundsProvider(options: BoundsProviderOptions): BoundsProvider {
  const { scene, components } = options;
  return {
    boundsOf(address: Address): BoundingBox | null {
      const index = scene.getNodeIndex();
      if (!index) return null;
      scene.getThreeScene().updateMatrixWorld();
      _box.makeEmpty();
      let any = false;
      for (const identity of components.expand(address)) {
        for (const object of index.resolve(identity)) {
          _box.expandByObject(object);
          any = true;
        }
      }
      if (!any || _box.isEmpty()) return null;
      _min.copy(_box.min);
      _max.copy(_box.max);
      return { min: [_min.x, _min.y, _min.z], max: [_max.x, _max.y, _max.z] };
    },
  };
}
