// Generate the P2-T3 test fixture: a self-contained GLB that REALLY uses both
// KHR_draco_mesh_compression (geometry) and KHR_texture_basisu / KTX2 (texture).
//
//   node scripts/gen-compressed-cube.mjs
//
// Output: apps/playground/public/models/compressed-cube.glb
//
// Dev-only tooling (devDependencies): @gltf-transform/*, draco3d, ktx2-encoder,
// pngjs. The committed .glb needs none of these to run or build the playground.
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression, KHRTextureBasisu } from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import draco3d from 'draco3d';
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';

const H = 0.5;
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
const uv = [];
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
  const uvs = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const base = pos.length / 3;
  corners.forEach((p, i) => {
    pos.push(...p);
    nrm.push(...n);
    uv.push(...uvs[i]);
  });
  idx.push(base + 0, base + 1, base + 2, base + 0, base + 2, base + 3);
}

// A small checker PNG (32x32), pure-JS via pngjs, actually sampled by the material.
const S = 32;
const png = new PNG({ width: S, height: S });
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const on = ((x >> 3) + (y >> 3)) % 2 === 0;
    const o = (y * S + x) * 4;
    png.data[o] = on ? 230 : 40;
    png.data[o + 1] = on ? 170 : 60;
    png.data[o + 2] = on ? 60 : 200;
    png.data[o + 3] = 255;
  }
}
const pngBytes = new Uint8Array(PNG.sync.write(png));

const doc = new Document();
const buffer = doc.createBuffer();
const acc = (name, arr, type, Ctor) =>
  doc.createAccessor(name).setType(type).setArray(new Ctor(arr)).setBuffer(buffer);

const position = acc('POSITION', pos, 'VEC3', Float32Array);
const normal = acc('NORMAL', nrm, 'VEC3', Float32Array);
const texcoord = acc('TEXCOORD_0', uv, 'VEC2', Float32Array);
const indices = acc('indices', idx, 'SCALAR', Uint16Array);

const tex = doc.createTexture('checker').setImage(pngBytes).setMimeType('image/png');
const material = doc
  .createMaterial('CubeMat')
  .setBaseColorTexture(tex)
  .setRoughnessFactor(0.6)
  .setMetallicFactor(0.05);

const prim = doc
  .createPrimitive()
  .setAttribute('POSITION', position)
  .setAttribute('NORMAL', normal)
  .setAttribute('TEXCOORD_0', texcoord)
  .setIndices(indices)
  .setMaterial(material);
const mesh = doc.createMesh('Cube').addPrimitive(prim);
const node = doc.createNode('Cube').setMesh(mesh);
doc.createScene('Scene').addChild(node);

// Decode PNG → raw RGBA for the Basis encoder (Node needs an explicit decoder).
const imageDecoder = async (bytes) => {
  const decoded = PNG.sync.read(Buffer.from(bytes));
  return { width: decoded.width, height: decoded.height, data: new Uint8Array(decoded.data) };
};

// 1) Texture → KTX2/Basis (adds KHR_texture_basisu).
await doc.transform(ktx2({ mode: 'ETC1S', quality: 128, imageDecoder }));
// 2) Geometry → Draco (adds KHR_draco_mesh_compression at write time).
await doc.transform(draco());

const io = new NodeIO()
  .registerExtensions([KHRDracoMeshCompression, KHRTextureBasisu])
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });

const glb = await io.writeBinary(doc);
const out = 'apps/playground/public/models/compressed-cube.glb';
writeFileSync(out, glb);

const roundtrip = await io.readBinary(glb);
const used = roundtrip
  .getRoot()
  .listExtensionsUsed()
  .map((e) => e.extensionName)
  .sort();
console.log(`wrote ${out} (${glb.length} bytes)`);
console.log(`extensionsUsed = ${JSON.stringify(used)}`);
if (!used.includes('KHR_draco_mesh_compression') || !used.includes('KHR_texture_basisu')) {
  console.error('ERROR: expected both Draco and KTX2 extensions');
  process.exit(1);
}
