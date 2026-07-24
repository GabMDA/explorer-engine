// Generate a small GLB with genuinely repeated geometry, to exercise automatic
// instancing (P9-T1, ch.14 §14.3.1) end-to-end in the playground/browser
// validation. Output: apps/playground/public/models/instanced.glb
//
//   node scripts/gen-instanced-model.mjs
//
// One addressable "hub" node (extras.explorerId: 'hub', its own geometry) plus
// eight anonymous "rivet_N" nodes that all reference the SAME glTF mesh — a
// real repeated-geometry case (THREE.GLTFLoader shares one BufferGeometry/
// Material object across every node referencing that mesh), and none of them
// carry an explorerId, so they are exactly the kind of decorative repeat
// automatic instancing is meant to merge.
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

function cube(h) {
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
    const c = scale(n, h);
    const corners = [
      add(c, add(scale(u, -h), scale(v, -h))),
      add(c, add(scale(u, h), scale(v, -h))),
      add(c, add(scale(u, h), scale(v, h))),
      add(c, add(scale(u, -h), scale(v, h))),
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

function addMesh(name, halfSize, color) {
  const geo = cube(halfSize);
  const position = doc.createAccessor().setType('VEC3').setArray(geo.pos).setBuffer(buffer);
  const normal = doc.createAccessor().setType('VEC3').setArray(geo.nrm).setBuffer(buffer);
  const indices = doc.createAccessor().setType('SCALAR').setArray(geo.idx).setBuffer(buffer);
  const material = doc
    .createMaterial(name + 'Mat')
    .setBaseColorFactor(color)
    .setRoughnessFactor(0.5)
    .setMetallicFactor(0.1);
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', position)
    .setAttribute('NORMAL', normal)
    .setIndices(indices)
    .setMaterial(material);
  return doc.createMesh(name).addPrimitive(prim);
}

// Addressable hub — its own geometry, kept individually resolvable (never instanced).
const hubMesh = addMesh('Hub', 0.5, [0.85, 0.65, 0.2, 1]);
scene.addChild(doc.createNode('Hub').setMesh(hubMesh).setExtras({ explorerId: 'hub' }));

// Eight rivets around the hub, all referencing ONE shared mesh — no explorerId.
const rivetMesh = addMesh('Rivet', 0.12, [0.5, 0.5, 0.55, 1]);
const RIVET_COUNT = 8;
for (let i = 0; i < RIVET_COUNT; i++) {
  const angle = (i / RIVET_COUNT) * Math.PI * 2;
  const radius = 1.1;
  const node = doc
    .createNode(`rivet_${i}`)
    .setMesh(rivetMesh)
    .setTranslation([Math.cos(angle) * radius, 0, Math.sin(angle) * radius]);
  scene.addChild(node);
}

const glb = await new NodeIO().writeBinary(doc);
const out = 'apps/playground/public/models/instanced.glb';
writeFileSync(out, glb);
console.log(
  `wrote ${out} (${glb.length} bytes) — 1 addressable hub + ${RIVET_COUNT} shared-mesh rivets`,
);
