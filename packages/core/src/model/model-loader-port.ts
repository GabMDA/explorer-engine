// Model Loader contract (roadmap P2-T2 ; chapter 02 §2.8). Backend-agnostic and
// data-only: the Core describes *what* loading a model produces without ever
// seeing Three.js/glTF objects (Object3D, Scene, Material, Texture, GLTF…). A
// renderer adapter implements it with a real glTF loader (ENGINE_CONSTITUTION
// L8/L9). Only bytes-level identity (URLs), a bounding box and framing cross here.
import type { BoundingBox } from '../ports/scene-port';
import type { FramingResult } from './framing';

/** Ordered phases a model load goes through (honest, phase-based progress). */
export type ModelLoadPhase = 'fetching' | 'parsing' | 'inserting' | 'framing' | 'ready';

/** What to load. Minimal for P2-T2: a single self-contained GLB path. */
export interface ModelLoadRequest {
  /** Path (relative to the resource base URL) or absolute URL of the GLB. */
  readonly path: string;
}

/** A phase-based progress update (no per-byte network percentage). */
export interface ModelLoadProgress {
  /** Resolved URL of the model being loaded. */
  readonly url: string;
  /** The phase just entered. */
  readonly phase: ModelLoadPhase;
}

/** Data-only summary of a successfully loaded model. */
export interface ModelLoadResult {
  /** Resolved URL the model came from. */
  readonly url: string;
  /** Axis-aligned bounding box of the inserted model. */
  readonly boundingBox: BoundingBox;
  /** The framing computed and applied for this model. */
  readonly framing: FramingResult;
}

/** Public, data-only error for a failed model load (no backend objects). */
export class ModelLoadError extends Error {
  constructor(
    message: string,
    readonly url: string,
  ) {
    super(message);
    this.name = 'ModelLoadError';
  }
}

/**
 * Loads a model and inserts it into a scene. A renderer adapter implements it;
 * the Core drives it through this contract without knowing the backend.
 */
export interface ModelLoaderPort {
  /** Load, parse, insert and frame the model at `request.path`. */
  load(request: ModelLoadRequest): Promise<ModelLoadResult>;
  /** Remove and release the current model, and block further loads. Idempotent. */
  dispose(): void;
}
