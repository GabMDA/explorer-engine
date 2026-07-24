import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { applyInstancing } from './instancing';

function meshAt(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  explorerId?: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (explorerId !== undefined) mesh.userData['explorerId'] = explorerId;
  return mesh;
}

describe('applyInstancing', () => {
  it('merges a group at/above minCount sharing geometry+material into one InstancedMesh', () => {
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    const meshes = [
      meshAt(geometry, material, [0, 0, 0]),
      meshAt(geometry, material, [1, 0, 0]),
      meshAt(geometry, material, [2, 0, 0]),
    ];
    meshes.forEach((m) => root.add(m));

    const result = applyInstancing(root, { enabled: true, minCount: 3 });

    expect(result).toEqual({ groups: 1, nodesMerged: 3 });
    const instanced = root.children.find(
      (c) => (c as Partial<THREE.InstancedMesh>).isInstancedMesh,
    ) as THREE.InstancedMesh;
    expect(instanced).toBeDefined();
    expect(instanced.count).toBe(3);
    // Originals detached — only the InstancedMesh remains as a child.
    expect(root.children).toEqual([instanced]);
  });

  it('preserves each instance world position via setMatrixAt', () => {
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    const positions: Array<[number, number, number]> = [
      [0, 0, 0],
      [1, 2, 3],
      [-4, 0, 5],
    ];
    positions.forEach((p) => root.add(meshAt(geometry, material, p)));

    applyInstancing(root, { enabled: true, minCount: 3 });

    const instanced = root.children[0] as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    positions.forEach((expected, i) => {
      instanced.getMatrixAt(i, m);
      pos.setFromMatrixPosition(m);
      expect([pos.x, pos.y, pos.z]).toEqual(expected);
    });
  });

  it('leaves a group below minCount untouched', () => {
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    const a = meshAt(geometry, material, [0, 0, 0]);
    const b = meshAt(geometry, material, [1, 0, 0]);
    root.add(a, b);

    const result = applyInstancing(root, { enabled: true, minCount: 3 });

    expect(result).toEqual({ groups: 0, nodesMerged: 0 });
    expect(root.children).toEqual([a, b]);
  });

  it('never merges a node carrying extras.explorerId, even if it would otherwise qualify', () => {
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    const addressable = meshAt(geometry, material, [0, 0, 0], 'special-part');
    const anon = [meshAt(geometry, material, [1, 0, 0]), meshAt(geometry, material, [2, 0, 0])];
    root.add(addressable, ...anon);

    // Only 2 anonymous meshes qualify (below the default minCount of 3) — nothing merges,
    // and the addressable one is untouched either way.
    const result = applyInstancing(root, { enabled: true, minCount: 2 });
    expect(result).toEqual({ groups: 1, nodesMerged: 2 });
    expect(root.children).toContain(addressable); // never removed
    expect(root.children).not.toContain(anon[0]);
    expect(root.children).not.toContain(anon[1]);
  });

  it('does not cross-merge distinct geometry/material pairs', () => {
    const root = new THREE.Group();
    const geoA = new THREE.BoxGeometry();
    const geoB = new THREE.SphereGeometry();
    const matRed = new THREE.MeshBasicMaterial({ color: 'red' });
    const matBlue = new THREE.MeshBasicMaterial({ color: 'blue' });
    // 3 red boxes, 3 blue spheres — two independent groups.
    for (let i = 0; i < 3; i++) root.add(meshAt(geoA, matRed, [i, 0, 0]));
    for (let i = 0; i < 3; i++) root.add(meshAt(geoB, matBlue, [i, 1, 0]));

    const result = applyInstancing(root, { enabled: true, minCount: 3 });

    expect(result).toEqual({ groups: 2, nodesMerged: 6 });
    const instancedMeshes = root.children.filter(
      (c) => (c as Partial<THREE.InstancedMesh>).isInstancedMesh,
    );
    expect(instancedMeshes).toHaveLength(2);
  });

  it('is a no-op when disabled', () => {
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    const meshes = [
      meshAt(geometry, material, [0, 0, 0]),
      meshAt(geometry, material, [1, 0, 0]),
      meshAt(geometry, material, [2, 0, 0]),
    ];
    root.add(...meshes);

    const result = applyInstancing(root, { enabled: false, minCount: 2 });

    expect(result).toEqual({ groups: 0, nodesMerged: 0 });
    expect(root.children).toEqual(meshes);
  });

  it('ignores an already-instanced mesh (never double-merges)', () => {
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    const already = new THREE.InstancedMesh(geometry, material, 5);
    root.add(already);

    const result = applyInstancing(root, { enabled: true, minCount: 2 });

    expect(result).toEqual({ groups: 0, nodesMerged: 0 });
    expect(root.children).toEqual([already]);
  });

  it('clamps a minCount below 2 up to 2', () => {
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    root.add(meshAt(geometry, material, [0, 0, 0]), meshAt(geometry, material, [1, 0, 0]));

    const result = applyInstancing(root, { enabled: true, minCount: 1 });

    expect(result).toEqual({ groups: 1, nodesMerged: 2 }); // clamped to 2, so a pair qualifies
  });
});
