#!/usr/bin/env tsx
// CLI wrapper for the Explorer Package validator (roadmap P3-T4). Run with tsx so
// it can import the TypeScript logic + schema directly:
//
//   npm run validate:package -- <packageDir>
//   tsx tools/validate-package/bin.mts <packageDir>
//
// It reads <packageDir>/config.json and validates config + assets + node identities.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validatePackage } from './src/validate-package.ts';
import type { PackageFs } from './src/validate-package.ts';

const dir = process.argv[2] ?? '.';

const fs: PackageFs = {
  exists: (rel) => existsSync(join(dir, rel)),
  readText: (rel) => readFileSync(join(dir, rel), 'utf8'),
  readBytes: (rel) => new Uint8Array(readFileSync(join(dir, rel))),
};

const report = validatePackage(fs);

for (const w of report.warnings) console.warn(`  warning  ${w.path}: ${w.message}`);
for (const e of report.errors) console.error(`  error    ${e.path}: ${e.message}`);

if (report.ok) {
  console.log(
    `validate-package: OK (${dir})` +
      (report.warnings.length ? ` — ${report.warnings.length} warning(s)` : ''),
  );
  process.exit(0);
} else {
  console.error(`validate-package: FAILED (${dir}) — ${report.errors.length} error(s)`);
  process.exit(1);
}
