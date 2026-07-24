// Public API of @explorer-engine/core (P0-T4 skeleton).
//
// Headless only: no DOM, no WebGL, no Three.js, no UI framework
// (ENGINE_CONSTITUTION L8/L9). This surface is deliberately minimal and grows
// with each roadmap phase.

export { createEngine } from './engine';
export type { Engine, EngineOptions, EngineLifecycleState } from './engine';

export { EventBus } from './events';
export type { EventHandler, Unsubscribe, EventBusOptions } from './events';

export { createLogger } from './diagnostics';
export type { Logger, LogLevel, LogEntry, LogSink, LoggerOptions } from './diagnostics';

export type {
  RendererPort,
  RendererConfig,
  RendererSize,
  ColorSpace,
  ToneMapping,
  ScenePort,
  BoundingBox,
  CameraPort,
  Vec3,
  ControlInput,
  InputPort,
  ColorValue,
  AmbientLightSpec,
  HemisphereLightSpec,
  DirectionalLightSpec,
  PointLightSpec,
  LightSpec,
  LightingPreset,
  LightingPort,
  BackgroundSpec,
  EnvironmentSource,
  EnvironmentSpec,
  EnvironmentPort,
  UiDescriptor,
  ToolbarItemKind,
  ToolbarItemDescriptor,
  BreadcrumbSegmentDescriptor,
  PanelBlock,
  PanelDescriptor,
  LoaderStateDescriptor,
  HotspotMarkerDescriptor,
  ShellDescriptor,
  UiAction,
  UiPort,
} from './ports';

export { createOrbitControls } from './controls';
export type { OrbitControls, OrbitControlsOptions } from './controls';

export { createRenderLoop } from './render';
export type { RenderLoop, RenderLoopOptions, FrameScheduler, FrameRequestToken } from './render';

export {
  createResourceManager,
  ResourceCancelledError,
  createCancellationSource,
  resolveResourcePath,
  isAbsolutePath,
} from './resources';
export type {
  ResourceManager,
  ResourceManagerOptions,
  ResourceTransport,
  ResourceRequest,
  ResourceData,
  TimeoutScheduler,
  CancellationSignal,
  CancellationSource,
} from './resources';

export {
  lightingPresets,
  getLightingPreset,
  STUDIO_LIGHTING,
  OUTDOOR_LIGHTING,
  NIGHT_LIGHTING,
} from './lighting';
export type { LightingPresetId } from './lighting';

export { computeCameraFraming, ModelLoadError } from './model';
export type {
  FramingOptions,
  FramingResult,
  ModelLoaderPort,
  ModelLoadRequest,
  ModelLoadResult,
  ModelLoadProgress,
  ModelLoadPhase,
  NodeDescriptor,
} from './model';

export {
  createConfigLoader,
  resolveConfigFromJson,
  ConfigError,
  environmentSpecFromConfig,
  lightingPresetIdFromConfig,
} from './config';
export type { ConfigLoader, ConfigLoaderOptions, LoadedConfig } from './config';
// Re-export the schema's public data types so hosts get them from one entry point.
export type {
  ResolvedConfig,
  ModelConfig,
  EnvironmentConfig,
  LightingConfig,
  CameraConfig,
  CameraControlsConfig,
  ComponentConfig,
  NodeRef,
  Address,
  HotspotAnchor,
  HotspotAction,
  HotspotConfig,
  EaseName,
  TransitionSpec,
  FocusOutlineConfig,
  FocusConfig,
  TransformValueConfig,
  ClipPlaneConfig,
  StateLayerConfig,
  StateCameraIntentConfig,
  StateConfig,
  ThemePreset,
  ThemeTokens,
  ThemeConfig,
  I18nText,
  I18nConfig,
  ConfigIssue,
  ValidationResult,
} from '@explorer-engine/schema';
// Re-export the schema's data-only default values used by adapters/hosts.
export {
  DEFAULT_FOCUS,
  DEFAULT_FOCUS_TRANSITION,
  EASE_NAMES,
  DEFAULT_THEME,
  DEFAULT_THEME_TOKENS_LIGHT,
  DEFAULT_THEME_TOKENS_DARK,
  DEFAULT_I18N,
} from '@explorer-engine/schema';

// Render State Resolver (chapter 19, ADR-001) — the single authority over visual state.
export {
  createRenderStateResolver,
  createComponentModel,
  nodeRefIdentity,
  composeVisualState,
  interpolateVisualState,
  visualStateEquals,
  isVisualChannel,
  isIntentChannel,
  REST_VISUAL_STATE,
} from './render-state';
export type {
  RenderStateResolver,
  RenderStateResolverOptions,
  RenderLayer,
  LayerHandle,
  LayerSource,
  ResolvedIntent,
  ComponentModel,
  RenderStatePort,
  NodeStateUpdate,
  Channel,
  VisualChannel,
  IntentChannel,
  ChannelValueMap,
  TransformValue,
  ColorOverrideValue,
  OutlineValue,
  VisibilityValue,
  ClipPlane,
  CameraIntentValue,
  LightingIntentValue,
  EffectiveVisualState,
  VisualContribution,
} from './render-state';

// Animation Engine (chapter 11, P5-T1/T2).
export {
  createAnimationEngine,
  createTween,
  numberTween,
  vec3Tween,
  createTimeline,
  sequence,
  parallel,
  resolveEasing,
  EASINGS,
  lerp,
  lerpVec3,
  clamp01,
} from './animation';
export type {
  AnimationEngine,
  AnimationEngineOptions,
  PlaybackHandle,
  PlaybackState,
  PlayOptions,
  Animation,
  TweenSpec,
  TimelineEntry,
} from './animation';

// Focus Manager (chapter 08, P5-T4).
export { createFocusManager } from './focus';
export type {
  FocusManager,
  FocusManagerOptions,
  BoundsProvider,
  FrameHint,
  FocusFrameOptions,
} from './focus';

// State Manager (chapter 09, P6-T1).
export { createStateManager } from './state';
export type { StateManager, StateManagerOptions, SerializedState } from './state';

// Theme Manager (chapter 13, P7-T1).
export { createThemeManager } from './theme';
export type {
  ThemeManager,
  ThemeManagerOptions,
  ThemeVariant,
  SystemThemePreferences,
} from './theme';

// Accessibility Service (chapter 12 §12.8.1, C17).
export { createAccessibilityService } from './a11y';
export type { AccessibilityService, AccessibilityServiceOptions } from './a11y';

// i18n Service (chapter 05 §5.3.15, chapter 12 §12.9, P7-T4).
export { createI18nService } from './i18n';
export type { I18nService, I18nServiceOptions, LocaleDictionary } from './i18n';

// Plugin Manager (chapter 02 §2.18, chapter 10, ADR-006, P8-T1).
export { createPluginManager, createPluginRenderStateFacade, PLUGIN_MIN_PRIORITY } from './plugins';
export type {
  PluginManager,
  PluginManagerOptions,
  Plugin,
  PluginContext,
  PluginRenderStateFacade,
  PluginFocusFacade,
  PluginStateFacade,
} from './plugins';

// Selection Manager (P4-T1).
export { createSelectionManager } from './selection';
export type {
  SelectionManager,
  SelectionManagerOptions,
  SelectionStyle,
  RaycasterPort,
  PickHit,
} from './selection';

// Hotspot Manager (P4-T2..T4).
export { createHotspotManager } from './hotspots';
export type {
  HotspotManager,
  HotspotManagerOptions,
  HotspotView,
  HotspotVisualState,
  ProjectionPort,
  AnchorSpec,
  ProjectionResult,
} from './hotspots';

export type {
  EngineEventMap,
  EngineDisposedEvent,
  ModelLoadingEvent,
  ModelLoadedEvent,
  ModelErrorEvent,
  FocusStartedEvent,
  FocusEndedEvent,
  StateChangingEvent,
  StateChangedEvent,
  ModifierChangedEvent,
  ThemeChangedEvent,
  A11yPoliteness,
  A11yAnnounceEvent,
  A11yNavigableEntry,
  A11yNavigableChangedEvent,
  I18nLocaleChangedEvent,
  PluginRegisteredEvent,
  PluginStartedEvent,
  PluginStoppedEvent,
  PluginDisposedEvent,
  PluginErrorPhase,
  PluginErrorEvent,
  SelectionChangedEvent,
  SelectionHoverEvent,
  HotspotActivatedEvent,
  HotspotHoverEvent,
} from './types/events';
