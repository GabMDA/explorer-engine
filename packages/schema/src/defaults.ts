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
  ThemeConfig,
  ThemeTokens,
  I18nConfig,
  InstancingConfig,
  PerformanceConfig,
  QualityConfig,
  QualityLevel,
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

export const DEFAULT_INSTANCING: InstancingConfig = { enabled: true, minCount: 3 };

export const MODEL_DEFAULTS = {
  draco: true,
  ktx2: true,
  meshopt: true,
  frameOnLoad: true,
  instancing: DEFAULT_INSTANCING,
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

// --- Theme (chapter 13 §13.2.2) — engine default design tokens, both accessible
// (WCAG 2.1 AA verified for colorText/colorBackground/colorSurface — see
// defaults.test.ts). Non-exhaustive: new tokens are added additively (§13.8).

export const DEFAULT_THEME_TOKENS_LIGHT: ThemeTokens = {
  colorAccent: '#0b63ce',
  colorBackground: '#ffffff',
  colorSurface: '#f5f6f8',
  colorText: '#14161a',
  colorTextMuted: '#4b515c',
  colorBorder: '#d8dbe2',
  colorSuccess: '#1e7d34',
  colorWarning: '#8a5b00',
  colorDanger: '#c62828',
  fontFamily: "'Inter', system-ui, sans-serif",
  fontSizeSm: '13px',
  fontSizeMd: '15px',
  fontSizeLg: '20px',
  fontWeightRegular: '400',
  fontWeightMedium: '500',
  fontWeightBold: '700',
  lineHeightTight: '1.2',
  lineHeightBase: '1.5',
  'space-1': '4px',
  'space-2': '8px',
  'space-3': '12px',
  'space-4': '16px',
  'space-6': '24px',
  'space-8': '32px',
  radiusSm: '4px',
  radiusMd: '8px',
  radiusLg: '16px',
  radiusFull: '9999px',
  shadowSm: '0 1px 2px rgba(0,0,0,0.08)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.12)',
  shadowLg: '0 12px 32px rgba(0,0,0,0.18)',
  borderWidth: '1px',
  borderColor: '#d8dbe2',
  durationFast: '120ms',
  durationBase: '240ms',
  durationSlow: '400ms',
  easingDefault: 'ease-in-out',
  zIndexHotspot: '10',
  zIndexToolbar: '20',
  zIndexPanel: '30',
  zIndexModal: '40',
  iconSize: '20px',
  sceneBackground: '#f5f6f8',
  hotspotColor: '#0b63ce',
  hotspotColorActive: '#0b63ce',
  hotspotSize: '14px',
  outlineColor: '#3ba7ff',
  outlineThickness: '2px',
};

export const DEFAULT_THEME_TOKENS_DARK: ThemeTokens = {
  ...DEFAULT_THEME_TOKENS_LIGHT,
  colorAccent: '#5db3ff',
  colorBackground: '#111216',
  colorSurface: '#1b1d22',
  colorText: '#f5f5f0',
  colorTextMuted: '#a7acb8',
  colorBorder: '#33363e',
  colorSuccess: '#4caf50',
  colorWarning: '#e0a72e',
  colorDanger: '#ef5350',
  shadowSm: '0 1px 2px rgba(0,0,0,0.4)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.45)',
  shadowLg: '0 12px 32px rgba(0,0,0,0.5)',
  borderColor: '#33363e',
  sceneBackground: '#111216',
  hotspotColor: '#5db3ff',
  hotspotColorActive: '#5db3ff',
};

export const DEFAULT_THEME: ThemeConfig = { preset: 'auto', tokens: {}, hotspotStyle: {} };

export const DEFAULT_I18N: I18nConfig = { locales: [], sources: {} };

// --- Performance & quality (chapter 14 §14.1.1/§14.3/§14.9) ---------------------

/** Ordered low → high (chapter 14 §14.2.2 degrade/upgrade direction). */
export const QUALITY_LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high'];

export const DEFAULT_PERFORMANCE: PerformanceConfig = {
  desktop: { targetFps: 60, frameBudgetMs: 16.6 },
  mobile: { targetFps: 30, frameBudgetMs: 33.3 },
  overlay: false,
};

export const DEFAULT_QUALITY: QualityConfig = {
  adaptive: true,
  initialLevel: 'high',
  levels: {
    // Pixel ratio caps (ch.14 §14.3 "plafonné ≤2" / §14.9 "plafonné plus bas" mobile).
    low: { maxPixelRatio: 1 },
    medium: { maxPixelRatio: 1.5 },
    high: { maxPixelRatio: 2 },
  },
};
