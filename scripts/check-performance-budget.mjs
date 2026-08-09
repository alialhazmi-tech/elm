import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const DIST = process.env.NEXT_DIST_DIR ?? ".next";
const HTML_PATH = `${DIST}/server/app/index.html`;
const MAX_COMPRESSED_JS_BYTES = 200 * 1024;
const html = await readFile(HTML_PATH, "utf8");
const scriptPaths = [
  ...new Set(
    [...html.matchAll(/<script[^>]+src="\/_next\/([^"]+\.js)"[^>]*>/g)].map(
      (match) => match[1],
    ),
  ),
];

if (scriptPaths.length === 0) {
  throw new Error(`No JavaScript assets found in ${HTML_PATH}`);
}

const assets = await Promise.all(
  scriptPaths.map(async (relativePath) => {
    const source = await readFile(`${DIST}/${relativePath}`);
    return { path: relativePath, rawBytes: source.length, gzipBytes: gzipSync(source).length };
  }),
);

const gzipBytes = assets.reduce((total, asset) => total + asset.gzipBytes, 0);
const result = {
  route: "/",
  budgetBytes: MAX_COMPRESSED_JS_BYTES,
  gzipBytes,
  gzipKiB: Number((gzipBytes / 1024).toFixed(1)),
  pass: gzipBytes <= MAX_COMPRESSED_JS_BYTES,
  assets,
};

console.log(JSON.stringify(result, null, 2));

if (!result.pass) {
  throw new Error(
    `Homepage JavaScript is ${result.gzipKiB}KiB gzip; budget is ${MAX_COMPRESSED_JS_BYTES / 1024}KiB.`,
  );
}
