import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { EventBus, ModelLoadError } from '@explorer-engine/core';
import type {
  ResourceManager,
  EngineEventMap,
  ModelLoadPhase,
  OrbitControls,
} from '@explorer-engine/core';
import type { SceneManager } from './scene-manager';
import type { CameraManager } from './camera-manager';

// Control the (mocked) GLTFLoader deterministically. Groups are built by the test
// (below) with the SAME `three` instance the loader uses — building them inside
// the mock factory via importActual would create a second three and break Box3.
const { gltf } = vi.hoisted(() => ({
  gltf: {
    auto: true,
    mode: 'success' as 'success' | 'error',
    calls: [] as { path: string }[],
    pending: undefined as undefined | { onLoad: (g: unknown) => void; group: unknown },
    lastGroup: undefined as unknown,
    makeGroup: (() => undefined) as () => unknown,
  },
}));

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    parse(
      _buffer: ArrayBuffer,
      path: string,
      onLoad: (g: unknown) => void,
      onError: (e: unknown) => void,
    ) {
      const group = gltf.makeGroup();
      gltf.lastGroup = group;
      gltf.calls.push({ path });
      // Deliver a GLTF-shaped object ({ scene }) like the real loader does.
      const deliver = (g: unknown) => onLoad({ scene: g });
      gltf.pending = { onLoad: deliver, group };
      if (gltf.auto) {
        if (gltf.mode === 'error') onError(new Error('parse failed'));
        else deliver(group);
      }
    }
  },
}));

import { createModelLoader } from './model-loader';

const tick = () => new Promise((r) => setTimeout(r, 0));

const makeCubeGroup = () => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
  return g;
};

function fakeResourceManager() {
  const loadCalls: string[] = [];
  const rm = {
    load: (path: string) => {
      loadCalls.push(path);
      return Promise.resolve({
        url: 'https://cdn/pkg/' + path,
        bytes: new Uint8Array([1, 2, 3, 4]),
        mimeType: 'model/gltf-binary',
      });
    },
    dispose: vi.fn(),
  } as unknown as ResourceManager;
  return { rm, loadCalls };
}

function fakeScene() {
  const added: THREE.Object3D[] = [];
  const removed: THREE.Object3D[] = [];
  const scene = {
    add: (o: THREE.Object3D) => added.push(o),
    remove: (o: THREE.Object3D) => removed.push(o),
  } as unknown as SceneManager;
  return { scene, added, removed };
}

function fakeCamera() {
  const cam = new THREE.PerspectiveCamera(50, 1.5, 0.1, 100);
  const camera = {
    getThreeCamera: () => cam,
    setAspect: vi.fn(),
    setView: vi.fn(),
    dispose: vi.fn(),
  } as unknown as CameraManager;
  return camera;
}

function fakeControls() {
  return {
    orbit: vi.fn(),
    zoom: vi.fn(),
    pan: vi.fn(),
    update: vi.fn(),
    setView: vi.fn(),
    onChange: vi.fn(() => () => {}),
    dispose: vi.fn(),
  } as unknown as OrbitControls;
}

beforeEach(() => {
  gltf.auto = true;
  gltf.mode = 'success';
  gltf.calls = [];
  gltf.pending = undefined;
  gltf.lastGroup = undefined;
  gltf.makeGroup = makeCubeGroup;
});

describe('createModelLoader — happy path', () => {
  it('loads bytes from the Resource Manager and parses them (single request, no second fetch)', async () => {
    const { rm, loadCalls } = fakeResourceManager();
    const loader = createModelLoader({
      resourceManager: rm,
      scene: fakeScene().scene,
      camera: fakeCamera(),
    });
    await loader.load({ path: 'model.glb' });
    expect(loadCalls).toEqual(['model.glb']); // exactly one resource request
    expect(gltf.calls).toHaveLength(1); // parse used once, no extra fetch
  });

  it('reports phases in order and emits model:loaded', async () => {
    const { rm } = fakeResourceManager();
    const events = new EventBus<EngineEventMap>();
    const phases: ModelLoadPhase[] = [];
    const loaded: { url: string }[] = [];
    events.on('model:loading', (e) => phases.push(e.phase));
    events.on('model:loaded', (e) => loaded.push(e));

    const loader = createModelLoader({
      resourceManager: rm,
      scene: fakeScene().scene,
      camera: fakeCamera(),
      events,
    });
    const result = await loader.load({ path: 'model.glb' });

    expect(phases).toEqual(['fetching', 'parsing', 'inserting', 'framing', 'ready']);
    expect(loaded).toHaveLength(1);
    expect(result.url).toBe('https://cdn/pkg/model.glb');
  });

  it('inserts the model via the Scene Manager and computes its bounding box', async () => {
    const { rm } = fakeResourceManager();
    const scene = fakeScene();
    const loader = createModelLoader({
      resourceManager: rm,
      scene: scene.scene,
      camera: fakeCamera(),
    });
    const result = await loader.load({ path: 'model.glb' });
    expect(scene.added).toContain(gltf.lastGroup);
    expect(result.boundingBox.min[0]).toBeCloseTo(-0.5);
    expect(result.boundingBox.max[1]).toBeCloseTo(0.5);
  });

  it('applies framing by re-targeting the orbit controls (no direct camera jump)', async () => {
    const { rm } = fakeResourceManager();
    const camera = fakeCamera();
    const controls = fakeControls();
    const requestRender = vi.fn();
    const loader = createModelLoader({
      resourceManager: rm,
      scene: fakeScene().scene,
      camera,
      controls,
      requestRender,
    });
    await loader.load({ path: 'model.glb' });
    expect(controls.setView).toHaveBeenCalledTimes(1);
    const [position, target] = (controls.setView as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0]!;
    expect((position as number[]).every(Number.isFinite)).toBe(true);
    expect((target as number[]).every(Number.isFinite)).toBe(true);
    expect(camera.setView).not.toHaveBeenCalled(); // controls own the camera
    expect(requestRender).toHaveBeenCalled();
  });
});

describe('createModelLoader — errors', () => {
  it('a parse error rejects, emits model:error, and inserts nothing', async () => {
    gltf.mode = 'error';
    const { rm } = fakeResourceManager();
    const scene = fakeScene();
    const events = new EventBus<EngineEventMap>();
    const errors: { message: string }[] = [];
    events.on('model:error', (e) => errors.push(e));

    const loader = createModelLoader({
      resourceManager: rm,
      scene: scene.scene,
      camera: fakeCamera(),
      events,
    });
    await expect(loader.load({ path: 'bad.glb' })).rejects.toBeInstanceOf(ModelLoadError);
    expect(errors).toHaveLength(1);
    expect(scene.added).toHaveLength(0); // no partial insert
  });
});

describe('createModelLoader — dispose & late results', () => {
  it('dispose removes and releases the current model, and is idempotent', async () => {
    const { rm } = fakeResourceManager();
    const scene = fakeScene();
    const loader = createModelLoader({
      resourceManager: rm,
      scene: scene.scene,
      camera: fakeCamera(),
    });
    await loader.load({ path: 'model.glb' });
    const group = gltf.lastGroup as THREE.Group;
    const geometry = (group.children[0] as THREE.Mesh).geometry;
    const disposeSpy = vi.spyOn(geometry, 'dispose');

    loader.dispose();
    expect(scene.removed).toContain(group);
    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(() => loader.dispose()).not.toThrow(); // idempotent
  });

  it('ignores and releases a parse result that arrives after dispose', async () => {
    gltf.auto = false; // hold the parse open
    const { rm } = fakeResourceManager();
    const scene = fakeScene();
    const events = new EventBus<EngineEventMap>();
    const loaded: unknown[] = [];
    events.on('model:loaded', (e) => loaded.push(e));

    const loader = createModelLoader({
      resourceManager: rm,
      scene: scene.scene,
      camera: fakeCamera(),
      events,
    });
    const p = loader.load({ path: 'model.glb' });
    await tick(); // reach the parsing phase (parse pending)
    expect(gltf.pending).toBeDefined();
    const group = gltf.pending!.group as THREE.Group;
    const geometry = (group.children[0] as THREE.Mesh).geometry;
    const disposeSpy = vi.spyOn(geometry, 'dispose');

    loader.dispose();
    gltf.pending!.onLoad(group); // late result

    await expect(p).rejects.toBeInstanceOf(ModelLoadError);
    expect(scene.added).toHaveLength(0); // never inserted
    expect(loaded).toHaveLength(0); // no model:loaded
    expect(disposeSpy).toHaveBeenCalledTimes(1); // released
  });

  it('refuses new loads after dispose', async () => {
    const { rm } = fakeResourceManager();
    const loader = createModelLoader({
      resourceManager: rm,
      scene: fakeScene().scene,
      camera: fakeCamera(),
    });
    loader.dispose();
    await expect(loader.load({ path: 'model.glb' })).rejects.toBeInstanceOf(ModelLoadError);
  });
});
