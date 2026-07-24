// Generates a small placeholder preview image for the "watch" reference
// Explorer Package (roadmap P10-T1, chapter 04 §4.2.1) — demonstrates the
// package's `assets/` directory with a real, portable file. Not currently
// referenced by any schema field (panel/hotspot image content isn't part of
// the schema yet); it exists to prove the directory travels with the package.
//
//   node scripts/gen-watch-preview.mjs
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';

const width = 256;
const height = 256;
const png = new PNG({ width, height });

for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = (width * y + x) << 2;
    // Radial gold-on-navy gradient — no external asset needed.
    const dx = (x - width / 2) / (width / 2);
    const dy = (y - height / 2) / (height / 2);
    const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
    png.data[idx] = Math.round(212 * (1 - d) + 10 * d);
    png.data[idx + 1] = Math.round(175 * (1 - d) + 11 * d);
    png.data[idx + 2] = Math.round(55 * (1 - d) + 18 * d);
    png.data[idx + 3] = 255;
  }
}

const out = 'examples/explorer-packages/watch/assets/images/watch-preview.png';
writeFileSync(out, PNG.sync.write(png));
console.log(`wrote ${out}`);
