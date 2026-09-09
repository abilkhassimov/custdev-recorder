import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const assets = [
  'index.html',
  'app.js',
  'frontend-core.js',
  'style.css',
  'fonts.css',
  'manifest.webmanifest',
  'icon.svg',
  'icon-32.png',
  'icon-180.png',
  'fonts'
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const asset of assets) {
  await cp(path.join(root, asset), path.join(dist, asset), { recursive: true });
}
console.log(`Static build complete: ${assets.length} assets copied to dist/`);
