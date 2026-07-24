// Instancing (roadmap P9-T1 ; chapter 14 §14.3.1) — merges structurally-identical
// repeated geometry into a single THREE.InstancedMesh, cutting N draw calls to 1.
//
// Detection is STRUCTURAL, not name-based: GLTFLoader shares the same
// THREE.BufferGeometry/Material OBJECT REFERENCE across every node that points
// at the same glTF mesh (verified empirically — a glTF "mesh" is parsed once and
// reused per referencing node). Grouping by that reference identity is therefore
// a byte-for-byte-safe merge: it can never fuse two nodes whose geometry merely
// LOOKS similar, only ones that are, in fact, the exact same draw data.
//
// A node carrying `extras.explorerId` is excluded from merging — an explorerId
// marks it as individually addressable (chapter 06 §6.3, ENGINE_CONSTITUTION
// L12), and instancing must never remove an address a package might reference
// via components/hotspots/states (L5). Only anonymous, purely decorative
// repeats (rivets, LEDs, radiator fins…) are eligible — exactly ch.14 §14.3.1's
// use case.
import * as THREE from 'three';
import type { InstancingConfig } from '@explorer-engine/core';

export interface InstancingResult {
  /** Number of InstancedMesh groups created. */
  readonly groups: number;
  /** Total individual nodes folded into those groups. */
  readonly nodesMerged: number;
}

const NO_MERGE: InstancingResult = { groups: 0, nodesMerged: 0 };

function explorerIdOf(mesh: THREE.Object3D): string | undefined {
  const id = (mesh.userData as { explorerId?: unknown }).explorerId;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

/**
 * Merge eligible repeated meshes under `root` into InstancedMeshes, in place.
 * `root` MUST have an identity world transform (true for a freshly-inserted
 * glTF scene root) — each instance's local matrix is set from its ORIGINAL
 * world matrix, so the new InstancedMesh (added as a direct child of `root`)
 * renders every instance at its original position.
 */
export function applyInstancing(root: THREE.Object3D, config: InstancingConfig): InstancingResult {
  if (!config.enabled) return NO_MERGE;
  const minCount = Math.max(2, config.minCount);

  const groups = new Map<
    THREE.BufferGeometry,
    Map<THREE.Material | THREE.Material[], THREE.Mesh[]>
  >();
  root.traverse((obj) => {
    if (!(obj as Partial<THREE.Mesh>).isMesh) return;
    if ((obj as Partial<THREE.InstancedMesh>).isInstancedMesh) return; // already instanced
    const mesh = obj as THREE.Mesh;
    if (explorerIdOf(mesh) !== undefined) return; // individually addressable — never merged

    let byMaterial = groups.get(mesh.geometry);
    if (!byMaterial) {
      byMaterial = new Map();
      groups.set(mesh.geometry, byMaterial);
    }
    const list = byMaterial.get(mesh.material);
    if (list) list.push(mesh);
    else byMaterial.set(mesh.material, [mesh]);
  });

  let mergedGroups = 0;
  let nodesMerged = 0;

  for (const byMaterial of groups.values()) {
    for (const [material, meshes] of byMaterial) {
      if (meshes.length < minCount) continue;

      const instanced = new THREE.InstancedMesh(meshes[0]!.geometry, material, meshes.length);
      // Deliberately unnamed: the merged group is exactly the non-addressable
      // case (no member had an explorerId) — giving it a name would make the
      // node index (ch.06 §6.3) pick it up as a new, meaningless identity.
      meshes.forEach((mesh, i) => {
        mesh.updateWorldMatrix(true, false);
        instanced.setMatrixAt(i, mesh.matrixWorld);
        mesh.parent?.remove(mesh); // detach only — geometry/material stay shared, live on in `instanced`
      });
      instanced.instanceMatrix.needsUpdate = true;
      root.add(instanced);

      mergedGroups += 1;
      nodesMerged += meshes.length;
    }
  }

  return mergedGroups > 0 ? { groups: mergedGroups, nodesMerged } : NO_MERGE;
}
