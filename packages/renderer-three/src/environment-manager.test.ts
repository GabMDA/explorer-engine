import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import type { ThreeRendererHandle } from './internal/handles';

// Track RoomEnvironment.dispose() calls without a real WebGL context.
const { roomDisposed } = vi.hoisted(() => ({ roomDisposed: { count: 0 } }));

vi.mock('three/examples/jsm/environments/RoomEnvironment.js', () => ({
  RoomEnvironment: class {
    dispose() {
      roomDisposed.count += 1;
    }
  },
}));

// Replace only PMREMGenerator (needs GL) while keeping real Scene/Color/DataTexture.
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>();
  class PMREMGenerator {
    disposed = 0;
    fromScene() {
      return { texture: new actual.Texture() };
    }
    dispose() {
      this.disposed += 1;
    }
  }
  return { ...actual, PMREMGenerator };
});

import { createSceneManager } from './scene-manager';
import { createEnvironmentManager } from './environment-manager';

function fakeRenderer(): ThreeRendererHandle {
  return { getThreeRenderer: () => ({}) as unknown as THREE.WebGLRenderer };
}

beforeEach(() => {
  roomDisposed.count = 0;
});

describe('createEnvironmentManager — background', () => {
  it('applies a flat color background', () => {
    const scene = createSceneManager();
    const env = createEnvironmentManager({ scene, renderer: fakeRenderer() });
    env.apply({ background: { kind: 'color', color: 0x112233 } });
    const bg = scene.getThreeScene().background;
    expect(bg).toBeInstanceOf(THREE.Color);
    expect((bg as THREE.Color).getHex()).toBe(0x112233);
  });

  it('applies a gradient background as an owned DataTexture', () => {
    const scene = createSceneManager();
    const env = createEnvironmentManager({ scene, renderer: fakeRenderer() });
    env.apply({ background: { kind: 'gradient', top: 0xffffff, bottom: 0x000000 } });
    const bg = scene.getThreeScene().background;
    expect(bg).toBeInstanceOf(THREE.DataTexture);
    expect((bg as THREE.DataTexture).colorSpace).toBe(THREE.SRGBColorSpace);
  });

  it('transparent background clears the scene background', () => {
    const scene = createSceneManager();
    const env = createEnvironmentManager({ scene, renderer: fakeRenderer() });
    env.apply({ background: { kind: 'color', color: 0x445566 } });
    env.apply({ background: { kind: 'transparent' } });
    expect(scene.getThreeScene().background).toBeNull();
  });

  it('replacing a gradient disposes the previous texture (no leak)', () => {
    const scene = createSceneManager();
    const env = createEnvironmentManager({ scene, renderer: fakeRenderer() });
    env.apply({ background: { kind: 'gradient', top: 0xffffff, bottom: 0x000000 } });
    const first = scene.getThreeScene().background as THREE.DataTexture;
    const spy = vi.spyOn(first, 'dispose');
    env.apply({ background: { kind: 'color', color: 0x010203 } });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('createEnvironmentManager — IBL', () => {
  it('neutral-room bakes an env map, applies intensity, and disposes RoomEnvironment', () => {
    const scene = createSceneManager();
    const env = createEnvironmentManager({ scene, renderer: fakeRenderer() });
    env.apply({
      background: { kind: 'color', color: 0x000000 },
      environment: 'neutral-room',
      environmentIntensity: 0.8,
    });
    expect(scene.getThreeScene().environment).toBeInstanceOf(THREE.Texture);
    expect(scene.getThreeScene().environmentIntensity).toBe(0.8);
    expect(roomDisposed.count).toBe(1);
  });

  it("environment 'none' (default) leaves no env map", () => {
    const scene = createSceneManager();
    const env = createEnvironmentManager({ scene, renderer: fakeRenderer() });
    env.apply({ background: { kind: 'transparent' } });
    expect(scene.getThreeScene().environment).toBeNull();
    expect(roomDisposed.count).toBe(0);
  });

  it('replacing the env map disposes the previous one', () => {
    const scene = createSceneManager();
    const env = createEnvironmentManager({ scene, renderer: fakeRenderer() });
    env.apply({ background: { kind: 'transparent' }, environment: 'neutral-room' });
    const first = scene.getThreeScene().environment as THREE.Texture;
    const spy = vi.spyOn(first, 'dispose');
    env.apply({ background: { kind: 'transparent' }, environment: 'neutral-room' });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('createEnvironmentManager — dispose', () => {
  it('releases background + env map and is idempotent', () => {
    const scene = createSceneManager();
    const env = createEnvironmentManager({ scene, renderer: fakeRenderer() });
    env.apply({
      background: { kind: 'gradient', top: 0xffffff, bottom: 0x000000 },
      environment: 'neutral-room',
    });
    const bg = scene.getThreeScene().background as THREE.DataTexture;
    const map = scene.getThreeScene().environment as THREE.Texture;
    const bgSpy = vi.spyOn(bg, 'dispose');
    const mapSpy = vi.spyOn(map, 'dispose');

    env.dispose();
    expect(scene.getThreeScene().background).toBeNull();
    expect(scene.getThreeScene().environment).toBeNull();
    expect(bgSpy).toHaveBeenCalledTimes(1);
    expect(mapSpy).toHaveBeenCalledTimes(1);

    expect(() => env.dispose()).not.toThrow();
  });
});
