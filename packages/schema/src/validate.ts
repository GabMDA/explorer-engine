// Hand-rolled, zero-dependency config validator (chapter 05). Produces a fully
// defaulted, immutable ResolvedConfig, plus blocking errors and non-blocking
// warnings (e.g. a node referenced by fragile name, ADR-003 / L12). Headless and
// data-only. Deterministic — no schema library, full control over messages.
import type {
  Address,
  BackgroundConfig,
  CameraConfig,
  ComponentConfig,
  ConfigIssue,
  EnvironmentConfig,
  EnvironmentSourceId,
  HotspotAction,
  HotspotAnchor,
  HotspotConfig,
  LightingConfig,
  LightingPresetId,
  MetaConfig,
  ModelConfig,
  NodeRef,
  ResolvedConfig,
  ValidationResult,
} from './types';
import {
  DEFAULT_CAMERA,
  DEFAULT_ENVIRONMENT,
  DEFAULT_LIGHTING,
  DEFAULT_META,
  MODEL_DEFAULTS,
  SUPPORTED_SCHEMA_MAJORS,
} from './defaults';

const KNOWN_KEYS = new Set([
  'schemaVersion',
  'meta',
  'model',
  'environment',
  'lighting',
  'camera',
  'components',
  'hotspots',
]);
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
        ? { label: ctx.str(item['label'], `${base}.label`, id) }
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
      label: ctx.str(item['label'], `${base}.label`, ''),
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

/**
 * Config-level reference integrity (§5.6 rule 3): component `pickTarget`, hotspot
 * component/group anchors and focus targets must point at declared entities.
 * Node identities are checked against the GLB by the offline validator, not here.
 */
function validateReferences(
  ctx: Ctx,
  components: readonly ComponentConfig[],
  hotspots: readonly HotspotConfig[],
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
  validateReferences(ctx, components, hotspots);

  const resolved: ResolvedConfig = {
    schemaVersion: isString(version) ? version : '',
    meta: validateMeta(ctx, raw['meta']),
    model: validateModel(ctx, raw['model']),
    environment: validateEnvironment(ctx, raw['environment']),
    lighting: validateLighting(ctx, raw['lighting']),
    camera: validateCamera(ctx, raw['camera']),
    components,
    hotspots,
  };

  if (ctx.errors.length > 0) return { ok: false, errors: ctx.errors, warnings: ctx.warnings };
  return { ok: true, value: Object.freeze(resolved), errors: [], warnings: ctx.warnings };
}
