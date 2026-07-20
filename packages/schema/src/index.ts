// Public API of @explorer-engine/schema (P3-T1). Headless, data-only, zero deps.
export { validateConfig } from './validate';
export { migrateConfig } from './migrate';
export {
  SCHEMA_VERSION,
  SUPPORTED_SCHEMA_MAJORS,
  DEFAULT_META,
  DEFAULT_ENVIRONMENT,
  DEFAULT_LIGHTING,
  DEFAULT_CAMERA,
  DEFAULT_CONTROLS,
  MODEL_DEFAULTS,
} from './defaults';
export type { MigrationResult } from './migrate';
export type {
  BackgroundConfig,
  LightingPresetId,
  EnvironmentSourceId,
  MetaConfig,
  ModelConfig,
  EnvironmentConfig,
  LightingConfig,
  CameraControlsConfig,
  CameraConfig,
  NodeRef,
  Address,
  ComponentConfig,
  HotspotAnchor,
  HotspotAction,
  HotspotConfig,
  ResolvedConfig,
  ConfigIssue,
  ValidationResult,
} from './types';
