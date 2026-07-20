// Default values for every optional config section (chapter 05 §5.1: "safe by
// default" — a minimal config.json must produce a correct experience).
import type {
  MetaConfig,
  EnvironmentConfig,
  LightingConfig,
  CameraConfig,
  CameraControlsConfig,
  EaseName,
  TransitionSpec,
  FocusConfig,
} from './types';

/** The schema version this build implements. */
export const SCHEMA_VERSION = '1.0';

/** Schema MAJORS this engine can consume (§5.3.1 compatibility policy). */
export const SUPPORTED_SCHEMA_MAJORS: readonly string[] = ['1'];

export const DEFAULT_META: MetaConfig = { defaultLocale: 'en' };

export const DEFAULT_ENVIRONMENT: EnvironmentConfig = {
  background: { kind: 'gradient', top: '#2a3350', bottom: '#0a0b12' },
  source: 'neutral-room',
  intensity: 1,
};

export const DEFAULT_LIGHTING: LightingConfig = { preset: 'studio' };

export const DEFAULT_CONTROLS: CameraControlsConfig = {
  minDistance: 0.1,
  maxDistance: 100,
  enablePan: true,
  enableZoom: true,
};

export const DEFAULT_CAMERA: CameraConfig = {
  fov: 50,
  controls: DEFAULT_CONTROLS,
};

export const MODEL_DEFAULTS = {
  draco: true,
  ktx2: true,
  meshopt: true,
  frameOnLoad: true,
} as const;

/** All valid easing names (chapter 11 §11.4), for validation of the closed set. */
export const EASE_NAMES: readonly EaseName[] = [
  'linear',
  'easeIn',
  'easeOut',
  'easeInOut',
  'easeInQuad',
  'easeOutQuad',
  'easeInOutQuad',
  'easeInCubic',
  'easeOutCubic',
  'easeInOutCubic',
  'easeInBack',
  'easeOutBack',
  'easeOutElastic',
  'easeOutBounce',
];

/** Default focus transition (chapter 05 §5.3.10): 600 ms easeInOut. */
export const DEFAULT_FOCUS_TRANSITION: TransitionSpec = {
  duration: 600,
  easing: 'easeInOut',
  delay: 0,
};

export const DEFAULT_FOCUS: FocusConfig = {
  padding: 1.2,
  dimOthers: true,
  dimOpacity: 0.15,
  outline: { enabled: true, color: '#3ba7ff', thickness: 1 },
  isolate: false,
  transition: DEFAULT_FOCUS_TRANSITION,
};
