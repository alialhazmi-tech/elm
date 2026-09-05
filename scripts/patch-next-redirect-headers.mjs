import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

// Next 16.3.0 replays cached headers through native ServerResponse.appendHeader,
// duplicating Location on ISR MISS. Use Next's existing deduplicating wrapper.
// Upstream: https://github.com/vercel/next.js/pull/95913 (not yet released).
// Fail closed on upgrades: remove this patch once the production regression passes
// against an upstream release without it.
const require = createRequire(import.meta.url);
const root = path.dirname(require.resolve('next/package.json'));
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
if (version !== '16.3.0') throw new Error(`Revalidate the cached redirect patch for Next ${version}`);

const marker = '// ALELM: replay cached headers through the deduplicating Next response.';
for (const [file, constructor] of [
  ['dist/build/templates/app-page-runtime.js', '_node.NodeNextResponse'],
  ['dist/esm/build/templates/app-page-runtime.js', 'NodeNextResponse'],
]) {
  const target = path.join(root, file);
  const source = await readFile(target, 'utf8');
  if (source.includes(marker)) continue;
  const start = source.indexOf('if (cachedData.headers) {');
  const end = source.indexOf('// Add the cache tags header', start);
  if (start < 0 || end < start) throw new Error(`Cached header block not found in ${file}`);
  const block = source.slice(start, end);
  if ((block.match(/res\.appendHeader\(/g) ?? []).length !== 3) {
    throw new Error(`Unexpected cached header implementation in ${file}`);
  }
  const patched = block.replace('if (cachedData.headers) {',
    `if (cachedData.headers) {\n                    ${marker}\n                    const cachedResponse = new ${constructor}(res);`)
    .replaceAll('res.appendHeader(', 'cachedResponse.appendHeader(');
  await writeFile(target, source.slice(0, start) + patched + source.slice(end));
  console.log(`Patched Next cached redirect headers: ${file}`);
}
