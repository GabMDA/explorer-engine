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

/**
 * Typed target address (chapter 05 §5.4, C5 / L13). Replaces the v1 string
 * prefixes (`"group:internals"`). Used by hotspots/states/focus/plugins to point
 * at a logical entity. For `kind: 'node'`, `id` is a node identity (explorerId
 * preferred, node name as fragile fallback).
 */
export interface Address {
  readonly kind: 'component' | 'group' | 'node';
  readonly id: string;
}

export interface ComponentConfig {
  readonly id: string;
  readonly label?: string;
  readonly nodes: readonly NodeRef[];
  readonly selectable: boolean;
  /**
   * Pick granularity (chapter 05 §5.3.7): the component id a click on this
   * component resolves to. Defaults to the component's own id (`self`).
   */
  readonly pickTarget: string;
  readonly group: string | null;
}

/** Hotspot anchoring (chapter 07 §7.2.2, chapter 05 §5.3.8). Typed (C5). */
export type HotspotAnchor =
  | { readonly kind: 'component'; readonly id: string }
  | { readonly kind: 'group'; readonly id: string }
  | { readonly kind: 'node'; readonly id: string }
  | { readonly kind: 'position'; readonly position: readonly [number, number, number] };

/**
 * What a hotspot does on activation (chapter 05 §5.3.8, chapter 07 §7.5.2). The
 * subset the engine consumes today; extended additively as modules land. Camera
 * focus and state changes resolve through the same typed addresses/ids.
 */
export type HotspotAction =
  | { readonly type: 'focus'; readonly target: Address }
  | { readonly type: 'emit'; readonly event: string }
  | { readonly type: 'goToState'; readonly state: string };

export interface HotspotConfig {
  readonly id: string;
  readonly label: string;
  readonly anchor: HotspotAnchor;
  /** Optional constant offset from the anchor, in model space. */
  readonly offset: readonly [number, number, number] | null;
  readonly action: HotspotAction;
  /** States this hotspot is visible in; `null` = all states. */
  readonly visibleInStates: readonly string[] | null;
  /** Hide/dim when occluded by geometry (chapter 07 §7.4). */
  readonly occludable: boolean;
  /** Overlap/clustering resolution order (chapter 07 §7.6.2). */
  readonly priority: number;
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
  readonly hotspots: readonly HotspotConfig[];
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
