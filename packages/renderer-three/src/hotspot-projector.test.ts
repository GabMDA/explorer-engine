import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createHotspotProjector } from './hotspot-projector';
import { createSceneManager } from './scene-manager';
import { createCameraManager } from './camera-manager';
import { createNodeIndex } from './node-index';
import type { AnchorSpec, RendererPort } from '@explorer-engine/core';

function boxNamed(id: string, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  mesh.name = id;
  mesh.userData.explorerId = id;
  mesh.position.set(0, 0, z);
  return mesh;
}

const WIDTH = 200;
const HEIGHT = 100;
const fakeRenderer = { getSize: () => ({ width: WIDTH, height: HEIGHT }) } as RendererPort;

function setup(...meshes: THREE.Mesh[]) {
  const scene = createSceneManager();
  const root = new THREE.Group();
  for (const m of meshes) root.add(m);
  scene.add(root);
  scene.setNodeIndex(createNodeIndex(root));
  const camera = createCameraManager({ position: [0, 0, 5], target: [0, 0, 0], fov: 50 });
  camera.setAspect(WIDTH / HEIGHT);
  camera.getThreeCamera().updateMatrixWorld(true);
  let t = 0;
  const projector = createHotspotProjector({
    scene,
    camera,
    renderer: fakeRenderer,
    occlusionIntervalMs: 100,
    now: () => t,
  });
  return { scene, camera, projector, tick: (dt: number) => (t += dt) };
}

const anchor = (id: string, over: Partial<AnchorSpec> = {}): AnchorSpec => ({
  id,
  identities: [id],
  position: null,
  offset: null,
  occludable: true,
  ...over,
});

describe('createHotspotProjector', () => {
  it('projects a node-centre anchor to screen pixels', () => {
    const { projector } = setup(boxNamed('a', 0));
    const [r] = projector.project([anchor('a')]);
    expect(r?.onScreen).toBe(true);
    expect(r?.x).toBeCloseTo(WIDTH / 2, 1); // centre of the viewport
    expect(r?.y).toBeCloseTo(HEIGHT / 2, 1);
    expect(r?.depth).toBeCloseTo(5, 5);
    expect(r?.occluded).toBe(false); // its own front face never occludes it
  });

  it('projects a fixed-position anchor with an offset', () => {
    const { projector } = setup(boxNamed('a', 0));
    const [r] = projector.project([
      anchor('free', { identities: [], position: [0, 0, 0], offset: [0, 0, 0] }),
    ]);
    expect(r?.onScreen).toBe(true);
    expect(r?.x).toBeCloseTo(WIDTH / 2, 1);
  });

  it('reports occlusion when a different object sits in front of the anchor', () => {
    const { projector } = setup(boxNamed('a', 0), boxNamed('blocker', 2));
    const [r] = projector.project([anchor('a')]);
    expect(r?.occluded).toBe(true);
  });

  it('never reports a non-occludable anchor as occluded', () => {
    const { projector } = setup(boxNamed('a', 0), boxNamed('blocker', 2));
    const [r] = projector.project([anchor('a', { occludable: false })]);
    expect(r?.occluded).toBe(false);
  });

  it('marks an anchor behind the camera as off-screen', () => {
    const { projector } = setup(boxNamed('a', 0));
    const [r] = projector.project([anchor('behind', { identities: [], position: [0, 0, 20] })]);
    expect(r?.onScreen).toBe(false);
  });

  it('throttles occlusion recomputation (reuses the cached verdict within the interval)', () => {
    const { scene, projector, tick } = setup(boxNamed('a', 0), boxNamed('blocker', 2));
    expect(projector.project([anchor('a')])[0]?.occluded).toBe(true);
    // Remove the blocker but stay within the throttle window → cached "true" reused.
    const blocker = scene.getNodeIndex()!.resolve('blocker')[0]!;
    blocker.parent?.remove(blocker);
    tick(50);
    expect(projector.project([anchor('a')])[0]?.occluded).toBe(true);
    // Cross the interval → recompute → now clear.
    tick(100);
    expect(projector.project([anchor('a')])[0]?.occluded).toBe(false);
  });
});
