import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { disposeObject3D } from './dispose-object';

describe('disposeObject3D', () => {
  it('disposes geometry and material of every mesh in the subtree', () => {
    const root = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    const geoSpy = vi.spyOn(geometry, 'dispose');
    const matSpy = vi.spyOn(material, 'dispose');
    root.add(new THREE.Mesh(geometry, material));

    disposeObject3D(root);

    expect(geoSpy).toHaveBeenCalledTimes(1);
    expect(matSpy).toHaveBeenCalledTimes(1);
  });

  it('disposes every texture referenced by a material', () => {
    const material = new THREE.MeshStandardMaterial();
    material.map = new THREE.Texture();
    material.normalMap = new THREE.Texture();
    const mapSpy = vi.spyOn(material.map, 'dispose');
    const normalSpy = vi.spyOn(material.normalMap, 'dispose');
    const root = new THREE.Mesh(new THREE.BoxGeometry(), material);

    disposeObject3D(root);

    expect(mapSpy).toHaveBeenCalledTimes(1);
    expect(normalSpy).toHaveBeenCalledTimes(1);
  });

  it('disposes every material in a multi-material mesh', () => {
    const materials = [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()];
    const spies = materials.map((m) => vi.spyOn(m, 'dispose'));
    const root = new THREE.Mesh(new THREE.BoxGeometry(), materials);

    disposeObject3D(root);

    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });

  it('disposes an InstancedMesh itself (releases its instance buffers), not just its geometry/material', () => {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    const instanced = new THREE.InstancedMesh(geometry, material, 4);
    const instancedSpy = vi.spyOn(instanced, 'dispose');
    const geoSpy = vi.spyOn(geometry, 'dispose');

    disposeObject3D(instanced);

    expect(instancedSpy).toHaveBeenCalledTimes(1);
    expect(geoSpy).toHaveBeenCalledTimes(1);
  });

  it('does not throw on an object with no geometry/material (e.g. a plain Group or Light)', () => {
    const root = new THREE.Group();
    root.add(new THREE.DirectionalLight());
    expect(() => disposeObject3D(root)).not.toThrow();
  });
});
