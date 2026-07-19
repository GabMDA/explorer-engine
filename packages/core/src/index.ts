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

export type { EngineEventMap, EngineDisposedEvent } from './types/events';
