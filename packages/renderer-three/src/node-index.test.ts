import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createNodeIndex } from './node-index';

function named(name: string, explorerId?: string): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  if (explorerId !== undefined) o.userData.explorerId = explorerId;
  return o;
}

describe('createNodeIndex', () => {
  it('indexes by explorerId (primary) and by name (fallback)', () => {
    const root = new THREE.Group();
    root.add(named('Crown', 'crown'));
    root.add(named('Movement', 'movement'));
    const index = createNodeIndex(root);

    expect(index.byExplorerId('crown')).toHaveLength(1);
    expect(index.byName('Crown')).toHaveLength(1);
    expect(index.byExplorerId('crown')[0]).toBe(index.byName('Crown')[0]);
    expect(index.size).toBe(2);
  });

  it('resolve() prefers explorerId, then falls back to name', () => {
    const root = new THREE.Group();
    root.add(named('Gears', 'gears'));
    root.add(named('PlainNode')); // name only, no explorerId
    const index = createNodeIndex(root);

    expect(index.resolve('gears')).toHaveLength(1); // by explorerId
    expect(index.resolve('PlainNode')).toHaveLength(1); // by name
    expect(index.resolve('unknown')).toHaveLength(0);
  });

  it('tolerates homonyms (same name / same explorerId) by returning lists', () => {
    const root = new THREE.Group();
    root.add(named('Screw'));
    root.add(named('Screw'));
    root.add(named('A', 'dup'));
    root.add(named('B', 'dup'));
    const index = createNodeIndex(root);

    expect(index.byName('Screw')).toHaveLength(2);
    expect(index.byExplorerId('dup')).toHaveLength(2);
  });

  it('skips unnamed / id-less nodes and exposes data-only descriptors', () => {
    const root = new THREE.Group();
    root.add(new THREE.Object3D()); // no name, no id → not indexed
    root.add(named('Dial', 'dial'));
    const index = createNodeIndex(root);

    expect(index.size).toBe(1);
    expect(index.descriptors()).toEqual([{ explorerId: 'dial', name: 'Dial' }]);
    // descriptors carry no Object3D — data-only identities
    expect(Object.keys(index.descriptors()[0]!)).toEqual(['explorerId', 'name']);
  });

  it('returns a stable empty array for unknown identities', () => {
    const index = createNodeIndex(new THREE.Group());
    expect(index.byExplorerId('nope')).toHaveLength(0);
    expect(index.byName('nope')).toHaveLength(0);
  });
});
