// Environment contracts (chapter 02 §2.9). Backend-agnostic and data-only: the
// core describes the scene background and the image-based lighting (IBL) source
// as plain data; a renderer adapter realizes them. No DOM/WebGL/Three.js here
// (ENGINE_CONSTITUTION L8/L9). Per correction C6, Lighting and Environment do not
// reference each other — both simply describe/apply data on the shared scene.
import type { ColorValue } from './lighting-port';

/**
 * The scene background, as a pure-data union:
 * - `color` — a single flat color;
 * - `gradient` — a vertical `top`→`bottom` gradient;
 * - `transparent` — no background (the renderer clear color/alpha shows through).
 */
export type BackgroundSpec =
  | { readonly kind: 'color'; readonly color: ColorValue }
  | { readonly kind: 'gradient'; readonly top: ColorValue; readonly bottom: ColorValue }
  | { readonly kind: 'transparent' };

/**
 * Image-based lighting source. This first version ships only in-code sources
 * (no external HDR/asset): `neutral-room` is a procedurally generated neutral
 * studio environment giving credible PBR reflections.
 */
export type EnvironmentSource = 'none' | 'neutral-room';

/** Declarative environment configuration — background plus optional IBL. */
export interface EnvironmentSpec {
  /** How the scene background is drawn. */
  readonly background: BackgroundSpec;
  /** IBL source used for PBR reflections. Defaults to `'none'`. */
  readonly environment?: EnvironmentSource;
  /** Multiplier applied to the environment's contribution. Defaults to `1`. */
  readonly environmentIntensity?: number;
}

/**
 * Applies an {@link EnvironmentSpec} to a scene. A renderer adapter implements
 * it; the core drives it through this contract without knowing the backend.
 */
export interface EnvironmentPort {
  /**
   * Apply `config`, replacing any previous background/environment. Resources held
   * by the previous configuration (textures, generated env maps) are disposed.
   */
  apply(config: EnvironmentSpec): void;
  /** Remove and dispose the background/environment resources. Idempotent. */
  dispose(): void;
}
