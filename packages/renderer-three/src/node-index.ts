// Node index (chapter 06 §6.3, roadmap P2-T4) — the "stable identity → 3D object"
// backbone of hotspots/focus/selection/states. Built by traversing a loaded model:
// primary key is `extras.explorerId` (survives re-export/compression, ADR-003 / L12),
// fallback is the glTF node name (fragile). Collisions (homonyms / repeated ids) are
// tolerated by indexing in LISTS. The Object3D VALUES stay in this adapter (L9); only
// data-only NodeDescriptors are surfaced to the Core.
import * as THREE from 'three';
import type { NodeDescriptor } from '@explorer-engine/core';

export interface NodeIndex {
  /** All objects carrying `extras.explorerId === id` (homonyms → several). */
  byExplorerId(id: string): readonly THREE.Object3D[];
  /** All objects whose glTF node name === name (homonyms → several). */
  byName(name: string): readonly THREE.Object3D[];
  /** Resolve by identity: explorerId first, then name. Empty if unknown. */
  resolve(identity: string): readonly THREE.Object3D[];
  /** Data-only identities of every indexed node. */
  descriptors(): readonly NodeDescriptor[];
  /** Number of indexed nodes (objects with an explorerId and/or a name). */
  readonly size: number;
}

const EMPTY: readonly THREE.Object3D[] = Object.freeze([]);

function push(map: Map<string, THREE.Object3D[]>, key: string, obj: THREE.Object3D): void {
  const list = map.get(key);
  if (list) list.push(obj);
  else map.set(key, [obj]);
}

export function createNodeIndex(root: THREE.Object3D): NodeIndex {
  const byId = new Map<string, THREE.Object3D[]>();
  const byNm = new Map<string, THREE.Object3D[]>();
  const descriptors: NodeDescriptor[] = [];
  let size = 0;

  root.traverse((obj) => {
    const rawId = (obj.userData as { explorerId?: unknown } | undefined)?.explorerId;
    const explorerId = typeof rawId === 'string' && rawId.length > 0 ? rawId : undefined;
    const name = obj.name.length > 0 ? obj.name : undefined;
    if (explorerId === undefined && name === undefined) return;
    if (explorerId !== undefined) push(byId, explorerId, obj);
    if (name !== undefined) push(byNm, name, obj);
    descriptors.push({
      ...(explorerId !== undefined ? { explorerId } : {}),
      ...(name !== undefined ? { name } : {}),
    });
    size += 1;
  });

  return {
    byExplorerId: (id) => byId.get(id) ?? EMPTY,
    byName: (name) => byNm.get(name) ?? EMPTY,
    resolve: (identity) => byId.get(identity) ?? byNm.get(identity) ?? EMPTY,
    descriptors: () => descriptors,
    get size() {
      return size;
    },
  };
}
