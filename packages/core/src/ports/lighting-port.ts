// Lighting contracts (chapter 02 §2.7). Backend-agnostic and data-only: the core
// describes *what* lighting a scene should have as plain data; a renderer adapter
// (e.g. @explorer-engine/renderer-three) turns these specs into real lights. No
// DOM, no WebGL, no Three.js here (ENGINE_CONSTITUTION L8/L9).

/** A color as a CSS color string or a 0xRRGGBB number (no backend Color type). */
export type ColorValue = string | number;

/** Uniform, direction-less fill light. */
export interface AmbientLightSpec {
  readonly kind: 'ambient';
  readonly color?: ColorValue;
  readonly intensity?: number;
}

/** Sky/ground gradient ambient light. */
export interface HemisphereLightSpec {
  readonly kind: 'hemisphere';
  readonly skyColor?: ColorValue;
  readonly groundColor?: ColorValue;
  readonly intensity?: number;
}

/** Parallel light shining from `position` toward the origin (sun/key light). */
export interface DirectionalLightSpec {
  readonly kind: 'directional';
  readonly color?: ColorValue;
  readonly intensity?: number;
  /** World position the light shines *from*. Defaults to `[0, 1, 0]`. */
  readonly position?: readonly [number, number, number];
}

/** Omnidirectional light emitted from a point in space. */
export interface PointLightSpec {
  readonly kind: 'point';
  readonly color?: ColorValue;
  readonly intensity?: number;
  readonly position?: readonly [number, number, number];
  /** Maximum range (0 = no limit). */
  readonly distance?: number;
  /** Physical falloff exponent. Defaults to the backend default. */
  readonly decay?: number;
}

/** A single light, discriminated by `kind`. Pure data. */
export type LightSpec =
  AmbientLightSpec | HemisphereLightSpec | DirectionalLightSpec | PointLightSpec;

/** A named, data-only lighting setup selectable by config or state. */
export interface LightingPreset {
  /** Stable identifier (e.g. `"studio"`). */
  readonly id: string;
  /** The lights that make up this preset. */
  readonly lights: readonly LightSpec[];
}

/**
 * Applies a {@link LightingPreset} to a scene. A renderer adapter implements it;
 * the core drives it through this contract without knowing the backend.
 */
export interface LightingPort {
  /**
   * Replace the currently applied lights with those of `preset`. Any lights from
   * a previous preset are removed and disposed first (no accumulation, no leak).
   */
  apply(preset: LightingPreset): void;
  /** Remove and dispose every light owned by this manager. Idempotent. */
  dispose(): void;
}
