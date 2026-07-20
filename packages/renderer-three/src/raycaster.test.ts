import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createRaycasterAdapter } from './raycaster';
import { createSceneManager } from './scene-manager';
import { createCameraManager } from './camera-manager';
import { createNodeIndex } from './node-index';

function boxNamed(id: string, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  mesh.name = id;
  mesh.userData.explorerId = id;
  mesh.position.set(0, 0, z);
  return mesh;
}

function setup(...meshes: THREE.Mesh[]) {
  const scene = createSceneManager();
  const root = new THREE.Group();
  for (const m of meshes) root.add(m);
  scene.add(root);
  scene.setNodeIndex(createNodeIndex(root));
  const camera = createCameraManager({ position: [0, 0, 5], target: [0, 0, 0], fov: 50 });
  camera.setAspect(1);
  camera.getThreeCamera().updateMatrixWorld(true);
  return { scene, camera, raycaster: createRaycasterAdapter({ scene, camera }) };
}

describe('createRaycasterAdapter', () => {
  it('resolves a centre pick to the hit node identity and world point', () => {
    const { raycaster } = setup(boxNamed('a', 0));
    const hit = raycaster.pick(0, 0);
    expect(hit?.identity).toBe('a');
    expect(hit!.point[2]).toBeGreaterThan(0); // front face, toward the camera
    expect(hit!.distance).toBeGreaterThan(0);
  });

  it('returns null when the ray misses all geometry', () => {
    const { raycaster } = setup(boxNamed('a', 0));
    expect(raycaster.pick(0.95, 0.95)).toBeNull();
  });

  it('picks the nearest object when several overlap', () => {
    const { raycaster } = setup(boxNamed('back', -1), boxNamed('front', 2));
    expect(raycaster.pick(0, 0)?.identity).toBe('front');
  });

  it('ignores geometry hidden by the render state (invisible chain)', () => {
    const { scene, raycaster } = setup(boxNamed('a', 0));
    scene.getNodeIndex()!.resolve('a')[0]!.visible = false;
    expect(raycaster.pick(0, 0)).toBeNull();
  });
});
