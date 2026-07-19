// Generate a small multi-node GLB carrying extras.explorerId and a homonym, to
// exercise the node index (P2-T4). Output: apps/playground/public/models/indexed.glb
//
//   node scripts/gen-indexed-model.mjs
//
// Dev-only tooling (@gltf-transform). The committed .glb needs none of it to run.
import { Document, NodeIO } from '@gltf-transform/core';
import { writeFileSync } from 'node:fs';

// A unit cube's positions/normals/indices (half-size 0.4), reused for each part.
const H = 0.4;
const norm = (v) => {
  const l = Math.hypot(...v) || 1;
  return v.map((x) => x / l);
};
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

function cube() {
  const faces = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const pos = [];
  const nrm = [];
  const idx = [];
  for (const n of faces) {
    const up = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = norm(cross(up, n));
    const v = cross(n, u);
    const c = scale(n, H);
    const corners = [
      add(c, add(scale(u, -H), scale(v, -H))),
      add(c, add(scale(u, H), scale(v, -H))),
      add(c, add(scale(u, H), scale(v, H))),
      add(c, add(scale(u, -H), scale(v, H))),
    ];
    const base = pos.length / 3;
    for (const p of corners) {
      pos.push(...p);
      nrm.push(...n);
    }
    idx.push(base + 0, base + 1, base + 2, base + 0, base + 2, base + 3);
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
}

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('Scene');

// Three parts: two distinct explorerIds, plus a homonym named "Gear" to prove the
// index tolerates collisions (byName('Gear') → 2, byExplorerId('gear') → 1).
const parts = [
  { name: 'Crown', explorerId: 'crown', color: [0.85, 0.65, 0.2, 1], offset: [-0.9, 0, 0] },
  { name: 'Gear', explorerId: 'gear', color: [0.23, 0.65, 1, 1], offset: [0.9, 0, 0] },
  { name: 'Gear', explorerId: 'gear2', color: [0.4, 0.85, 0.5, 1], offset: [0, 0.9, 0] },
];

for (const part of parts) {
  const geo = cube();
  const position = doc.createAccessor().setType('VEC3').setArray(geo.pos).setBuffer(buffer);
  const normal = doc.createAccessor().setType('VEC3').setArray(geo.nrm).setBuffer(buffer);
  const indices = doc.createAccessor().setType('SCALAR').setArray(geo.idx).setBuffer(buffer);
  const material = doc
    .createMaterial(part.name + 'Mat')
    .setBaseColorFactor(part.color)
    .setRoughnessFactor(0.5)
    .setMetallicFactor(0.1);
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', position)
    .setAttribute('NORMAL', normal)
    .setIndices(indices)
    .setMaterial(material);
  const mesh = doc.createMesh(part.name).addPrimitive(prim);
  const node = doc
    .createNode(part.name)
    .setMesh(mesh)
    .setTranslation(part.offset)
    .setExtras({ explorerId: part.explorerId });
  scene.addChild(node);
}

const glb = await new NodeIO().writeBinary(doc);
const out = 'apps/playground/public/models/indexed.glb';
writeFileSync(out, glb);
console.log(`wrote ${out} (${glb.length} bytes) — nodes: Crown/crown, Gear/gear, Gear/gear2`);
