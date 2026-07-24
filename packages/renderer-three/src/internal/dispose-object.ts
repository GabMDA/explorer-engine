// Shared Object3D disposal (roadmap P9-T4, ENGINE_CONSTITUTION L20 — no leak).
// The one place that walks a subtree and releases every GPU resource it owns:
// geometries, materials (and any texture referenced by a material property),
// and — the part easy to miss — an InstancedMesh's own `dispose()`, which
// releases its instance-matrix/instance-color buffers. Those buffers are NOT
// owned by the geometry, so skipping this step leaks GPU memory on every
// model replacement that used instancing (P9-T1).
import * as THREE from 'three';

function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (value && typeof value === 'object' && (value as THREE.Texture).isTexture === true) {
      (value as THREE.Texture).dispose();
    }
  }
  material.dispose();
}

/** Dispose every geometry/material/texture/instance-buffer under `root` (inclusive). */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((node) => {
    const mesh = node as Partial<THREE.Mesh>;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach(disposeMaterial);
    else if (material) disposeMaterial(material);
    if ((node as Partial<THREE.InstancedMesh>).isInstancedMesh) {
      (node as THREE.InstancedMesh).dispose();
    }
  });
}
