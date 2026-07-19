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
  /** Release all GPU resources and the rendering context. Idempotent. */
  dispose(): void;
}
