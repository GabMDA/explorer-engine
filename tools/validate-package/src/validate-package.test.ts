import { describe, it, expect } from 'vitest';
import { validatePackage, parseGlbNodeIdentities } from './validate-package';
import type { PackageFs } from './validate-package';

/** Build a minimal GLB (header + JSON chunk only) for node-identity checks. */
function makeGlb(gltf: unknown): Uint8Array {
  const enc = new TextEncoder();
  let json = enc.encode(JSON.stringify(gltf));
  while (json.length % 4 !== 0) json = Uint8Array.from([...json, 0x20]);
  const total = 12 + 8 + json.length;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, json.length, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(json, 20);
  return out;
}

function memFs(files: Record<string, string | Uint8Array>): PackageFs {
  return {
    exists: (p) => Object.prototype.hasOwnProperty.call(files, p),
    readText: (p) => {
      const v = files[p];
      if (typeof v !== 'string') throw new Error('not text: ' + p);
      return v;
    },
    readBytes: (p) => {
      const v = files[p];
      return typeof v === 'string' ? new TextEncoder().encode(v) : (v as Uint8Array);
    },
  };
}

const glbWithNodes = makeGlb({
  asset: { version: '2.0' },
  nodes: [
    { name: 'Crown', extras: { explorerId: 'crown' } },
    { name: 'Gear', extras: { explorerId: 'gear' } },
  ],
});

describe('parseGlbNodeIdentities', () => {
  it('extracts names and explorerIds from the GLB JSON chunk', () => {
    const ids = parseGlbNodeIdentities(glbWithNodes);
    expect([...ids.names]).toEqual(['Crown', 'Gear']);
    expect([...ids.explorerIds]).toEqual(['crown', 'gear']);
  });

  it('throws on a non-GLB buffer', () => {
    expect(() => parseGlbNodeIdentities(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(/GLB/);
  });
});

describe('validatePackage', () => {
  const validConfig = JSON.stringify({
    schemaVersion: '1.0',
    model: { src: 'models/m.glb' },
    components: [{ id: 'crown', nodes: [{ explorerId: 'crown' }] }],
  });

  it('accepts a valid package', () => {
    const report = validatePackage(
      memFs({ 'config.json': validConfig, 'models/m.glb': glbWithNodes }),
    );
    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it('detects a missing config file', () => {
    const report = validatePackage(memFs({}));
    expect(report.ok).toBe(false);
    expect(report.errors[0]?.message).toMatch(/not found/);
  });

  it('detects invalid JSON', () => {
    const report = validatePackage(memFs({ 'config.json': '{ bad' }));
    expect(report.ok).toBe(false);
    expect(report.errors[0]?.message).toMatch(/invalid JSON/);
  });

  it('detects a schema-invalid config (missing model.src)', () => {
    const report = validatePackage(
      memFs({ 'config.json': JSON.stringify({ schemaVersion: '1.0', model: {} }) }),
    );
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.path === 'model.src')).toBe(true);
  });

  it('detects a missing asset', () => {
    const report = validatePackage(memFs({ 'config.json': validConfig }));
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.message.includes('asset not found'))).toBe(true);
  });

  it('detects an unknown explorerId', () => {
    const cfg = JSON.stringify({
      schemaVersion: '1.0',
      model: { src: 'models/m.glb' },
      components: [{ id: 'x', nodes: [{ explorerId: 'missing' }] }],
    });
    const report = validatePackage(memFs({ 'config.json': cfg, 'models/m.glb': glbWithNodes }));
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.message.includes('explorerId "missing"'))).toBe(true);
  });

  it('detects a hotspot node anchor / focus target missing from the model', () => {
    const cfg = JSON.stringify({
      schemaVersion: '1.0',
      model: { src: 'models/m.glb' },
      components: [{ id: 'crown', nodes: [{ explorerId: 'crown' }] }],
      hotspots: [
        { id: 'ok', anchor: { kind: 'node', id: 'crown' } },
        { id: 'bad-anchor', anchor: { kind: 'node', id: 'ghost' } },
        {
          id: 'bad-focus',
          anchor: { kind: 'component', id: 'crown' },
          action: { type: 'focus', target: { kind: 'node', id: 'phantom' } },
        },
      ],
    });
    const report = validatePackage(memFs({ 'config.json': cfg, 'models/m.glb': glbWithNodes }));
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.path === 'hotspots[1].anchor.id')).toBe(true);
    expect(report.errors.some((e) => e.path === 'hotspots[2].action.target.id')).toBe(true);
    // The valid node anchor produces no error.
    expect(report.errors.some((e) => e.path === 'hotspots[0].anchor.id')).toBe(false);
  });

  it('detects a state layer node target missing from the model', () => {
    const cfg = JSON.stringify({
      schemaVersion: '1.0',
      model: { src: 'models/m.glb' },
      components: [{ id: 'crown', nodes: [{ explorerId: 'crown' }] }],
      states: [
        { id: 'closed', region: 'base' },
        {
          id: 'open',
          region: 'base',
          layers: [
            {
              target: { kind: 'node', id: 'crown' },
              channel: 'transform',
              value: { translate: [0, 1, 0] },
            },
            { target: { kind: 'node', id: 'ghost' }, channel: 'opacity', value: 0.3 },
          ],
        },
      ],
      initialState: 'closed',
    });
    const report = validatePackage(memFs({ 'config.json': cfg, 'models/m.glb': glbWithNodes }));
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.path === 'states[1].layers[1].target.id')).toBe(true);
    expect(report.errors.some((e) => e.path === 'states[1].layers[0].target.id')).toBe(false);
  });

  it('warns on a name-referenced node that exists, errors on one that does not', () => {
    const ok = JSON.stringify({
      schemaVersion: '1.0',
      model: { src: 'models/m.glb' },
      components: [{ id: 'x', nodes: [{ name: 'Crown' }] }],
    });
    const okReport = validatePackage(memFs({ 'config.json': ok, 'models/m.glb': glbWithNodes }));
    expect(okReport.ok).toBe(true);
    expect(okReport.warnings.length).toBeGreaterThan(0); // fragile-name warning

    const bad = JSON.stringify({
      schemaVersion: '1.0',
      model: { src: 'models/m.glb' },
      components: [{ id: 'x', nodes: [{ name: 'Nope' }] }],
    });
    const badReport = validatePackage(memFs({ 'config.json': bad, 'models/m.glb': glbWithNodes }));
    expect(badReport.ok).toBe(false);
    expect(badReport.errors.some((e) => e.message.includes('node name "Nope"'))).toBe(true);
  });
});
