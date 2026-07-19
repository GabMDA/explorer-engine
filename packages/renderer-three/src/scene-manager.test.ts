import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createSceneManager, createDemoScene } from './scene-manager';

describe('SceneManager', () => {
  it('returns null bounding box when empty and computes it from content', () => {
    const manager = createSceneManager();
    expect(manager.getBoundingBox()).toBeNull();

    manager.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial()));
    const box = manager.getBoundingBox();
    expect(box?.min).toEqual([-1, -1, -1]);
    expect(box?.max).toEqual([1, 1, 1]);
  });

  it('dispose frees geometries/materials, empties the scene, and is idempotent', () => {
    const manager = createSceneManager();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial();
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    manager.add(new THREE.Mesh(geometry, material));

    manager.dispose();
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(manager.getThreeScene().children).toHaveLength(0);
    expect(manager.getBoundingBox()).toBeNull();

    expect(() => manager.dispose()).not.toThrow(); // idempotent
    expect(geometryDispose).toHaveBeenCalledTimes(1);
  });
});

describe('createDemoScene', () => {
  it('builds a lit unit cube with a computable bounding box', () => {
    const manager = createDemoScene();
    const box = manager.getBoundingBox();
    expect(box?.min).toEqual([-0.5, -0.5, -0.5]);
    expect(box?.max).toEqual([0.5, 0.5, 0.5]);

    const hasLight = manager.getThreeScene().children.some((child) => child instanceof THREE.Light);
    const hasMesh = manager.getThreeScene().children.some((child) => child instanceof THREE.Mesh);
    expect(hasLight).toBe(true);
    expect(hasMesh).toBe(true);
  });

  it('includeLights:false ships only the object (Lighting Manager owns the lights)', () => {
    const manager = createDemoScene({ includeLights: false });
    const children = manager.getThreeScene().children;
    expect(children.some((child) => child instanceof THREE.Light)).toBe(false);
    expect(children.some((child) => child instanceof THREE.Mesh)).toBe(true);
  });
});
