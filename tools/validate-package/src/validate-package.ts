// Explorer Package validator (roadmap P3-T4). Offline checks: (1) config.json is
// valid against the normative schema; (2) the model asset exists; (3) every
// component NodeRef (explorerId primary, name fallback) actually exists in the GLB.
// Filesystem access is injected so the logic is pure and unit-testable.
import { migrateConfig, validateConfig } from '@explorer-engine/schema';
import type { ConfigIssue } from '@explorer-engine/schema';

/** Injected filesystem, rooted at the package directory. */
export interface PackageFs {
  exists(relPath: string): boolean;
  readText(relPath: string): string;
  readBytes(relPath: string): Uint8Array;
}

export interface PackageReport {
  readonly ok: boolean;
  readonly errors: readonly ConfigIssue[];
  readonly warnings: readonly ConfigIssue[];
}

const GLB_MAGIC = 0x46546c67;
const GLB_CHUNK_JSON = 0x4e4f534a;

interface GltfNodeJson {
  name?: string;
  extras?: { explorerId?: string };
}

/** Extract node names and explorerIds from a GLB's JSON chunk (no Three.js). */
export function parseGlbNodeIdentities(bytes: Uint8Array): {
  readonly names: readonly string[];
  readonly explorerIds: readonly string[];
} {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12 || dv.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error('not a GLB (bad magic header)');
  }
  let offset = 12;
  let jsonText: string | null = null;
  while (offset + 8 <= bytes.byteLength) {
    const len = dv.getUint32(offset, true);
    const type = dv.getUint32(offset + 4, true);
    const start = offset + 8;
    if (type === GLB_CHUNK_JSON) {
      jsonText = new TextDecoder().decode(bytes.subarray(start, start + len));
      break;
    }
    offset = start + len;
  }
  if (jsonText === null) throw new Error('GLB has no JSON chunk');

  const gltf = JSON.parse(jsonText) as { nodes?: GltfNodeJson[] };
  const names: string[] = [];
  const explorerIds: string[] = [];
  for (const node of gltf.nodes ?? []) {
    if (typeof node.name === 'string' && node.name.length > 0) names.push(node.name);
    const id = node.extras?.explorerId;
    if (typeof id === 'string' && id.length > 0) explorerIds.push(id);
  }
  return { names, explorerIds };
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Validate the package rooted at `fs`, reading `configPath` (default config.json). */
export function validatePackage(fs: PackageFs, configPath = 'config.json'): PackageReport {
  const errors: ConfigIssue[] = [];
  const warnings: ConfigIssue[] = [];

  if (!fs.exists(configPath)) {
    return {
      ok: false,
      errors: [{ path: configPath, message: 'config file not found' }],
      warnings,
    };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readText(configPath));
  } catch (e) {
    return {
      ok: false,
      errors: [{ path: configPath, message: `invalid JSON: ${message(e)}` }],
      warnings,
    };
  }

  const result = validateConfig(migrateConfig(raw).raw);
  warnings.push(...result.warnings);
  if (!result.ok || result.value === undefined) {
    return { ok: false, errors: [...result.errors], warnings };
  }
  const config = result.value;

  // (2) asset presence.
  if (!fs.exists(config.model.src)) {
    errors.push({ path: 'model.src', message: `asset not found: ${config.model.src}` });
    return { ok: false, errors, warnings };
  }

  // (3) node correspondence.
  let ids: { names: readonly string[]; explorerIds: readonly string[] };
  try {
    ids = parseGlbNodeIdentities(fs.readBytes(config.model.src));
  } catch (e) {
    errors.push({ path: 'model.src', message: `cannot read GLB: ${message(e)}` });
    return { ok: false, errors, warnings };
  }
  const nameSet = new Set(ids.names);
  const idSet = new Set(ids.explorerIds);
  const knownIdentity = (identity: string) => idSet.has(identity) || nameSet.has(identity);

  config.components.forEach((component, i) => {
    component.nodes.forEach((node, j) => {
      const path = `components[${i}].nodes[${j}]`;
      if ('explorerId' in node) {
        if (!idSet.has(node.explorerId)) {
          errors.push({ path, message: `explorerId "${node.explorerId}" not found in model` });
        }
      } else if (!nameSet.has(node.name)) {
        errors.push({ path, message: `node name "${node.name}" not found in model` });
      }
    });
  });

  // Hotspot node anchors / focus targets must also resolve to a real GLB node
  // (component/group references were already checked by the schema validator).
  config.hotspots.forEach((hotspot, i) => {
    if (hotspot.anchor.kind === 'node' && !knownIdentity(hotspot.anchor.id)) {
      errors.push({
        path: `hotspots[${i}].anchor.id`,
        message: `node "${hotspot.anchor.id}" not found in model`,
      });
    }
    if (
      hotspot.action.type === 'focus' &&
      hotspot.action.target.kind === 'node' &&
      !knownIdentity(hotspot.action.target.id)
    ) {
      errors.push({
        path: `hotspots[${i}].action.target.id`,
        message: `node "${hotspot.action.target.id}" not found in model`,
      });
    }
  });

  return { ok: errors.length === 0, errors, warnings };
}
