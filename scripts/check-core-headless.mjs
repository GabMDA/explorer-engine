// Architecture guard (P0-T2) — enforces the headless-core invariant
// (ENGINE_CONSTITUTION L8/L9 ; ADR-002). Zero dependencies; runs in CI.
//
// Verifies, for the headless packages (core, plugin-sdk, schema):
//   1. package.json declares no forbidden dependency (three / UI framework);
//   2. tsconfig.json does not enable the "DOM" lib;
//   3. no source file imports three or a UI framework.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const HEADLESS = ['core', 'plugin-sdk', 'schema'];
const FORBIDDEN_DEPS = [
  'three',
  '@types/three',
  'react',
  'react-dom',
  'vue',
  'svelte',
  'lit',
  '@angular/core',
];
const FORBIDDEN_IMPORT = /from\s+['"](three(\/|['"])|react|react-dom|vue|svelte|lit|@angular\/)/;
const SOURCE_EXT = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/;

const errors = [];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

for (const pkg of HEADLESS) {
  const base = join('packages', pkg);

  const pj = JSON.parse(readFileSync(join(base, 'package.json'), 'utf8'));
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const dep of Object.keys(pj[field] ?? {})) {
      if (FORBIDDEN_DEPS.includes(dep)) {
        errors.push(`${pkg}: forbidden dependency "${dep}" in ${field}`);
      }
    }
  }

  const tsPath = join(base, 'tsconfig.json');
  if (existsSync(tsPath)) {
    const ts = readFileSync(tsPath, 'utf8');
    const libMatch = ts.match(/"lib"\s*:\s*\[([^\]]*)\]/i);
    if (libMatch && /["']dom["']/i.test(libMatch[1])) {
      errors.push(`${pkg}: tsconfig enables the "DOM" lib (forbidden in the headless core)`);
    }
  }

  const src = join(base, 'src');
  if (existsSync(src)) {
    for (const file of walk(src)) {
      if (!SOURCE_EXT.test(file)) continue;
      if (FORBIDDEN_IMPORT.test(readFileSync(file, 'utf8'))) {
        errors.push(`${file}: forbidden import (three / UI framework) in the headless core`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error('Headless-core guard FAILED (ENGINE_CONSTITUTION L8/L9):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(
  'Headless-core guard OK: core/plugin-sdk/schema have no DOM / Three.js / UI-framework dependency.',
);
