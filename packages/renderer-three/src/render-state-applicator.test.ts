import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createRenderStateApplicator } from './render-state-applicator';
import { createSceneManager } from './scene-manager';
import { createNodeIndex } from './node-index';
import { REST_VISUAL_STATE, type EffectiveVisualState } from '@explorer-engine/core';

function meshNamed(id: string): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff }),
  );
  mesh.name = id;
  mesh.userData.explorerId = id;
  return mesh;
}

function sceneWith(...ids: string[]) {
  const scene = createSceneManager();
  const root = new THREE.Group();
  for (const id of ids) root.add(meshNamed(id));
  scene.add(root);
  scene.setNodeIndex(createNodeIndex(root));
  return scene;
}

const state = (over: Partial<EffectiveVisualState>): EffectiveVisualState => ({
  ...REST_VISUAL_STATE,
  ...over,
});

describe('createRenderStateApplicator', () => {
  it('applies opacity + visibility and reverts exactly to the rest pose', () => {
    const scene = sceneWith('a');
    const applicator = createRenderStateApplicator({ scene });
    const mesh = scene.getNodeIndex()!.resolve('a')[0] as THREE.Mesh;
    const material = mesh.material as THREE.MeshStandardMaterial;
    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);

    applicator.applyNodeStates([
      { identity: 'a', state: state({ opacity: 0.2, visibility: 'hidden' }) },
    ]);
    expect(material.opacity).toBe(0.2);
    expect(material.transparent).toBe(true);
    expect(mesh.visible).toBe(false);

    // Recompose to rest → exact restoration (L6/L7), no saved per-source original.
    applicator.applyNodeStates([{ identity: 'a', state: REST_VISUAL_STATE }]);
    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);
    expect(mesh.visible).toBe(true);
  });

  it('applies a transform offset from the rest pose and reverts', () => {
    const scene = sceneWith('a');
    const applicator = createRenderStateApplicator({ scene });
    const mesh = scene.getNodeIndex()!.resolve('a')[0]!;
    mesh.position.set(1, 0, 0); // a non-trivial rest position
    applicator.applyNodeStates([
      { identity: 'a', state: state({ transform: { translate: [0, 2, 0], scale: 2 } }) },
    ]);
    expect(mesh.position.toArray()).toEqual([1, 2, 0]); // rest ⊕ offset
    expect(mesh.scale.toArray()).toEqual([2, 2, 2]);

    applicator.applyNodeStates([{ identity: 'a', state: REST_VISUAL_STATE }]);
    expect(mesh.position.toArray()).toEqual([1, 0, 0]);
    expect(mesh.scale.toArray()).toEqual([1, 1, 1]);
  });

  it('applies colorOverride as an emissive tint and reverts', () => {
    const scene = sceneWith('a');
    const applicator = createRenderStateApplicator({ scene });
    const std = (scene.getNodeIndex()!.resolve('a')[0] as THREE.Mesh)
      .material as THREE.MeshStandardMaterial;
    const restHex = std.emissive.getHex();

    applicator.applyNodeStates([
      { identity: 'a', state: state({ colorOverride: { color: '#ff0000', intensity: 0.8 } }) },
    ]);
    expect(std.emissive.getHex()).toBe(0xff0000);
    expect(std.emissiveIntensity).toBeCloseTo(0.8);

    applicator.applyNodeStates([{ identity: 'a', state: REST_VISUAL_STATE }]);
    expect(std.emissive.getHex()).toBe(restHex);
  });

  it('applies effective state to every homonym object of an identity', () => {
    const scene = createSceneManager();
    const root = new THREE.Group();
    root.add(meshNamed('dup'));
    root.add(meshNamed('dup'));
    scene.add(root);
    scene.setNodeIndex(createNodeIndex(root));
    const applicator = createRenderStateApplicator({ scene });
    applicator.applyNodeStates([{ identity: 'dup', state: state({ visibility: 'hidden' }) }]);
    for (const obj of scene.getNodeIndex()!.resolve('dup')) expect(obj.visible).toBe(false);
  });

  it('applies cutaway clip planes and reverts to none, enabling local clipping', () => {
    const scene = sceneWith('a');
    let localClipping = false;
    const renderer = {
      getThreeRenderer: () => ({
        get localClippingEnabled() {
          return localClipping;
        },
        set localClippingEnabled(v: boolean) {
          localClipping = v;
        },
      }),
    } as unknown as Parameters<typeof createRenderStateApplicator>[0]['renderer'];
    const applicator = createRenderStateApplicator({ scene, renderer });
    const material = (scene.getNodeIndex()!.resolve('a')[0] as THREE.Mesh)
      .material as THREE.MeshStandardMaterial;
    expect(material.clippingPlanes).toBeNull();

    applicator.applyNodeStates([
      { identity: 'a', state: state({ clip: [{ normal: [1, 0, 0], offset: 0.1 }] }) },
    ]);
    expect(localClipping).toBe(true);
    expect(material.clippingPlanes).toHaveLength(1);
    // constant = -offset for a keep-half-space where normal·x ≥ offset.
    expect(material.clippingPlanes![0]!.constant).toBeCloseTo(-0.1, 6);

    applicator.applyNodeStates([{ identity: 'a', state: REST_VISUAL_STATE }]);
    expect(material.clippingPlanes).toBeNull(); // reverted to rest
  });

  it('no-ops when there is no node index or the identity is unknown', () => {
    const scene = createSceneManager();
    const applicator = createRenderStateApplicator({ scene });
    expect(() =>
      applicator.applyNodeStates([{ identity: 'x', state: REST_VISUAL_STATE }]),
    ).not.toThrow();
  });
});
