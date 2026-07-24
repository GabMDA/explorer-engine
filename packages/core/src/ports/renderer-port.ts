// RendererPort — the contract the headless core uses to drive a 3D renderer,
// without knowing anything about WebGL, Three.js or the DOM (ENGINE_CONSTITUTION
// L8/L9 ; ADR-002). A concrete adapter (e.g. @explorer-engine/renderer-three)
// implements this port; the host owns the canvas and constructs the adapter.
//
// Canvas ownership stays in the adapter, so this interface exposes only DOM-free
// runtime operations.
import type { ScenePort } from './scene-port';
import type { CameraPort } from './camera-port';

/** Output color space of the rendered image. */
export type ColorSpace = 'srgb' | 'srgb-linear';

/** Tone mapping operator applied before display. */
export type ToneMapping = 'none' | 'linear' | 'aces-filmic' | 'agx' | 'neutral';

/** Declarative renderer configuration (plain data — no DOM types). */
export interface RendererConfig {
  readonly colorSpace?: ColorSpace;
  readonly toneMapping?: ToneMapping;
  readonly toneMappingExposure?: number;
  readonly antialias?: boolean;
  readonly alpha?: boolean;
  /** Clear color as a CSS color string or 0xRRGGBB number. */
  readonly clearColor?: string | number;
  readonly clearAlpha?: number;
  /** Explicit device pixel ratio. When omitted the adapter derives it (capped). */
  readonly pixelRatio?: number;
  /** Upper bound applied to a derived pixel ratio. Defaults to 2 (chapter 14). */
  readonly maxPixelRatio?: number;
}

/** Drawing-buffer size in CSS pixels. */
export interface RendererSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Renderer statistics for a recent frame (chapter 14 §14.8 instrumentation).
 * Optional and backend-dependent — a value here is only ever a hint for
 * diagnostics/quality decisions, never load-bearing for correctness.
 */
export interface RendererStats {
  /** Draw calls issued for the last rendered frame. */
  readonly drawCalls: number;
  /** Triangles submitted for the last rendered frame. */
  readonly triangles: number;
  /** Geometries currently retained in GPU memory. */
  readonly geometries: number;
  /** Textures currently retained in GPU memory. */
  readonly textures: number;
  /** Compiled shader programs. `null` when the backend doesn't track it. */
  readonly programs: number | null;
}

/**
 * A renderer the core can size, draw and tear down. Backend-agnostic.
 * `render` draws a {@link ScenePort} through a {@link CameraPort}; both handles
 * are produced by the same adapter (the core never sees the backend objects).
 */
export interface RendererPort {
  /** Resize the drawing buffer (CSS pixels; pixel ratio applied internally). */
  setSize(width: number, height: number): void;
  /** Set the device pixel ratio. */
  setPixelRatio(pixelRatio: number): void;
  /** Current drawing-buffer size in CSS pixels. */
  getSize(): RendererSize;
  /** Current device pixel ratio. */
  getPixelRatio(): number;
  /** Render one frame: draw `scene` as seen by `camera`. */
  render(scene: ScenePort, camera: CameraPort): void;
  /**
   * Optional renderer statistics (ch.14 §14.8). A backend that cannot track
   * this simply omits the method — callers MUST treat a missing `getStats`
   * exactly like a `null`/absent reading (ENGINE_CONSTITUTION L23), never as
   * an error. Fully backward-compatible: existing `RendererPort` implementers
   * need no change.
   */
  getStats?(): RendererStats;
  /** Release all GPU resources and the rendering context. Idempotent. */
  dispose(): void;
}
