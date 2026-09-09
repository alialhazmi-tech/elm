import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

/**
 * ميزانية JavaScript المضغوط (gzip) لمسارين:
 * - الرئيسية العامة `/`: من وسوم <script> في HTML المُرسَل مسبقًا (كما كان).
 * - محرر اللوحة `/tahrir/editor/[id]`: ديناميكي بلا HTML، فتُقرأ قطع العميل من
 *   page_client-reference-manifest.js + rootMainFiles/polyfills من build-manifest الخاص بالمسار.
 *   القياس الأول (2026-09-09): 460.9 KiB؛ السقف 10% فوقه ولا يُرفع.
 */
const DIST = process.env.NEXT_DIST_DIR ?? ".next";
const KiB = 1024;

const ROUTES = [
  { route: "/", budgetBytes: 200 * KiB, collect: () => homeScripts() },
  { route: "/tahrir/editor/[id]", budgetBytes: 507 * KiB, collect: () => appRouteScripts("/tahrir/(app)/editor/[id]") },
];

async function homeScripts() {
  const htmlPath = `${DIST}/server/app/index.html`;
  const html = await readFile(htmlPath, "utf8");
  const paths = [...new Set([...html.matchAll(/<script[^>]+src="\/_next\/([^"]+\.js)"[^>]*>/g)].map((match) => match[1]))];
  if (paths.length === 0) throw new Error(`No JavaScript assets found in ${htmlPath}`);
  return paths;
}

async function appRouteScripts(appPath) {
  const base = `${DIST}/server/app${appPath}`;
  const manifest = await readFile(`${base}/page_client-reference-manifest.js`, "utf8");
  const paths = new Set();
  for (const group of manifest.matchAll(/"chunks":\[([^\]]*)\]/g)) {
    for (const chunk of group[1].matchAll(/"\/_next\/([^"]+\.js)"/g)) paths.add(chunk[1]);
  }
  const buildManifest = JSON.parse(await readFile(`${base}/page/build-manifest.json`, "utf8"));
  for (const file of [...(buildManifest.rootMainFiles ?? []), ...(buildManifest.polyfillFiles ?? [])]) paths.add(file);
  if (paths.size === 0) throw new Error(`No client chunks found for ${appPath} in ${base}`);
  return [...paths];
}

async function measure(paths) {
  const assets = await Promise.all(
    paths.map(async (relativePath) => {
      const source = await readFile(`${DIST}/${relativePath}`);
      return { path: relativePath, rawBytes: source.length, gzipBytes: gzipSync(source).length };
    }),
  );
  return { assets, gzipBytes: assets.reduce((total, asset) => total + asset.gzipBytes, 0) };
}

const results = [];
for (const entry of ROUTES) {
  const { assets, gzipBytes } = await measure(await entry.collect());
  results.push({
    route: entry.route,
    budgetBytes: entry.budgetBytes,
    budgetKiB: entry.budgetBytes / KiB,
    gzipBytes,
    gzipKiB: Number((gzipBytes / KiB).toFixed(1)),
    pass: gzipBytes <= entry.budgetBytes,
    assets,
  });
}

console.log(JSON.stringify(results, null, 2));

const failed = results.filter((result) => !result.pass);
if (failed.length > 0) {
  throw new Error(
    failed.map((result) => `${result.route} JavaScript is ${result.gzipKiB}KiB gzip; budget is ${result.budgetKiB}KiB.`).join("\n"),
  );
}
