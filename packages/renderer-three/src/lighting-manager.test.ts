import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import type { LightingPreset } from '@explorer-engine/core';
import { STUDIO_LIGHTING, NIGHT_LIGHTING } from '@explorer-engine/core';
import { createSceneManager } from './scene-manager';
import { createLightingManager } from './lighting-manager';

const lightsOf = (scene: THREE.Scene) =>
  scene.children.filter((c): c is THREE.Light => c instanceof THREE.Light);

describe('createLightingManager', () => {
  it('starts with no preset applied', () => {
    const scene = createSceneManager();
    const lighting = createLightingManager(scene);
    expect(lighting.current).toBeNull();
    expect(lightsOf(scene.getThreeScene())).toHaveLength(0);
  });

  it('apply adds the preset lights to the scene and records the id', () => {
    const scene = createSceneManager();
    const lighting = createLightingManager(scene);
    lighting.apply(STUDIO_LIGHTING);
    expect(lighting.current).toBe('studio');
    expect(lightsOf(scene.getThreeScene())).toHaveLength(STUDIO_LIGHTING.lights.length);
  });

  it('builds the right Three.js light for each spec kind, with positions', () => {
    const scene = createSceneManager();
    const lighting = createLightingManager(scene);
    const preset: LightingPreset = {
      id: 'all-kinds',
      lights: [
        { kind: 'ambient', intensity: 0.5 },
        { kind: 'hemisphere', intensity: 0.5 },
        { kind: 'directional', intensity: 1, position: [1, 2, 3] },
        { kind: 'point', intensity: 1, position: [4, 5, 6], distance: 20 },
      ],
    };
    lighting.apply(preset);
    const lights = lightsOf(scene.getThreeScene());
    expect(lights[0]).toBeInstanceOf(THREE.AmbientLight);
    expect(lights[1]).toBeInstanceOf(THREE.HemisphereLight);
    expect(lights[2]).toBeInstanceOf(THREE.DirectionalLight);
    expect(lights[3]).toBeInstanceOf(THREE.PointLight);
    expect((lights[2] as THREE.DirectionalLight).position.toArray()).toEqual([1, 2, 3]);
    expect((lights[3] as THREE.PointLight).position.toArray()).toEqual([4, 5, 6]);
    expect((lights[3] as THREE.PointLight).distance).toBe(20);
  });

  it('applying a new preset removes and disposes the previous lights (no accumulation)', () => {
    const scene = createSceneManager();
    const lighting = createLightingManager(scene);
    lighting.apply(STUDIO_LIGHTING);
    const previous = lightsOf(scene.getThreeScene());
    const spies = previous.map((l) => vi.spyOn(l, 'dispose'));

    lighting.apply(NIGHT_LIGHTING);
    expect(lightsOf(scene.getThreeScene())).toHaveLength(NIGHT_LIGHTING.lights.length);
    for (const light of previous) expect(scene.getThreeScene().children).not.toContain(light);
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    expect(lighting.current).toBe('night');
  });

  it('dispose removes every light, clears current, and is idempotent', () => {
    const scene = createSceneManager();
    const lighting = createLightingManager(scene);
    lighting.apply(STUDIO_LIGHTING);
    const lights = lightsOf(scene.getThreeScene());
    const spies = lights.map((l) => vi.spyOn(l, 'dispose'));

    lighting.dispose();
    expect(lightsOf(scene.getThreeScene())).toHaveLength(0);
    expect(lighting.current).toBeNull();
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);

    expect(() => lighting.dispose()).not.toThrow();
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });
});
