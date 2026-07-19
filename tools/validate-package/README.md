# validate-package (P3-T4)

Offline validator for an Explorer Package. Given a package directory containing a
`config.json` (and its assets), it checks:

1. **Config** — `config.json` is valid against the normative schema
   (`@explorer-engine/schema`): migration is applied, then validation. Structural
   errors and fragile-name warnings are reported.
2. **Assets** — the model referenced by `model.src` exists.
3. **Node correspondence** — every component `NodeRef` resolves in the GLB: an
   `explorerId` must appear in a node's `extras.explorerId`, a `name` in a node's
   `name` (node identities are read from the GLB's JSON chunk — no Three.js).

## Usage

```sh
npm run validate:package -- <packageDir>
# or
tsx tools/validate-package/bin.mts <packageDir>
```

Exit code `0` on success (warnings allowed), `1` on any error.

## API

The logic is a pure, injectable function (`validatePackage(fs, configPath?)`) in
`src/validate-package.ts`, unit-tested and reusable by other tooling. The CLI
(`bin.mts`) provides the Node filesystem implementation and is run with `tsx`.
