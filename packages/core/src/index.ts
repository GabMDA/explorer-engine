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
} from './ports';

export type { EngineEventMap, EngineDisposedEvent } from './types/events';
