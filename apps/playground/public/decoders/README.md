# Compression decoders (P2-T3)

Vendored WebAssembly decoders used by the Model Loader to read compressed GLBs.
They are served as static assets and fetched by Three.js **lazily** — only when a
GLB actually declares the matching extension.

## Origin

Copied verbatim (no manual edits) from the installed **three@0.185.1** package:

| Public path                | Source in `node_modules/three`                     | Purpose |
| -------------------------- | --------------------------------------------------- | ------- |
| `/decoders/draco/`         | `examples/jsm/libs/draco/gltf/`                     | `KHR_draco_mesh_compression` geometry decoder (WASM) |
| `/decoders/basis/`         | `examples/jsm/libs/basis/`                          | `KHR_texture_basisu` / KTX2 transcoder (WASM) |

Files kept (WASM mode only):

- `draco/draco_wasm_wrapper.js`, `draco/draco_decoder.wasm`
  (the `draco_decoder.js` asm.js fallback is intentionally omitted)
- `basis/basis_transcoder.js`, `basis/basis_transcoder.wasm`

The Meshopt decoder needs no vendored asset: it is Three's JS module
(`three/examples/jsm/libs/meshopt_decoder.module.js`), imported directly.

## Why they are here

`DRACOLoader.setDecoderPath('/decoders/draco/')` and
`KTX2Loader.setTranscoderPath('/decoders/basis/')` (configured in the playground)
tell Three.js where to fetch these files at decode time. Hosting them locally
avoids any external CDN dependency.

## Licenses

- three.js packaging: **MIT** (three.js authors).
- Draco decoder: **Apache License 2.0** (Google — <https://github.com/google/draco>).
- Basis Universal transcoder: **Apache License 2.0**
  (Binomial LLC — <https://github.com/BinomialLLC/basis_universal>).

## Updating

These are vendored, not build outputs. To refresh after a three.js bump, re-copy
the same files from the matching `node_modules/three` version (see
`scripts/copy-decoders.mjs`). Do not edit them by hand.
