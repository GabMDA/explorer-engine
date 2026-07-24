// Hand-rolled, zero-dependency config validator (chapter 05). Produces a fully
// defaulted, immutable ResolvedConfig, plus blocking errors and non-blocking
// warnings (e.g. a node referenced by fragile name, ADR-003 / L12). Headless and
// data-only. Deterministic — no schema library, full control over messages.
import type {
  Address,
  BackgroundConfig,
  CameraConfig,
  Capability,
  ClipPlaneConfig,
  ComponentConfig,
  ConfigIssue,
  EaseName,
  EnvironmentConfig,
  EnvironmentSourceId,
  FocusConfig,
  FocusOutlineConfig,
  HotspotAction,
  HotspotAnchor,
  HotspotConfig,
  I18nConfig,
  I18nText,
  InstancingConfig,
  LightingConfig,
  LightingPresetId,
  MetaConfig,
  ModelConfig,
  NodeRef,
  PerformanceBudgetConfig,
  PerformanceConfig,
  PluginEntry,
  QualityConfig,
  QualityLevel,
  QualityLeverConfig,
  ResolvedConfig,
  StateCameraIntentConfig,
  StateConfig,
  StateLayerConfig,
  ThemeConfig,
  ThemePreset,
  ThemeTokens,
  TransformValueConfig,
  TransitionSpec,
  ValidationResult,
} from './types';
import {
  DEFAULT_CAMERA,
  DEFAULT_ENVIRONMENT,
  DEFAULT_FOCUS,
  DEFAULT_FOCUS_TRANSITION,
  DEFAULT_I18N,
  DEFAULT_LIGHTING,
  DEFAULT_META,
  DEFAULT_PERFORMANCE,
  DEFAULT_QUALITY,
  DEFAULT_THEME,
  DEFAULT_THEME_TOKENS_DARK,
  DEFAULT_THEME_TOKENS_LIGHT,
  EASE_NAMES,
  MODEL_DEFAULTS,
  QUALITY_LEVELS,
  SUPPORTED_SCHEMA_MAJORS,
} from './defaults';
import { meetsWcagAaNormalText } from './color-contrast';

const KNOWN_KEYS = new Set([
  'schemaVersion',
  'meta',
  'model',
  'environment',
  'lighting',
  'camera',
  'components',
  'hotspots',
  'focus',
  'states',
  'initialState',
  'theme',
  'i18n',
  'performance',
  'quality',
  'requiredCapabilities',
  'plugins',
]);
const CAPABILITY_LEVELS = ['required', 'optional'] as const;
const THEME_PRESETS: readonly ThemePreset[] = ['light', 'dark', 'auto'];
const LIGHTING_PRESETS: readonly LightingPresetId[] = ['studio', 'outdoor', 'night'];
const ENV_SOURCES: readonly EnvironmentSourceId[] = ['none', 'neutral-room'];

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';

class Ctx {
  readonly errors: ConfigIssue[] = [];
  readonly warnings: ConfigIssue[] = [];
  error(path: string, message: string): void {
    this.errors.push({ path, message });
  }
  warn(path: string, message: string): void {
    this.warnings.push({ path, message });
  }
  bool(v: unknown, path: string, fallback: boolean): boolean {
    if (v === undefined) return fallback;
    if (!isBoolean(v)) {
      this.error(path, 'must be a boolean');
      return fallback;
    }
    return v;
  }
  num(v: unknown, path: string, fallback: number): number {
    if (v === undefined) return fallback;
    if (!isNumber(v)) {
      this.error(path, 'must be a finite number');
      return fallback;
    }
    return v;
  }
  str(v: unknown, path: string, fallback: string): string {
    if (v === undefined) return fallback;
    if (!isString(v)) {
      this.error(path, 'must be a string');
      return fallback;
    }
    return v;
  }
  /** A displayable string: a literal, or an explicit `{ $t: key }` i18n reference (§5.3.15). */
  i18nText(v: unknown, path: string, fallback: I18nText): I18nText {
    if (v === undefined) return fallback;
    if (isString(v)) return v;
    if (isObject(v) && isString(v['$t'])) return { $t: v['$t'] };
    this.error(path, 'must be a string or { $t: string }');
    return fallback;
  }
  /** Bounded number: out-of-range → clamp + warning (§5.6 rule 6). */
  numClamped(v: unknown, path: string, fallback: number, min: number, max: number): number {
    const n = this.num(v, path, fallback);
    if (n < min || n > max) {
      const clamped = Math.min(max, Math.max(min, n));
      this.warn(path, `must be within [${min}, ${max}] — clamped to ${clamped}`);
      return clamped;
    }
    return n;
  }
}

function validateTransition(
  ctx: Ctx,
  raw: unknown,
  path: string,
  fallback: TransitionSpec,
): TransitionSpec {
  if (raw === undefined) return fallback;
  if (!isObject(raw)) {
    ctx.error(path, 'must be a transition object { duration, easing?, delay? }');
    return fallback;
  }
  let easing = fallback.easing;
  if (raw['easing'] !== undefined) {
    if (EASE_NAMES.includes(raw['easing'] as EaseName)) easing = raw['easing'] as EaseName;
    else ctx.error(`${path}.easing`, `must be one of ${EASE_NAMES.join(' | ')}`);
  }
  return {
    duration: ctx.numClamped(raw['duration'], `${path}.duration`, fallback.duration, 0, 60000),
    easing,
    delay: ctx.numClamped(raw['delay'], `${path}.delay`, fallback.delay, 0, 60000),
  };
}

function validateFocusOutline(ctx: Ctx, raw: unknown): FocusOutlineConfig {
  const d = DEFAULT_FOCUS.outline;
  if (raw === undefined) return d;
  if (isBoolean(raw)) return { ...d, enabled: raw };
  if (!isObject(raw)) {
    ctx.error('focus.outline', 'must be a boolean or an object { color?, thickness? }');
    return d;
  }
  return {
    enabled: ctx.bool(raw['enabled'], 'focus.outline.enabled', true),
    color: ctx.str(raw['color'], 'focus.outline.color', d.color),
    thickness: ctx.numClamped(raw['thickness'], 'focus.outline.thickness', d.thickness, 0, 16),
  };
}

function validateFocus(ctx: Ctx, raw: unknown): FocusConfig {
  if (raw === undefined) return DEFAULT_FOCUS;
  if (!isObject(raw)) {
    ctx.error('focus', 'must be an object');
    return DEFAULT_FOCUS;
  }
  return {
    padding: ctx.numClamped(raw['padding'], 'focus.padding', DEFAULT_FOCUS.padding, 1, 10),
    dimOthers: ctx.bool(raw['dimOthers'], 'focus.dimOthers', DEFAULT_FOCUS.dimOthers),
    dimOpacity: ctx.numClamped(
      raw['dimOpacity'],
      'focus.dimOpacity',
      DEFAULT_FOCUS.dimOpacity,
      0,
      1,
    ),
    outline: validateFocusOutline(ctx, raw['outline']),
    isolate: ctx.bool(raw['isolate'], 'focus.isolate', DEFAULT_FOCUS.isolate),
    transition: validateTransition(
      ctx,
      raw['transition'],
      'focus.transition',
      DEFAULT_FOCUS_TRANSITION,
    ),
  };
}

function validateMeta(ctx: Ctx, raw: unknown): MetaConfig {
  if (raw === undefined) return DEFAULT_META;
  if (!isObject(raw)) {
    ctx.error('meta', 'must be an object');
    return DEFAULT_META;
  }
  const meta: MetaConfig = {
    ...(raw['title'] !== undefined ? { title: ctx.str(raw['title'], 'meta.title', '') } : {}),
    ...(raw['description'] !== undefined
      ? { description: ctx.str(raw['description'], 'meta.description', '') }
      : {}),
    defaultLocale: ctx.str(raw['defaultLocale'], 'meta.defaultLocale', 'en'),
  };
  return meta;
}

function validateInstancing(ctx: Ctx, raw: unknown): InstancingConfig {
  const fallback = MODEL_DEFAULTS.instancing;
  if (raw === undefined) return fallback;
  if (!isObject(raw)) {
    ctx.error('model.instancing', 'must be an object { enabled?, minCount? }');
    return fallback;
  }
  return {
    enabled: ctx.bool(raw['enabled'], 'model.instancing.enabled', fallback.enabled),
    minCount: ctx.numClamped(
      raw['minCount'],
      'model.instancing.minCount',
      fallback.minCount,
      2,
      1000,
    ),
  };
}

function validateModel(ctx: Ctx, raw: unknown): ModelConfig {
  if (!isObject(raw)) {
    ctx.error('model', 'is required and must be an object');
    return { src: '', ...MODEL_DEFAULTS };
  }
  if (!isString(raw['src']) || raw['src'].length === 0) {
    ctx.error('model.src', 'is required and must be a non-empty string');
  }
  return {
    src: isString(raw['src']) ? raw['src'] : '',
    draco: ctx.bool(raw['draco'], 'model.draco', MODEL_DEFAULTS.draco),
    ktx2: ctx.bool(raw['ktx2'], 'model.ktx2', MODEL_DEFAULTS.ktx2),
    meshopt: ctx.bool(raw['meshopt'], 'model.meshopt', MODEL_DEFAULTS.meshopt),
    frameOnLoad: ctx.bool(raw['frameOnLoad'], 'model.frameOnLoad', MODEL_DEFAULTS.frameOnLoad),
    instancing: validateInstancing(ctx, raw['instancing']),
  };
}

function validateBackground(ctx: Ctx, raw: unknown): BackgroundConfig {
  if (raw === undefined) return DEFAULT_ENVIRONMENT.background;
  if (!isObject(raw)) {
    ctx.error('environment.background', 'must be an object');
    return DEFAULT_ENVIRONMENT.background;
  }
  const kind = raw['kind'];
  if (kind === 'color')
    return {
      kind: 'color',
      color: ctx.str(raw['color'], 'environment.background.color', '#000000'),
    };
  if (kind === 'gradient')
    return {
      kind: 'gradient',
      top: ctx.str(raw['top'], 'environment.background.top', '#2a3350'),
      bottom: ctx.str(raw['bottom'], 'environment.background.bottom', '#0a0b12'),
    };
  if (kind === 'transparent') return { kind: 'transparent' };
  ctx.error('environment.background.kind', "must be one of 'color' | 'gradient' | 'transparent'");
  return DEFAULT_ENVIRONMENT.background;
}

function validateEnvironment(ctx: Ctx, raw: unknown): EnvironmentConfig {
  if (raw === undefined) return DEFAULT_ENVIRONMENT;
  if (!isObject(raw)) {
    ctx.error('environment', 'must be an object');
    return DEFAULT_ENVIRONMENT;
  }
  let source = DEFAULT_ENVIRONMENT.source;
  if (raw['source'] !== undefined) {
    if (ENV_SOURCES.includes(raw['source'] as EnvironmentSourceId))
      source = raw['source'] as EnvironmentSourceId;
    else ctx.error('environment.source', `must be one of ${ENV_SOURCES.join(' | ')}`);
  }
  return {
    background: validateBackground(ctx, raw['background']),
    source,
    intensity: ctx.num(raw['intensity'], 'environment.intensity', DEFAULT_ENVIRONMENT.intensity),
  };
}

function validateLighting(ctx: Ctx, raw: unknown): LightingConfig {
  if (raw === undefined) return DEFAULT_LIGHTING;
  if (!isObject(raw)) {
    ctx.error('lighting', 'must be an object');
    return DEFAULT_LIGHTING;
  }
  let preset = DEFAULT_LIGHTING.preset;
  if (raw['preset'] !== undefined) {
    if (LIGHTING_PRESETS.includes(raw['preset'] as LightingPresetId))
      preset = raw['preset'] as LightingPresetId;
    else ctx.error('lighting.preset', `must be one of ${LIGHTING_PRESETS.join(' | ')}`);
  }
  return { preset };
}

function validateCamera(ctx: Ctx, raw: unknown): CameraConfig {
  if (raw === undefined) return DEFAULT_CAMERA;
  if (!isObject(raw)) {
    ctx.error('camera', 'must be an object');
    return DEFAULT_CAMERA;
  }
  const controlsRaw = raw['controls'];
  const controls = isObject(controlsRaw)
    ? {
        minDistance: ctx.num(
          controlsRaw['minDistance'],
          'camera.controls.minDistance',
          DEFAULT_CAMERA.controls.minDistance,
        ),
        maxDistance: ctx.num(
          controlsRaw['maxDistance'],
          'camera.controls.maxDistance',
          DEFAULT_CAMERA.controls.maxDistance,
        ),
        enablePan: ctx.bool(
          controlsRaw['enablePan'],
          'camera.controls.enablePan',
          DEFAULT_CAMERA.controls.enablePan,
        ),
        enableZoom: ctx.bool(
          controlsRaw['enableZoom'],
          'camera.controls.enableZoom',
          DEFAULT_CAMERA.controls.enableZoom,
        ),
      }
    : DEFAULT_CAMERA.controls;
  if (controlsRaw !== undefined && !isObject(controlsRaw))
    ctx.error('camera.controls', 'must be an object');
  return { fov: ctx.num(raw['fov'], 'camera.fov', DEFAULT_CAMERA.fov), controls };
}

function validateNodeRef(ctx: Ctx, raw: unknown, path: string): NodeRef | null {
  if (!isObject(raw)) {
    ctx.error(path, 'must be an object { explorerId } or { name }');
    return null;
  }
  if (isString(raw['explorerId']) && raw['explorerId'].length > 0)
    return { explorerId: raw['explorerId'] };
  if (isString(raw['name']) && raw['name'].length > 0) {
    ctx.warn(
      path,
      'node referenced by name (fragile — prefer extras.explorerId; a re-export can break it)',
    );
    return { name: raw['name'] };
  }
  ctx.error(path, 'must provide a non-empty `explorerId` (recommended) or `name` (fallback)');
  return null;
}

function validateComponents(ctx: Ctx, raw: unknown): ComponentConfig[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    ctx.error('components', 'must be an array');
    return [];
  }
  const out: ComponentConfig[] = [];
  const seen = new Set<string>();
  raw.forEach((item, i) => {
    const base = `components[${i}]`;
    if (!isObject(item)) {
      ctx.error(base, 'must be an object');
      return;
    }
    if (!isString(item['id']) || item['id'].length === 0) {
      ctx.error(`${base}.id`, 'is required and must be a non-empty string');
      return;
    }
    const id = item['id'];
    if (seen.has(id)) ctx.error(`${base}.id`, `duplicate component id "${id}"`);
    seen.add(id);

    const nodesRaw = item['nodes'];
    const nodes: NodeRef[] = [];
    if (!Array.isArray(nodesRaw) || nodesRaw.length === 0) {
      ctx.error(`${base}.nodes`, 'is required and must be a non-empty array of NodeRef');
    } else {
      nodesRaw.forEach((n, j) => {
        const ref = validateNodeRef(ctx, n, `${base}.nodes[${j}]`);
        if (ref) nodes.push(ref);
      });
    }
    // pickTarget defaults to the component's own id ("self" granularity).
    const pickTarget =
      item['pickTarget'] === undefined || item['pickTarget'] === null
        ? id
        : ctx.str(item['pickTarget'], `${base}.pickTarget`, id);

    out.push({
      id,
      ...(item['label'] !== undefined
        ? { label: ctx.i18nText(item['label'], `${base}.label`, id) }
        : {}),
      nodes,
      selectable: ctx.bool(item['selectable'], `${base}.selectable`, true),
      pickTarget,
      group:
        item['group'] === undefined || item['group'] === null
          ? null
          : ctx.str(item['group'], `${base}.group`, ''),
    });
  });
  return out;
}

function validateAddress(ctx: Ctx, raw: unknown, path: string): Address | null {
  if (!isObject(raw)) {
    ctx.error(path, "must be a typed address { kind: 'component'|'group'|'node', id }");
    return null;
  }
  const kind = raw['kind'];
  if (kind !== 'component' && kind !== 'group' && kind !== 'node') {
    ctx.error(`${path}.kind`, "must be one of 'component' | 'group' | 'node'");
    return null;
  }
  if (!isString(raw['id']) || raw['id'].length === 0) {
    ctx.error(`${path}.id`, 'is required and must be a non-empty string');
    return null;
  }
  return { kind, id: raw['id'] };
}

function validateAnchor(ctx: Ctx, raw: unknown, path: string): HotspotAnchor | null {
  if (!isObject(raw)) {
    ctx.error(path, 'is required and must be a typed anchor object');
    return null;
  }
  const kind = raw['kind'];
  if (kind === 'component' || kind === 'group' || kind === 'node') {
    if (!isString(raw['id']) || raw['id'].length === 0) {
      ctx.error(`${path}.id`, 'is required and must be a non-empty string');
      return null;
    }
    return { kind, id: raw['id'] };
  }
  if (kind === 'position') {
    const pos = vec3(ctx, raw['position'], `${path}.position`);
    if (pos === null) return null;
    return { kind: 'position', position: pos };
  }
  ctx.error(`${path}.kind`, "must be one of 'component' | 'group' | 'node' | 'position'");
  return null;
}

function vec3(ctx: Ctx, raw: unknown, path: string): readonly [number, number, number] | null {
  if (Array.isArray(raw) && raw.length === 3) {
    const [x, y, z] = raw as unknown[];
    if (isNumber(x) && isNumber(y) && isNumber(z)) return [x, y, z];
  }
  ctx.error(path, 'must be a [number, number, number] tuple');
  return null;
}

function validateAction(ctx: Ctx, raw: unknown, path: string): HotspotAction | null {
  if (!isObject(raw)) {
    ctx.error(path, 'must be an object with a `type`');
    return null;
  }
  switch (raw['type']) {
    case 'focus': {
      const target = validateAddress(ctx, raw['target'], `${path}.target`);
      return target ? { type: 'focus', target } : null;
    }
    case 'emit': {
      if (!isString(raw['event']) || raw['event'].length === 0) {
        ctx.error(`${path}.event`, 'is required and must be a non-empty string');
        return null;
      }
      return { type: 'emit', event: raw['event'] };
    }
    case 'goToState': {
      if (!isString(raw['state']) || raw['state'].length === 0) {
        ctx.error(`${path}.state`, 'is required and must be a non-empty string');
        return null;
      }
      return { type: 'goToState', state: raw['state'] };
    }
    default:
      ctx.error(`${path}.type`, "must be one of 'focus' | 'emit' | 'goToState'");
      return null;
  }
}

function validateHotspots(ctx: Ctx, raw: unknown): HotspotConfig[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    ctx.error('hotspots', 'must be an array');
    return [];
  }
  const out: HotspotConfig[] = [];
  const seen = new Set<string>();
  raw.forEach((item, i) => {
    const base = `hotspots[${i}]`;
    if (!isObject(item)) {
      ctx.error(base, 'must be an object');
      return;
    }
    if (!isString(item['id']) || item['id'].length === 0) {
      ctx.error(`${base}.id`, 'is required and must be a non-empty string');
      return;
    }
    const id = item['id'];
    if (seen.has(id)) ctx.error(`${base}.id`, `duplicate hotspot id "${id}"`);
    seen.add(id);

    const anchor = validateAnchor(ctx, item['anchor'], `${base}.anchor`);
    const action =
      item['action'] === undefined
        ? ({ type: 'emit', event: `hotspot:${id}` } as HotspotAction) // safe default
        : validateAction(ctx, item['action'], `${base}.action`);
    if (anchor === null || action === null) return;

    let visibleInStates: readonly string[] | null = null;
    if (item['visibleInStates'] !== undefined && item['visibleInStates'] !== null) {
      if (!Array.isArray(item['visibleInStates']) || !item['visibleInStates'].every(isString)) {
        ctx.error(`${base}.visibleInStates`, 'must be an array of state id strings');
      } else {
        visibleInStates = item['visibleInStates'];
      }
    }

    out.push({
      id,
      label: ctx.i18nText(item['label'], `${base}.label`, ''),
      anchor,
      offset:
        item['offset'] === undefined || item['offset'] === null
          ? null
          : vec3(ctx, item['offset'], `${base}.offset`),
      action,
      visibleInStates,
      occludable: ctx.bool(item['occludable'], `${base}.occludable`, true),
      priority: ctx.num(item['priority'], `${base}.priority`, 0),
    });
  });
  return out;
}

const STATE_CHANNELS = new Set(['transform', 'opacity', 'colorOverride', 'visibility', 'clip']);

function validateTransformValue(ctx: Ctx, raw: unknown, path: string): TransformValueConfig | null {
  if (!isObject(raw)) {
    ctx.error(path, 'must be an object { translate?, rotate?, scale? }');
    return null;
  }
  if (raw['relative'] !== undefined) {
    // Transforms are ABSOLUTE offsets from the rest pose (chapter 19 §19.3.3, §5.6 rule 7).
    ctx.error(
      `${path}.relative`,
      'is forbidden — transforms are absolute offsets from the rest pose',
    );
    return null;
  }
  const out: {
    translate?: readonly [number, number, number];
    rotate?: readonly [number, number, number];
    scale?: number | readonly [number, number, number];
  } = {};
  if (raw['translate'] !== undefined) {
    const t = vec3(ctx, raw['translate'], `${path}.translate`);
    if (t) out.translate = t;
  }
  if (raw['rotate'] !== undefined) {
    const r = vec3(ctx, raw['rotate'], `${path}.rotate`);
    if (r) out.rotate = r;
  }
  if (raw['scale'] !== undefined) {
    if (isNumber(raw['scale'])) out.scale = raw['scale'];
    else {
      const s = vec3(ctx, raw['scale'], `${path}.scale`);
      if (s) out.scale = s;
    }
  }
  return out;
}

function validateClipPlanes(ctx: Ctx, raw: unknown, path: string): readonly ClipPlaneConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    ctx.error(path, 'must be a non-empty array of clip planes { normal, offset }');
    return [];
  }
  const out: ClipPlaneConfig[] = [];
  raw.forEach((item, i) => {
    if (!isObject(item)) {
      ctx.error(`${path}[${i}]`, 'must be an object { normal, offset }');
      return;
    }
    const normal = vec3(ctx, item['normal'], `${path}[${i}].normal`);
    if (normal === null) return;
    if (normal[0] === 0 && normal[1] === 0 && normal[2] === 0) {
      ctx.error(`${path}[${i}].normal`, 'must be a non-zero vector');
      return;
    }
    out.push({ normal, offset: ctx.num(item['offset'], `${path}[${i}].offset`, 0) });
  });
  return out;
}

function validateStateLayer(ctx: Ctx, raw: unknown, path: string): StateLayerConfig | null {
  if (!isObject(raw)) {
    ctx.error(path, 'must be an object { target, channel, value }');
    return null;
  }
  const target = validateAddress(ctx, raw['target'], `${path}.target`);
  const channel = raw['channel'];
  if (typeof channel !== 'string' || !STATE_CHANNELS.has(channel)) {
    ctx.error(`${path}.channel`, `must be one of ${[...STATE_CHANNELS].join(' | ')}`);
    return null;
  }
  if (target === null) return null;
  switch (channel) {
    case 'transform': {
      const value = validateTransformValue(ctx, raw['value'], `${path}.value`);
      return value ? { target, channel, value } : null;
    }
    case 'opacity':
      return { target, channel, value: ctx.numClamped(raw['value'], `${path}.value`, 1, 0, 1) };
    case 'visibility': {
      if (raw['value'] !== 'visible' && raw['value'] !== 'hidden') {
        ctx.error(`${path}.value`, "must be 'visible' | 'hidden'");
        return null;
      }
      return { target, channel, value: raw['value'] };
    }
    case 'colorOverride': {
      const v = raw['value'];
      if (!isObject(v) || !isString(v['color'])) {
        ctx.error(`${path}.value`, 'must be { color: string, intensity: number }');
        return null;
      }
      return {
        target,
        channel,
        value: {
          color: v['color'],
          intensity: ctx.numClamped(v['intensity'], `${path}.value.intensity`, 1, 0, 1),
        },
      };
    }
    case 'clip': {
      const planes = validateClipPlanes(ctx, raw['value'], `${path}.value`);
      return planes.length > 0 ? { target, channel, value: planes } : null;
    }
    default:
      return null;
  }
}

function validateStateCameraIntent(
  ctx: Ctx,
  raw: unknown,
  path: string,
): StateCameraIntentConfig | null {
  if (raw === undefined || raw === null) return null;
  if (!isObject(raw)) {
    ctx.error(path, 'must be an object { position: Vec3, target: Vec3 }');
    return null;
  }
  const position = vec3(ctx, raw['position'], `${path}.position`);
  const target = vec3(ctx, raw['target'], `${path}.target`);
  if (position === null || target === null) return null;
  return { position, target };
}

function validateStates(ctx: Ctx, raw: unknown): StateConfig[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    ctx.error('states', 'must be an array');
    return [];
  }
  const out: StateConfig[] = [];
  const seen = new Set<string>();
  raw.forEach((item, i) => {
    const base = `states[${i}]`;
    if (!isObject(item)) {
      ctx.error(base, 'must be an object');
      return;
    }
    if (!isString(item['id']) || item['id'].length === 0) {
      ctx.error(`${base}.id`, 'is required and must be a non-empty string');
      return;
    }
    const id = item['id'];
    if (seen.has(id)) ctx.error(`${base}.id`, `duplicate state id "${id}"`);
    seen.add(id);

    const region =
      item['region'] === undefined || item['region'] === null
        ? 'base'
        : ctx.str(item['region'], `${base}.region`, 'base');

    let allowedFrom: readonly string[] | null = null;
    if (item['allowedFrom'] !== undefined && item['allowedFrom'] !== null) {
      if (!Array.isArray(item['allowedFrom']) || !item['allowedFrom'].every(isString)) {
        ctx.error(`${base}.allowedFrom`, 'must be an array of base state id strings');
      } else {
        allowedFrom = item['allowedFrom'];
      }
    }

    let excludes: readonly string[] = [];
    if (item['excludes'] !== undefined) {
      if (!Array.isArray(item['excludes']) || !item['excludes'].every(isString)) {
        ctx.error(`${base}.excludes`, 'must be an array of state/region id strings');
      } else {
        excludes = item['excludes'];
      }
    }

    const layers: StateLayerConfig[] = [];
    if (item['layers'] !== undefined) {
      if (!Array.isArray(item['layers'])) {
        ctx.error(`${base}.layers`, 'must be an array of layers');
      } else {
        item['layers'].forEach((l, j) => {
          const layer = validateStateLayer(ctx, l, `${base}.layers[${j}]`);
          if (layer) layers.push(layer);
        });
      }
    }

    out.push({
      id,
      label: ctx.i18nText(item['label'], `${base}.label`, id),
      region,
      allowedFrom,
      excludes,
      layers,
      cameraIntent: validateStateCameraIntent(ctx, item['cameraIntent'], `${base}.cameraIntent`),
      transition:
        item['transition'] === undefined || item['transition'] === null
          ? null
          : validateTransition(
              ctx,
              item['transition'],
              `${base}.transition`,
              DEFAULT_FOCUS_TRANSITION,
            ),
    });
  });
  return out;
}

/**
 * Config-level reference integrity (§5.6 rule 3): component `pickTarget`, hotspot
 * component/group anchors and focus targets must point at declared entities.
 * Node identities are checked against the GLB by the offline validator, not here.
 */
function validateThemeTokens(ctx: Ctx, raw: unknown, path: string): ThemeTokens {
  if (raw === undefined) return {};
  if (!isObject(raw)) {
    ctx.error(path, 'must be an object of string token overrides');
    return {};
  }
  const tokens: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isString(value)) {
      ctx.error(`${path}.${key}`, 'token value must be a string');
      continue;
    }
    tokens[key] = value;
  }
  return tokens;
}

/**
 * Warn (never block — ch.13 §13.5) when declared token overrides would fail
 * WCAG 2.1 AA for text on background/surface, in EITHER variant (a `preset` of
 * `"auto"` can resolve to either at runtime, so both are checked).
 */
function checkThemeContrast(ctx: Ctx, theme: ThemeConfig): void {
  for (const [variant, base] of [
    ['light', DEFAULT_THEME_TOKENS_LIGHT],
    ['dark', DEFAULT_THEME_TOKENS_DARK],
  ] as const) {
    const merged = { ...base, ...theme.tokens, ...theme.hotspotStyle };
    const text = merged['colorText'];
    const background = merged['colorBackground'];
    const surface = merged['colorSurface'];
    if (text === undefined) continue;
    if (background !== undefined && !meetsWcagAaNormalText(text, background)) {
      ctx.warn(
        'theme.tokens',
        `colorText/colorBackground contrast fails WCAG 2.1 AA in the "${variant}" variant`,
      );
    }
    if (surface !== undefined && !meetsWcagAaNormalText(text, surface)) {
      ctx.warn(
        'theme.tokens',
        `colorText/colorSurface contrast fails WCAG 2.1 AA in the "${variant}" variant`,
      );
    }
  }
}

function validateTheme(ctx: Ctx, raw: unknown): ThemeConfig {
  if (raw === undefined) return DEFAULT_THEME;
  if (!isObject(raw)) {
    ctx.error('theme', 'must be an object');
    return DEFAULT_THEME;
  }
  let preset: ThemePreset = DEFAULT_THEME.preset;
  if (raw['preset'] !== undefined) {
    if (THEME_PRESETS.includes(raw['preset'] as ThemePreset)) preset = raw['preset'] as ThemePreset;
    else ctx.error('theme.preset', `must be one of ${THEME_PRESETS.join(' | ')}`);
  }
  const theme: ThemeConfig = {
    preset,
    tokens: validateThemeTokens(ctx, raw['tokens'], 'theme.tokens'),
    hotspotStyle: validateThemeTokens(ctx, raw['hotspotStyle'], 'theme.hotspotStyle'),
  };
  checkThemeContrast(ctx, theme);
  return theme;
}

function validateI18n(ctx: Ctx, raw: unknown, defaultLocale: string): I18nConfig {
  if (raw === undefined) return { ...DEFAULT_I18N, locales: [defaultLocale] };
  if (!isObject(raw)) {
    ctx.error('i18n', 'must be an object');
    return { ...DEFAULT_I18N, locales: [defaultLocale] };
  }
  let locales: readonly string[] = [defaultLocale];
  if (raw['locales'] !== undefined) {
    if (!Array.isArray(raw['locales']) || !raw['locales'].every(isString)) {
      ctx.error('i18n.locales', 'must be an array of strings');
    } else {
      locales = raw['locales'] as readonly string[];
    }
  }
  const sources: Record<string, string> = {};
  if (raw['sources'] !== undefined) {
    if (!isObject(raw['sources'])) {
      ctx.error('i18n.sources', 'must be an object of { locale: path }');
    } else {
      for (const [locale, value] of Object.entries(raw['sources'])) {
        if (!isString(value)) {
          ctx.error(`i18n.sources.${locale}`, 'must be a string path');
          continue;
        }
        if (!locales.includes(locale)) {
          ctx.warn(`i18n.sources.${locale}`, `"${locale}" is not listed in i18n.locales`);
        }
        sources[locale] = value;
      }
    }
  }
  return { locales, sources };
}

function validatePerformanceBudget(
  ctx: Ctx,
  raw: unknown,
  path: string,
  fallback: PerformanceBudgetConfig,
): PerformanceBudgetConfig {
  if (raw === undefined) return fallback;
  if (!isObject(raw)) {
    ctx.error(path, 'must be an object { targetFps, frameBudgetMs }');
    return fallback;
  }
  return {
    targetFps: ctx.numClamped(raw['targetFps'], `${path}.targetFps`, fallback.targetFps, 1, 240),
    frameBudgetMs: ctx.numClamped(
      raw['frameBudgetMs'],
      `${path}.frameBudgetMs`,
      fallback.frameBudgetMs,
      1,
      1000,
    ),
  };
}

function validatePerformance(ctx: Ctx, raw: unknown): PerformanceConfig {
  if (raw === undefined) return DEFAULT_PERFORMANCE;
  if (!isObject(raw)) {
    ctx.error('performance', 'must be an object');
    return DEFAULT_PERFORMANCE;
  }
  return {
    desktop: validatePerformanceBudget(
      ctx,
      raw['desktop'],
      'performance.desktop',
      DEFAULT_PERFORMANCE.desktop,
    ),
    mobile: validatePerformanceBudget(
      ctx,
      raw['mobile'],
      'performance.mobile',
      DEFAULT_PERFORMANCE.mobile,
    ),
    overlay: ctx.bool(raw['overlay'], 'performance.overlay', DEFAULT_PERFORMANCE.overlay),
  };
}

function validateQualityLever(
  ctx: Ctx,
  raw: unknown,
  path: string,
  fallback: QualityLeverConfig,
): QualityLeverConfig {
  if (raw === undefined) return fallback;
  if (!isObject(raw)) {
    ctx.error(path, 'must be an object { maxPixelRatio }');
    return fallback;
  }
  return {
    maxPixelRatio: ctx.numClamped(
      raw['maxPixelRatio'],
      `${path}.maxPixelRatio`,
      fallback.maxPixelRatio,
      0.5,
      4,
    ),
  };
}

function validateQuality(ctx: Ctx, raw: unknown): QualityConfig {
  if (raw === undefined) return DEFAULT_QUALITY;
  if (!isObject(raw)) {
    ctx.error('quality', 'must be an object');
    return DEFAULT_QUALITY;
  }
  let initialLevel: QualityLevel = DEFAULT_QUALITY.initialLevel;
  if (raw['initialLevel'] !== undefined) {
    if (QUALITY_LEVELS.includes(raw['initialLevel'] as QualityLevel)) {
      initialLevel = raw['initialLevel'] as QualityLevel;
    } else {
      ctx.error('quality.initialLevel', `must be one of ${QUALITY_LEVELS.join(' | ')}`);
    }
  }
  const levelsRaw = raw['levels'];
  if (levelsRaw !== undefined && !isObject(levelsRaw)) {
    ctx.error('quality.levels', 'must be an object keyed by quality level');
  }
  const levels = {} as Record<QualityLevel, QualityLeverConfig>;
  for (const level of QUALITY_LEVELS) {
    levels[level] = validateQualityLever(
      ctx,
      isObject(levelsRaw) ? levelsRaw[level] : undefined,
      `quality.levels.${level}`,
      DEFAULT_QUALITY.levels[level],
    );
  }
  return {
    adaptive: ctx.bool(raw['adaptive'], 'quality.adaptive', DEFAULT_QUALITY.adaptive),
    initialLevel,
    levels,
  };
}

function validateRequiredCapabilities(ctx: Ctx, raw: unknown): Capability[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    ctx.error('requiredCapabilities', 'must be an array');
    return [];
  }
  const out: Capability[] = [];
  const seen = new Set<string>();
  raw.forEach((item, i) => {
    const base = `requiredCapabilities[${i}]`;
    if (!isObject(item)) {
      ctx.error(base, 'must be an object { id, level? }');
      return;
    }
    if (!isString(item['id']) || item['id'].length === 0) {
      ctx.error(`${base}.id`, 'is required and must be a non-empty string');
      return;
    }
    const id = item['id'];
    if (seen.has(id)) ctx.warn(`${base}.id`, `duplicate capability id "${id}"`);
    seen.add(id);
    let level: Capability['level'] = 'required';
    if (item['level'] !== undefined) {
      if (CAPABILITY_LEVELS.includes(item['level'] as Capability['level'])) {
        level = item['level'] as Capability['level'];
      } else {
        ctx.error(`${base}.level`, `must be one of ${CAPABILITY_LEVELS.join(' | ')}`);
      }
    }
    out.push({ id, level });
  });
  return out;
}

function validatePlugins(ctx: Ctx, raw: unknown): PluginEntry[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    ctx.error('plugins', 'must be an array');
    return [];
  }
  const out: PluginEntry[] = [];
  const seen = new Set<string>();
  raw.forEach((item, i) => {
    const base = `plugins[${i}]`;
    if (!isObject(item)) {
      ctx.error(base, 'must be an object { id, enabled?, options? }');
      return;
    }
    if (!isString(item['id']) || item['id'].length === 0) {
      ctx.error(`${base}.id`, 'is required and must be a non-empty string');
      return;
    }
    const id = item['id'];
    if (seen.has(id)) ctx.error(`${base}.id`, `duplicate plugin id "${id}"`);
    seen.add(id);
    const enabled = ctx.bool(item['enabled'], `${base}.enabled`, true);
    let options: Readonly<Record<string, unknown>> = {};
    if (item['options'] !== undefined) {
      if (isObject(item['options'])) options = item['options'];
      else ctx.error(`${base}.options`, 'must be an object');
    }
    out.push({ id, enabled, options });
  });
  return out;
}

function validateReferences(
  ctx: Ctx,
  components: readonly ComponentConfig[],
  hotspots: readonly HotspotConfig[],
  states: readonly StateConfig[],
  initialState: string | null,
): void {
  const componentIds = new Set(components.map((c) => c.id));
  const groupIds = new Set(
    components.map((c) => c.group).filter((g): g is string => g !== null && g.length > 0),
  );

  components.forEach((c, i) => {
    if (c.pickTarget !== c.id && !componentIds.has(c.pickTarget)) {
      ctx.error(`components[${i}].pickTarget`, `unknown component id "${c.pickTarget}"`);
    }
  });

  const checkAddress = (addr: Address, path: string): void => {
    if (addr.kind === 'component' && !componentIds.has(addr.id)) {
      ctx.error(path, `unknown component id "${addr.id}"`);
    } else if (addr.kind === 'group' && !groupIds.has(addr.id)) {
      ctx.error(path, `unknown group id "${addr.id}"`);
    }
    // kind 'node' identities are validated against the model (validate-package).
  };

  hotspots.forEach((h, i) => {
    const base = `hotspots[${i}]`;
    if (h.anchor.kind === 'component' && !componentIds.has(h.anchor.id)) {
      ctx.error(`${base}.anchor.id`, `unknown component id "${h.anchor.id}"`);
    } else if (h.anchor.kind === 'group' && !groupIds.has(h.anchor.id)) {
      ctx.error(`${base}.anchor.id`, `unknown group id "${h.anchor.id}"`);
    }
    if (h.action.type === 'focus') checkAddress(h.action.target, `${base}.action.target`);
  });

  // States: layer targets must resolve; allowedFrom/initialState must name a base.
  const stateIds = new Set(states.map((s) => s.id));
  const baseIds = new Set(states.filter((s) => s.region === 'base').map((s) => s.id));
  states.forEach((s, i) => {
    const base = `states[${i}]`;
    s.layers.forEach((layer, j) => checkAddress(layer.target, `${base}.layers[${j}].target`));
    if (s.region === 'base') {
      s.allowedFrom?.forEach((from, j) => {
        if (!baseIds.has(from))
          ctx.error(`${base}.allowedFrom[${j}]`, `unknown base state "${from}"`);
      });
    }
    s.excludes.forEach((ex, j) => {
      // May reference a state id or a modifier region id; warn if neither.
      if (!stateIds.has(ex) && !states.some((st) => st.region === ex)) {
        ctx.warn(`${base}.excludes[${j}]`, `"${ex}" matches no state id or region`);
      }
    });
  });
  // Hotspot goToState references must name an existing state.
  hotspots.forEach((h, i) => {
    if (h.action.type === 'goToState' && !stateIds.has(h.action.state)) {
      ctx.error(`hotspots[${i}].action.state`, `unknown state id "${h.action.state}"`);
    }
  });
  if (initialState !== null && !baseIds.has(initialState)) {
    ctx.error('initialState', `must be an existing base state id (got "${initialState}")`);
  }
}

/** Validate `raw` against the schema, applying defaults. Does not migrate (see migrateConfig). */
export function validateConfig(raw: unknown): ValidationResult {
  const ctx = new Ctx();
  if (!isObject(raw)) {
    return {
      ok: false,
      errors: [{ path: '', message: 'config must be a JSON object' }],
      warnings: [],
    };
  }

  const version = raw['schemaVersion'];
  if (!isString(version)) {
    ctx.error('schemaVersion', 'is required and must be a semver string "MAJOR.MINOR"');
  } else {
    const major = version.split('.')[0];
    if (major === undefined || !SUPPORTED_SCHEMA_MAJORS.includes(major)) {
      ctx.error(
        'schemaVersion',
        `unsupported schema major "${version}" (supported: ${SUPPORTED_SCHEMA_MAJORS.join(', ')}.x)`,
      );
    }
  }

  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) ctx.warn(key, `unknown top-level key "${key}" (ignored)`);
  }

  const components = validateComponents(ctx, raw['components']);
  const hotspots = validateHotspots(ctx, raw['hotspots']);
  const states = validateStates(ctx, raw['states']);
  const initialState =
    raw['initialState'] === undefined || raw['initialState'] === null
      ? null
      : ctx.str(raw['initialState'], 'initialState', '');
  validateReferences(ctx, components, hotspots, states, initialState);

  const meta = validateMeta(ctx, raw['meta']);

  const resolved: ResolvedConfig = {
    schemaVersion: isString(version) ? version : '',
    meta,
    model: validateModel(ctx, raw['model']),
    environment: validateEnvironment(ctx, raw['environment']),
    lighting: validateLighting(ctx, raw['lighting']),
    camera: validateCamera(ctx, raw['camera']),
    components,
    hotspots,
    focus: validateFocus(ctx, raw['focus']),
    states,
    initialState,
    theme: validateTheme(ctx, raw['theme']),
    i18n: validateI18n(ctx, raw['i18n'], meta.defaultLocale ?? 'en'),
    performance: validatePerformance(ctx, raw['performance']),
    quality: validateQuality(ctx, raw['quality']),
    requiredCapabilities: validateRequiredCapabilities(ctx, raw['requiredCapabilities']),
    plugins: validatePlugins(ctx, raw['plugins']),
  };

  if (ctx.errors.length > 0) return { ok: false, errors: ctx.errors, warnings: ctx.warnings };
  return { ok: true, value: Object.freeze(resolved), errors: [], warnings: ctx.warnings };
}
