// Deterministically copy the Draco / Basis decoder assets from the installed
// three.js into the playground's public tree (P2-T3). Run explicitly:
//
//   node scripts/copy-decoders.mjs
//
// It is NOT run automatically at dev/build time — the assets are committed. Re-run
// only after bumping three.js. Files are copied verbatim (never edited by hand).
import { copyFileSync, mkdirSync } from 'node:fs';

const files = [
  [
    'node_modules/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js',
    'apps/playground/public/decoders/draco/draco_wasm_wrapper.js',
  ],
  [
    'node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm',
    'apps/playground/public/decoders/draco/draco_decoder.wasm',
  ],
  [
    'node_modules/three/examples/jsm/libs/basis/basis_transcoder.js',
    'apps/playground/public/decoders/basis/basis_transcoder.js',
  ],
  [
    'node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm',
    'apps/playground/public/decoders/basis/basis_transcoder.wasm',
  ],
];

mkdirSync('apps/playground/public/decoders/draco', { recursive: true });
mkdirSync('apps/playground/public/decoders/basis', { recursive: true });
for (const [from, to] of files) {
  copyFileSync(from, to);
  console.log(`copied ${to}`);
}
console.log('decoders copied (draco WASM-only + basis).');
