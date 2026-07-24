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

/**
 * Bounded set of easing names (chapter 11 §11.4). Referenced by name in config
 * transitions; validated against this closed set. Extended additively.
 */
export type EaseName =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  | 'easeInBack'
  | 'easeOutBack'
  | 'easeOutElastic'
  | 'easeOutBounce';

/**
 * A resolved transition spec (chapter 05 §5.4). Durations/delays are in ms and
 * always ≥ 0 after validation; `easing` is a valid {@link EaseName}.
 */
export interface TransitionSpec {
  readonly duration: number;
  readonly easing: EaseName;
  readonly delay: number;
}

/** Resolved outline style for focus highlighting (chapter 08 §8.4). */
export interface FocusOutlineConfig {
  readonly enabled: boolean;
  readonly color: string;
  readonly thickness: number;
}

/**
 * Resolved global Focus settings (chapter 05 §5.3.10, chapter 08 §8.9). The v1
 * `restoreOnExit` is gone — focus return is intrinsic to layer removal (C1/C4).
 */
export interface FocusConfig {
  /** Framing zoom-out margin around the target (> 1). */
  readonly padding: number;
  /** Dim the rest of the scene while focused. */
  readonly dimOthers: boolean;
  /** Opacity applied to non-targeted components when dimming (∈ [0,1]). */
  readonly dimOpacity: number;
  readonly outline: FocusOutlineConfig;
  /** Fully hide (instead of dim) the rest of the scene. */
  readonly isolate: boolean;
  readonly transition: TransitionSpec;
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

// --- States (chapter 09) — declarative, layer-based, transforms ABSOLUTE ---------

/** Absolute transform offset from the rest pose (chapter 19 §19.3.3; no `relative`). */
export interface TransformValueConfig {
  readonly translate?: readonly [number, number, number];
  readonly rotate?: readonly [number, number, number];
  readonly scale?: number | readonly [number, number, number];
}

/** A half-space clipping plane for cutaway (chapter 09 §9.2.1). */
export interface ClipPlaneConfig {
  readonly normal: readonly [number, number, number];
  readonly offset: number;
}

/**
 * A layer a state publishes to the resolver (chapter 05 §5.3.9, chapter 09 §9.4).
 * Discriminated by `channel`; targets are typed Addresses (C5). `transform` values
 * are ABSOLUTE offsets from the rest pose — the v1 `relative` flag is rejected.
 */
export type StateLayerConfig =
  | {
      readonly target: Address;
      readonly channel: 'transform';
      readonly value: TransformValueConfig;
    }
  | { readonly target: Address; readonly channel: 'opacity'; readonly value: number }
  | {
      readonly target: Address;
      readonly channel: 'colorOverride';
      readonly value: { readonly color: string; readonly intensity: number };
    }
  | {
      readonly target: Address;
      readonly channel: 'visibility';
      readonly value: 'visible' | 'hidden';
    }
  | {
      readonly target: Address;
      readonly channel: 'clip';
      readonly value: readonly ClipPlaneConfig[];
    };

/** A state's camera intent — an inline pose (chapter 09 §9.4). Priority `state`. */
export interface StateCameraIntentConfig {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

/**
 * A declarative state (chapter 09 §9.4). `region: 'base'` = mutually-exclusive main
 * region; any other string = a parallel modifier region (X-ray, cutaway…). Activating
 * a state PUBLISHES its layers; leaving it REMOVES them (recomposition, never restore).
 */
export interface StateConfig {
  readonly id: string;
  readonly label: string;
  /** `'base'` (exclusive main region) or a modifier region id (parallel). */
  readonly region: string;
  /** Allowed source bases (bases only); `null` = any. */
  readonly allowedFrom: readonly string[] | null;
  /** Modifier region ids (or state ids) this state is mutually exclusive with. */
  readonly excludes: readonly string[];
  readonly layers: readonly StateLayerConfig[];
  readonly cameraIntent: StateCameraIntentConfig | null;
  readonly transition: TransitionSpec | null;
}

// --- Theme (chapter 05 §5.3.12, chapter 13) — design tokens, cascade resolution --

/** Theme base; `'auto'` follows `prefers-color-scheme` at runtime (ch.13 §13.4). */
export type ThemePreset = 'light' | 'dark' | 'auto';

/** Flat design-token overrides (semantic/component level, ch.13 §13.2.1). */
export type ThemeTokens = Readonly<Record<string, string>>;

/**
 * A package's theme customization (ch.13 §13.7). Resolution is a CASCADE (engine
 * default → `preset` → `tokens`/`hotspotStyle` overrides → runtime system
 * preferences) performed by the headless Theme Manager, never here — this is only
 * the package's declared intent.
 */
export interface ThemeConfig {
  readonly preset: ThemePreset;
  readonly tokens: ThemeTokens;
  /** Style overrides for hotspot markers specifically (ch.05 §5.3.12). */
  readonly hotspotStyle: ThemeTokens;
}

// --- i18n (chapter 05 §5.3.15) — explicit key form only (v2, C17) ----------------

/**
 * A displayable string: either a literal, or an explicit i18n key. The v1 `"@key"`
 * prefix heuristic is gone (ambiguous) — v2 requires the explicit `{ $t }` form.
 */
export type I18nText = string | { readonly $t: string };

export interface I18nConfig {
  /** Available languages; defaults to `[meta.defaultLocale]`. */
  readonly locales: readonly string[];
  /** Translation file per locale (`locales/*.json`), resolved by the Config Loader. */
  readonly sources: Readonly<Record<string, string>>;
}

// --- Performance & quality (chapter 05, chapter 14) — measurement budgets and ---
// the discrete quality tiers the adaptive Quality Manager degrades/upgrades between.

/** A frame budget for one device class (chapter 14 §14.1.1). */
export interface PerformanceBudgetConfig {
  /** Target frames per second for this device class. */
  readonly targetFps: number;
  /** Per-frame time budget in ms; exceeding it repeatedly triggers a quality downgrade. */
  readonly frameBudgetMs: number;
}

/**
 * Measurement configuration (chapter 05, chapter 14 §14.1.1/§14.8). Desktop and
 * mobile budgets are both declared; picking which applies to the current device
 * is a host/adapter concern (headless core does no device sniffing, L1/L8).
 */
export interface PerformanceConfig {
  readonly desktop: PerformanceBudgetConfig;
  readonly mobile: PerformanceBudgetConfig;
  /** Whether the developer performance/quality overlay is enabled (ch.14 §14.8). */
  readonly overlay: boolean;
}

/** A discrete quality tier, low to high (chapter 14 §14.2.2/§14.3). */
export type QualityLevel = 'low' | 'medium' | 'high';

/** The renderer levers a quality tier drives — only levers the ports already expose. */
export interface QualityLeverConfig {
  /** Upper bound applied to the device pixel ratio at this tier (ch.14 §14.3). */
  readonly maxPixelRatio: number;
}

/**
 * Adaptive-quality configuration (chapter 05, chapter 14 §14.2.2). `levels` maps
 * every {@link QualityLevel} to the lever values applied when that tier is active.
 */
export interface QualityConfig {
  /** Enable automatic degrade/upgrade based on measured frame budget. */
  readonly adaptive: boolean;
  readonly initialLevel: QualityLevel;
  readonly levels: Readonly<Record<QualityLevel, QualityLeverConfig>>;
}

// --- Plugins (chapter 05 §5.3.1bis/§5.3.14, chapter 10, ADR-006) ----------------

/**
 * A capability a package expects from the runtime (ch.05 §5.3.1bis, C8). A
 * missing `required` capability disables the dependent feature (with a
 * diagnostic, never a global failure); a missing `optional` one is ignored.
 * Capabilities name a runtime-provided ABILITY (e.g. `"scenario"`, `"measure"`),
 * never a concrete plugin id — this is what keeps a package portable across any
 * runtime that satisfies its declared capability profile.
 */
export interface Capability {
  readonly id: string;
  readonly level: 'required' | 'optional';
}

/**
 * A package's activation/configuration of a plugin already REGISTERED by the
 * runtime (ch.05 §5.3.14, ch.10 §10.5.1). A package never supplies plugin code —
 * only its id and options.
 */
export interface PluginEntry {
  readonly id: string;
  readonly enabled: boolean;
  readonly options: Readonly<Record<string, unknown>>;
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
  readonly focus: FocusConfig;
  readonly states: readonly StateConfig[];
  /** Base state entered at load (chapter 09 §9.9); `null` = rest pose. */
  readonly initialState: string | null;
  readonly theme: ThemeConfig;
  readonly i18n: I18nConfig;
  readonly performance: PerformanceConfig;
  readonly quality: QualityConfig;
  readonly requiredCapabilities: readonly Capability[];
  readonly plugins: readonly PluginEntry[];
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
