// Model Loader (chapter 02 §2.8, roadmap P2-T2) — Three.js implementation of the
// core's ModelLoaderPort. It fetches the GLB bytes through the core Resource
// Manager (P2-T1), parses them with GLTFLoader.parse (never .load — no second
// fetch, no network of its own), inserts the model into the Scene Manager's
// scene, computes its bounding box, frames the camera (headless math from core),
// syncs the orbit controls' target and requests a render. The core never sees a
// single Three.js object — only bytes, a bounding box and framing data (L8/L9).
//
// Scope P2-T2: a simple, self-contained, uncompressed GLB. No Draco/KTX2/Meshopt.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { computeCameraFraming, ModelLoadError } from '@explorer-engine/core';
import type {
  ModelLoaderPort,
  ModelLoadRequest,
  ModelLoadResult,
  ModelLoadProgress,
  ModelLoadPhase,
  ResourceManager,
  BoundingBox,
  Vec3,
  OrbitControls,
  EventBus,
  EngineEventMap,
} from '@explorer-engine/core';
import type { SceneManager } from './scene-manager';
import type { CameraManager } from './camera-manager';

const DEG2RAD = Math.PI / 180;

export interface ModelLoaderOptions {
  /** Source of the GLB bytes (owned by the host — never disposed here). */
  readonly resourceManager: ResourceManager;
  /** Scene the model is inserted into (owns the scene; not owned by the loader). */
  readonly scene: SceneManager;
  /** Camera to frame; its FOV/aspect drive the framing. */
  readonly camera: CameraManager;
  /** Orbit controls to re-target after framing (no first-interaction jump). */
  readonly controls?: OrbitControls;
  /** Typed event bus for model:loading / model:loaded / model:error. */
  readonly events?: EventBus<EngineEventMap>;
  /** Wake the on-demand render loop after insertion/framing. */
  readonly requestRender?: () => void;
  /** Optional phase-progress callback (mirrors the model:loading events). */
  readonly onProgress?: (progress: ModelLoadProgress) => void;
  /** View direction from target to camera for framing. */
  readonly framingDirection?: Vec3;
  /** Framing zoom-out margin (> 1). */
  readonly framingMargin?: number;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function resourceDirOf(url: string): string {
  const i = url.lastIndexOf('/');
  return i >= 0 ? url.slice(0, i + 1) : '';
}

function boxToData(box: THREE.Box3): BoundingBox {
  return { min: [box.min.x, box.min.y, box.min.z], max: [box.max.x, box.max.y, box.max.z] };
}

function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    if (value && typeof value === 'object' && (value as THREE.Texture).isTexture === true) {
      (value as THREE.Texture).dispose();
    }
  }
  material.dispose();
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((node) => {
    const mesh = node as Partial<THREE.Mesh>;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach(disposeMaterial);
    else if (material) disposeMaterial(material);
  });
}

export function createModelLoader(options: ModelLoaderOptions): ModelLoaderPort {
  const { resourceManager, scene, camera } = options;
  const loader = new GLTFLoader();
  let current: THREE.Object3D | null = null;
  let disposed = false;

  const emitLoading = (url: string, phase: ModelLoadPhase) => {
    options.onProgress?.({ url, phase });
    options.events?.emit('model:loading', { url, phase });
  };

  const removeCurrent = () => {
    if (current) {
      scene.remove(current);
      disposeObject(current);
      current = null;
    }
  };

  const parseGltf = (bytes: Uint8Array, path: string): Promise<GLTF> => {
    // Copy into a standalone ArrayBuffer so parse() gets exactly the GLB bytes.
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return new Promise<GLTF>((resolve, reject) => {
      loader.parse(
        buffer,
        path,
        (gltf) => resolve(gltf),
        (event) => reject(new Error(errorMessage(event))),
      );
    });
  };

  async function load(request: ModelLoadRequest): Promise<ModelLoadResult> {
    if (disposed) throw new ModelLoadError('Model loader disposed', request.path);

    // 1. Fetch bytes through the core Resource Manager (single request; no second fetch).
    emitLoading(request.path, 'fetching');
    let bytes: Uint8Array;
    let url: string;
    try {
      const data = await resourceManager.load(request.path);
      bytes = data.bytes;
      url = data.url;
    } catch (error) {
      const message = errorMessage(error);
      options.events?.emit('model:error', { url: request.path, message });
      throw new ModelLoadError(message, request.path);
    }
    if (disposed) throw new ModelLoadError('Model loader disposed', url);

    // 2. Parse the GLB. GLTFLoader.parse — never .load.
    emitLoading(url, 'parsing');
    let gltf: GLTF;
    try {
      gltf = await parseGltf(bytes, resourceDirOf(url));
    } catch (error) {
      const message = errorMessage(error);
      options.events?.emit('model:error', { url, message });
      throw new ModelLoadError(message, url);
    }
    // Late result after dispose: release it, insert nothing, emit no model:loaded.
    if (disposed) {
      disposeObject(gltf.scene);
      throw new ModelLoadError('Model loader disposed', url);
    }

    // 3. Insert via the Scene Manager (it owns the scene); replace any previous model.
    emitLoading(url, 'inserting');
    removeCurrent();
    current = gltf.scene;
    scene.add(current);

    // 4. Bounding box + 5. auto-framing (headless math) + 6. sync controls.
    emitLoading(url, 'framing');
    const box3 = new THREE.Box3().setFromObject(current);
    const boundingBox: BoundingBox = box3.isEmpty()
      ? { min: [0, 0, 0], max: [0, 0, 0] }
      : boxToData(box3);

    const cam = camera.getThreeCamera();
    const persp = cam as THREE.PerspectiveCamera;
    const fovYRadians = (persp.isPerspectiveCamera ? persp.fov : 50) * DEG2RAD;
    const aspect = persp.isPerspectiveCamera ? persp.aspect : 1;
    const framing = computeCameraFraming(boundingBox, {
      fovYRadians,
      aspect,
      ...(options.framingDirection ? { direction: options.framingDirection } : {}),
      ...(options.framingMargin !== undefined ? { margin: options.framingMargin } : {}),
    });
    if (options.controls) options.controls.setView(framing.position, framing.target);
    else camera.setView(framing.position, framing.target);

    // 7. Request a render + 8. report ready.
    options.requestRender?.();
    emitLoading(url, 'ready');
    options.events?.emit('model:loaded', { url, boundingBox });
    return { url, boundingBox, framing };
  }

  return {
    load,
    dispose() {
      if (disposed) return;
      disposed = true;
      removeCurrent();
    },
  };
}
