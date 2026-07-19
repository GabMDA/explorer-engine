import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import type { ResourceManager, OrbitControls } from '@explorer-engine/core';
import type { SceneManager } from './scene-manager';
import type { CameraManager } from './camera-manager';
import type { ThreeRendererHandle } from './internal/handles';

// Record decoder wiring without any real WASM/GPU.
const { rec } = vi.hoisted(() => ({
  rec: {
    dracoCreated: 0,
    dracoPaths: [] as string[],
    dracoPreload: 0,
    dracoDisposed: 0,
    ktx2Created: 0,
    ktx2Paths: [] as string[],
    ktx2DetectCalls: 0,
    ktx2Disposed: 0,
    setDraco: 0,
    setKtx2: 0,
    setMeshopt: [] as unknown[],
    makeGroup: (() => undefined) as () => unknown,
  },
}));

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    setDRACOLoader() {
      rec.setDraco += 1;
    }
    setKTX2Loader() {
      rec.setKtx2 += 1;
    }
    setMeshoptDecoder(d: unknown) {
      rec.setMeshopt.push(d);
    }
    parse(_b: ArrayBuffer, _p: string, onLoad: (g: unknown) => void) {
      onLoad({ scene: rec.makeGroup() });
    }
  },
}));

vi.mock('three/examples/jsm/loaders/DRACOLoader.js', () => ({
  DRACOLoader: class {
    constructor() {
      rec.dracoCreated += 1;
    }
    setDecoderPath(p: string) {
      rec.dracoPaths.push(p);
      return this;
    }
    preload() {
      rec.dracoPreload += 1;
      return this;
    }
    dispose() {
      rec.dracoDisposed += 1;
    }
  },
}));

vi.mock('three/examples/jsm/loaders/KTX2Loader.js', () => ({
  KTX2Loader: class {
    constructor() {
      rec.ktx2Created += 1;
    }
    setTranscoderPath(p: string) {
      rec.ktx2Paths.push(p);
      return this;
    }
    detectSupport() {
      rec.ktx2DetectCalls += 1;
      return this;
    }
    dispose() {
      rec.ktx2Disposed += 1;
    }
  },
}));

vi.mock('three/examples/jsm/libs/meshopt_decoder.module.js', () => ({
  MeshoptDecoder: { __meshopt: true },
}));

import { createModelLoader } from './model-loader';

const makeCubeGroup = () => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
  return g;
};

function deps() {
  const rm = {
    load: (path: string) =>
      Promise.resolve({ url: 'https://cdn/pkg/' + path, bytes: new Uint8Array([1, 2, 3, 4]) }),
    dispose: vi.fn(),
  } as unknown as ResourceManager;
  const scene = {
    add: vi.fn(),
    remove: vi.fn(),
    setNodeIndex: vi.fn(),
    getNodeIndex: () => null,
  } as unknown as SceneManager;
  const cam = new THREE.PerspectiveCamera(50, 1.5, 0.1, 100);
  const camera = {
    getThreeCamera: () => cam,
    setAspect: vi.fn(),
    setView: vi.fn(),
    dispose: vi.fn(),
  } as unknown as CameraManager;
  const controls = { setView: vi.fn() } as unknown as OrbitControls;
  const renderer = {
    getThreeRenderer: () => ({}) as unknown as THREE.WebGLRenderer,
  } as ThreeRendererHandle;
  return { rm, scene, camera, controls, renderer };
}

beforeEach(() => {
  rec.dracoCreated = 0;
  rec.dracoPaths = [];
  rec.dracoPreload = 0;
  rec.dracoDisposed = 0;
  rec.ktx2Created = 0;
  rec.ktx2Paths = [];
  rec.ktx2DetectCalls = 0;
  rec.ktx2Disposed = 0;
  rec.setDraco = 0;
  rec.setKtx2 = 0;
  rec.setMeshopt = [];
  rec.makeGroup = makeCubeGroup;
});

describe('createModelLoader — decoder wiring (P2-T3)', () => {
  it('creates DRACOLoader once, sets the path, wires it, never preloads', () => {
    const { rm, scene, camera } = deps();
    createModelLoader({ resourceManager: rm, scene, camera, dracoDecoderPath: 'decoders/draco/' });
    expect(rec.dracoCreated).toBe(1);
    expect(rec.dracoPaths).toEqual(['decoders/draco/']);
    expect(rec.setDraco).toBe(1);
    expect(rec.dracoPreload).toBe(0); // lazy: no preload
  });

  it('creates KTX2Loader once, sets the path, detects support exactly once, wires it', () => {
    const { rm, scene, camera, renderer } = deps();
    createModelLoader({
      resourceManager: rm,
      scene,
      camera,
      ktx2TranscoderPath: 'decoders/basis/',
      renderer,
    });
    expect(rec.ktx2Created).toBe(1);
    expect(rec.ktx2Paths).toEqual(['decoders/basis/']);
    expect(rec.ktx2DetectCalls).toBe(1); // exactly once per instance
    expect(rec.setKtx2).toBe(1);
  });

  it('always wires the real MeshoptDecoder into the GLTFLoader', () => {
    const { rm, scene, camera } = deps();
    createModelLoader({ resourceManager: rm, scene, camera });
    expect(rec.setMeshopt).toEqual([{ __meshopt: true }]);
  });

  it('throws a clear error when ktx2 path is set without a renderer', () => {
    const { rm, scene, camera } = deps();
    expect(() =>
      createModelLoader({
        resourceManager: rm,
        scene,
        camera,
        ktx2TranscoderPath: 'decoders/basis/',
      }),
    ).toThrow(/renderer/i);
  });

  it('creates NO Draco/KTX2 loader when no decoder path is configured', () => {
    const { rm, scene, camera } = deps();
    createModelLoader({ resourceManager: rm, scene, camera });
    expect(rec.dracoCreated).toBe(0);
    expect(rec.ktx2Created).toBe(0);
    expect(rec.setDraco).toBe(0);
    expect(rec.setKtx2).toBe(0);
  });

  it('reuses the same decoder instances across multiple loads (detectSupport not repeated)', async () => {
    const { rm, scene, camera, renderer } = deps();
    const loader = createModelLoader({
      resourceManager: rm,
      scene,
      camera,
      dracoDecoderPath: 'decoders/draco/',
      ktx2TranscoderPath: 'decoders/basis/',
      renderer,
    });
    await loader.load({ path: 'a.glb' });
    await loader.load({ path: 'b.glb' });
    expect(rec.dracoCreated).toBe(1);
    expect(rec.ktx2Created).toBe(1);
    expect(rec.ktx2DetectCalls).toBe(1); // not re-detected per load
  });

  it('disposes both decoders on dispose, idempotently', () => {
    const { rm, scene, camera, renderer } = deps();
    const loader = createModelLoader({
      resourceManager: rm,
      scene,
      camera,
      dracoDecoderPath: 'decoders/draco/',
      ktx2TranscoderPath: 'decoders/basis/',
      renderer,
    });
    loader.dispose();
    expect(rec.dracoDisposed).toBe(1);
    expect(rec.ktx2Disposed).toBe(1);
    loader.dispose(); // idempotent — no second dispose
    expect(rec.dracoDisposed).toBe(1);
    expect(rec.ktx2Disposed).toBe(1);
  });
});
