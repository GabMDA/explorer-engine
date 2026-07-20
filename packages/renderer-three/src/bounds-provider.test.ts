import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createBoundsProvider } from './bounds-provider';
import { createSceneManager } from './scene-manager';
import { createNodeIndex } from './node-index';
import { createComponentModel } from '@explorer-engine/core';
import type { ComponentConfig, ResolvedConfig } from '@explorer-engine/core';

function box(id: string, x: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  m.name = id;
  m.userData.explorerId = id;
  m.position.set(x, 0, 0);
  return m;
}

function comp(id: string, nodes: string[]): ComponentConfig {
  return {
    id,
    nodes: nodes.map((n) => ({ explorerId: n })),
    selectable: true,
    pickTarget: id,
    group: null,
  };
}

describe('createBoundsProvider', () => {
  const components = createComponentModel({
    components: [comp('pair', ['a', 'b']), comp('solo', ['a'])],
  } as unknown as ResolvedConfig);

  function setup() {
    const scene = createSceneManager();
    const root = new THREE.Group();
    root.add(box('a', -2), box('b', 2));
    scene.add(root);
    scene.setNodeIndex(createNodeIndex(root));
    return createBoundsProvider({ scene, components });
  }

  it('returns the union AABB of a component’s nodes', () => {
    const bounds = setup().boundsOf({ kind: 'component', id: 'pair' });
    expect(bounds).not.toBeNull();
    expect(bounds!.min[0]).toBeCloseTo(-2.5, 5); // a at x=-2, half 0.5
    expect(bounds!.max[0]).toBeCloseTo(2.5, 5); // b at x=2
  });

  it('returns the single-node AABB for a narrower component', () => {
    const bounds = setup().boundsOf({ kind: 'component', id: 'solo' });
    expect(bounds!.min[0]).toBeCloseTo(-2.5, 5);
    expect(bounds!.max[0]).toBeCloseTo(-1.5, 5);
  });

  it('returns null for an address that resolves to nothing', () => {
    expect(setup().boundsOf({ kind: 'component', id: 'ghost' })).toBeNull();
  });

  it('returns null when there is no node index', () => {
    const scene = createSceneManager();
    expect(
      createBoundsProvider({ scene, components }).boundsOf({ kind: 'component', id: 'pair' }),
    ).toBeNull();
  });
});
