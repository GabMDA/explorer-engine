// Generates the GLB for the "gaming-pc" reference Explorer Package (roadmap
// P10-T2, chapter 04). A more complex real-world object than the "watch"
// package (P10-T1): seven components (case, side panel, motherboard, CPU
// cooler, GPU, two RAM sticks aggregated into one component, PSU) — enough to
// exercise multiple states (closed/open/exploded/x-ray), several hotspots
// mixing `focus` and `goToState` actions, and a Guided Tour across the whole
// interior, without any engine-specific content.
//
//   node scripts/gen-gaming-pc-model.mjs
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

/** A box with independent half-extents per axis. */
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

// Case: the outer tower shell. Side panel: a glass window on the +X face.
// Motherboard: flat panel at the back. CPU cooler + GPU + RAM: internal parts
// laid out roughly as in a real build. PSU: bottom compartment.
addPart({
  name: 'Case',
  explorerId: 'case',
  half: [0.42, 0.9, 0.42],
  position: [0, 0, 0],
  color: [0.15, 0.16, 0.18, 1],
  roughness: 0.4,
  metallic: 0.7,
});
addPart({
  name: 'SidePanel',
  explorerId: 'side-panel',
  half: [0.02, 0.85, 0.4],
  position: [0.44, 0, 0],
  color: [0.55, 0.75, 0.85, 1],
  roughness: 0.15,
  metallic: 0.1,
});
addPart({
  name: 'Motherboard',
  explorerId: 'motherboard',
  half: [0.35, 0.5, 0.02],
  position: [-0.05, 0, -0.35],
  color: [0.08, 0.25, 0.12, 1],
  roughness: 0.6,
  metallic: 0.05,
});
addPart({
  name: 'CpuCooler',
  explorerId: 'cpu-cooler',
  half: [0.12, 0.12, 0.12],
  position: [-0.05, 0.25, -0.2],
  color: [0.75, 0.76, 0.78, 1],
  roughness: 0.3,
  metallic: 0.8,
});
addPart({
  name: 'Gpu',
  explorerId: 'gpu',
  half: [0.25, 0.04, 0.15],
  position: [-0.05, -0.05, -0.15],
  color: [0.05, 0.05, 0.06, 1],
  roughness: 0.4,
  metallic: 0.6,
});
addPart({
  name: 'RamStick1',
  explorerId: 'ram-stick-1',
  half: [0.015, 0.15, 0.05],
  position: [0.06, 0.2, -0.25],
  color: [0.1, 0.12, 0.3, 1],
  roughness: 0.5,
  metallic: 0.3,
});
addPart({
  name: 'RamStick2',
  explorerId: 'ram-stick-2',
  half: [0.015, 0.15, 0.05],
  position: [0.1, 0.2, -0.25],
  color: [0.1, 0.12, 0.3, 1],
  roughness: 0.5,
  metallic: 0.3,
});
addPart({
  name: 'Psu',
  explorerId: 'psu',
  half: [0.35, 0.15, 0.35],
  position: [-0.02, -0.65, 0.05],
  color: [0.06, 0.06, 0.07, 1],
  roughness: 0.7,
  metallic: 0.2,
});

const glb = await new NodeIO().writeBinary(doc);
const out = 'examples/explorer-packages/gaming-pc/models/gaming-pc.glb';
writeFileSync(out, glb);
console.log(
  `wrote ${out} (${glb.length} bytes) — case/side-panel/motherboard/cpu-cooler/gpu/ram-stick-1/ram-stick-2/psu`,
);
