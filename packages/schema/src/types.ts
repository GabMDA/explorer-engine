// Normative config.json types (chapter 05). Data-only, headless (no DOM/Three.js).
// This is the SUBSET the engine consumes today (P3-T1): meta, model, environment,
// lighting, camera, components. Later sections (hotspots, states, focus, ui, theme,
// animations, plugins, i18n) are added ADDITIVELY as their consumers land — a new
// optional section is a minor schema bump (§5.3.1).

/** A background, as a data-only union (mirrors the renderer EnvironmentSpec). */
export type BackgroundConfig =
  | { readonly kind: 'color'; readonly color: string }
  | { readonly kind: 'gradient'; readonly top: string; readonly bottom: string }
  | { readonly kind: 'transparent' };

/** Built-in lighting preset ids the engine ships (chapter 05 §5.3.5). */
export type LightingPresetId = 'studio' | 'outdoor' | 'night';

/** Image-based-lighting source (chapter 05 §5.3.4). */
export type EnvironmentSourceId = 'none' | 'neutral-room';

export interface MetaConfig {
  readonly title?: string;
  readonly description?: string;
  readonly defaultLocale?: string;
}

export interface ModelConfig {
  readonly src: string;
  readonly draco: boolean;
  readonly ktx2: boolean;
  readonly meshopt: boolean;
  readonly frameOnLoad: boolean;
}

export interface EnvironmentConfig {
  readonly background: BackgroundConfig;
  readonly source: EnvironmentSourceId;
  readonly intensity: number;
}

export interface LightingConfig {
  readonly preset: LightingPresetId;
}

export interface CameraControlsConfig {
  readonly minDistance: number;
  readonly maxDistance: number;
  readonly enablePan: boolean;
  readonly enableZoom: boolean;
}

export interface CameraConfig {
  readonly fov: number;
  readonly controls: CameraControlsConfig;
}

/** A reference to a model node — `explorerId` recommended, `name` = fragile fallback. */
export type NodeRef = { readonly explorerId: string } | { readonly name: string };

export interface ComponentConfig {
  readonly id: string;
  readonly label?: string;
  readonly nodes: readonly NodeRef[];
  readonly selectable: boolean;
  readonly group: string | null;
}

/**
 * A fully-defaulted, validated configuration. This is what the Config Loader
 * produces (immutable). Every optional input field has been resolved to a value.
 */
export interface ResolvedConfig {
  readonly schemaVersion: string;
  readonly meta: MetaConfig;
  readonly model: ModelConfig;
  readonly environment: EnvironmentConfig;
  readonly lighting: LightingConfig;
  readonly camera: CameraConfig;
  readonly components: readonly ComponentConfig[];
}

/** A single validation problem, addressed by a JSON-ish path. */
export interface ConfigIssue {
  readonly path: string;
  readonly message: string;
}

/** Outcome of {@link validateConfig}. */
export interface ValidationResult {
  readonly ok: boolean;
  /** Present iff `ok` — the fully-defaulted, validated config. */
  readonly value?: ResolvedConfig;
  /** Blocking problems (config rejected). */
  readonly errors: readonly ConfigIssue[];
  /** Non-blocking problems (e.g. node referenced by fragile name). */
  readonly warnings: readonly ConfigIssue[];
}
