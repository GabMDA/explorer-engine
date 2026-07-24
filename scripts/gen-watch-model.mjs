// Generates the GLB for the "watch" reference Explorer Package (roadmap
// P10-T1, chapter 04). A simple, real-world-shaped object with four
// individually addressable parts (case, face, crown, two strap pieces
// aggregated into one "strap" component) — enough to exercise components,
// hotspots, focus and one state (the crown pulled out) without any
// engine-specific content.
//
//   node scripts/gen-watch-model.mjs
//
// Dev-only tooling (@gltf-transform). The committed .glb needs none of it to run.
import { Document, NodeIO } from '@gltf-transform/core';
import { writeFileSync } from 'node:fs';

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

/** A box with independent half-extents per axis (generalizes the uniform
 * `cube(h)` helper used by the other fixture generators). */
function box(hx, hy, hz) {
  const faces = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const half = { x: hx, y: hy, z: hz };
  const pos = [];
  const nrm = [];
  const idx = [];
  for (const n of faces) {
    const up = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = norm(cross(up, n));
    const v = cross(n, u);
    const c = [n[0] * half.x, n[1] * half.y, n[2] * half.z];
    const scaledU = [u[0] * half.x, u[1] * half.y, u[2] * half.z];
    const scaledV = [v[0] * half.x, v[1] * half.y, v[2] * half.z];
    const corners = [
      add(c, add(scale(scaledU, -1), scale(scaledV, -1))),
      add(c, add(scale(scaledU, 1), scale(scaledV, -1))),
      add(c, add(scale(scaledU, 1), scale(scaledV, 1))),
      add(c, add(scale(scaledU, -1), scale(scaledV, 1))),
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

function addPart({ name, explorerId, half, position, color, roughness = 0.5, metallic = 0.1 }) {
  const geo = box(...half);
  const positionAccessor = doc.createAccessor().setType('VEC3').setArray(geo.pos).setBuffer(buffer);
  const normalAccessor = doc.createAccessor().setType('VEC3').setArray(geo.nrm).setBuffer(buffer);
  const indicesAccessor = doc
    .createAccessor()
    .setType('SCALAR')
    .setArray(geo.idx)
    .setBuffer(buffer);
  const material = doc
    .createMaterial(name + 'Mat')
    .setBaseColorFactor(color)
    .setRoughnessFactor(roughness)
    .setMetallicFactor(metallic);
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', positionAccessor)
    .setAttribute('NORMAL', normalAccessor)
    .setIndices(indicesAccessor)
    .setMaterial(material);
  const mesh = doc.createMesh(name).addPrimitive(prim);
  const node = doc
    .createNode(name)
    .setMesh(mesh)
    .setTranslation(position)
    .setExtras({ explorerId });
  scene.addChild(node);
  return node;
}

// Case: wide, flat body. Face: thin disc-like plate on top. Crown: small
// protrusion on the side (winding stem). Strap: two flattened bands top/bottom.
addPart({
  name: 'Case',
  explorerId: 'case',
  half: [0.5, 0.12, 0.5],
  position: [0, 0, 0],
  color: [0.55, 0.56, 0.58, 1],
  roughness: 0.35,
  metallic: 0.8,
});
addPart({
  name: 'Face',
  explorerId: 'face',
  half: [0.4, 0.02, 0.4],
  position: [0, 0.14, 0],
  color: [0.94, 0.92, 0.86, 1],
  roughness: 0.6,
  metallic: 0.0,
});
addPart({
  name: 'Crown',
  explorerId: 'crown',
  half: [0.06, 0.05, 0.08],
  position: [0.56, 0, 0],
  color: [0.83, 0.68, 0.21, 1],
  roughness: 0.3,
  metallic: 0.9,
});
addPart({
  name: 'StrapTop',
  explorerId: 'strap-top',
  half: [0.15, 0.05, 0.5],
  position: [0, 0, 0.62],
  color: [0.25, 0.16, 0.1, 1],
  roughness: 0.8,
  metallic: 0.0,
});
addPart({
  name: 'StrapBottom',
  explorerId: 'strap-bottom',
  half: [0.15, 0.05, 0.5],
  position: [0, 0, -0.62],
  color: [0.25, 0.16, 0.1, 1],
  roughness: 0.8,
  metallic: 0.0,
});

const glb = await new NodeIO().writeBinary(doc);
const out = 'examples/explorer-packages/watch/models/watch.glb';
writeFileSync(out, glb);
console.log(`wrote ${out} (${glb.length} bytes) — case/face/crown/strap-top/strap-bottom`);
