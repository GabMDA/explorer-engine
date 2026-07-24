// Mirrors examples/explorer-packages/*/ into apps/playground/public/packages/*/
// so the dev/build server can serve a real Explorer Package (roadmap P10-T1,
// chapter 04) alongside the playground's own flat demo configs. A plain file
// copy — no custom Vite plugin/middleware, no server-side path rewriting —
// keeps `vite dev` and `vite build` identical (both already copy `public/`
// verbatim) and needs zero engine/adapter code. Safe to re-run (idempotent):
// the destination is cleared and fully rewritten each time.
//
//   node scripts/sync-example-packages.mjs
import { cpSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolved from this file's own location, NOT process.cwd() — npm sets cwd to
// the invoking workspace's directory (e.g. apps/playground/) when this runs
// as that workspace's predev/prebuild hook, not the repo root.
const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC_ROOT = join(REPO_ROOT, 'examples/explorer-packages');
const DEST_ROOT = join(REPO_ROOT, 'apps/playground/public/packages');

if (!existsSync(SRC_ROOT)) {
  console.log(`sync-example-packages: ${SRC_ROOT} does not exist, nothing to do`);
  process.exit(0);
}

const packages = readdirSync(SRC_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

if (packages.length === 0) {
  console.log('sync-example-packages: no packages found, nothing to do');
  process.exit(0);
}

rmSync(DEST_ROOT, { recursive: true, force: true });
for (const pkg of packages) {
  cpSync(join(SRC_ROOT, pkg), join(DEST_ROOT, pkg), { recursive: true });
}
console.log(`sync-example-packages: synced ${packages.length} package(s) — ${packages.join(', ')}`);
