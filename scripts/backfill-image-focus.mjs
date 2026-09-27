/**
 * ملء نقاط تركيز صور المواد المنشورة قبل الميزة — يخرج ملف SQL يُلصق في Neon.
 *
 * لا يقرأ القاعدة: القائمة من واجهة الجوال العامة، والكشف بنفس كاشف المحرر
 * (MediaPipe في Chrome محلي عبر Playwright)، والحساب بنفس imageFocusFromFaces.
 * كل UPDATE مشروط بأن الصورة لم تتغير وأن لا نقطة محفوظة، فيبقى آمنًا للتكرار
 * ولا يمس اختيار محرر.
 *
 *   npm i --no-save playwright
 *   node scripts/backfill-image-focus.mjs --out tmp/image-focus.sql [--origin https://alelm.net] [--limit 400]
 */
import { readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

import { allowsAutoImageFocus, imageFocusFromFaces } from "../lib/content/image-focus.ts";

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, list) => {
  if (value.startsWith("--")) pairs.push([value.slice(2), list[index + 1]]);
  return pairs;
}, []));
const origin = (args.origin ?? "https://alelm.net").replace(/\/$/, "");
const limit = Number(args.limit ?? 400);
if (!args.out) throw new Error("حدد ملف الإخراج: --out tmp/image-focus.sql");

let chromium;
try { ({ chromium } = await import("playwright")); }
catch { throw new Error("Playwright غير مثبت: npm i --no-save playwright"); }

async function json(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

// 1) القائمة: كل صفحات كل قسم، بلا تكرار.
const { sections } = await json(`${origin}/api/mobile/v1/taxonomy`);
const stories = new Map();
for (const { slug } of sections) {
  for (let page = 1; page; ) {
    const data = await json(`${origin}/api/mobile/v1/browse?kind=section&slug=${encodeURIComponent(slug)}&page=${page}`);
    for (const story of data.stories) if (story.image) stories.set(story.id, story);
    page = data.nextPage ?? null;
  }
}
const candidates = [...stories.values()]
  .filter((story) => allowsAutoImageFocus(story.format, story.section))
  .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
  .slice(0, limit);

// 2) الكاشف: صفحة محلية من نفس الأصل تقرأ بكسلات الصور بلا قيود CORS.
const root = process.cwd();
const vendor = path.join(root, "public", "vendor", "mediapipe");
const bundle = path.join(root, "node_modules", "@mediapipe", "tasks-vision", "vision_bundle.mjs");
const images = new Map();
const types = { ".mjs": "text/javascript", ".js": "text/javascript", ".wasm": "application/wasm", ".html": "text/html" };
const page = `<!doctype html><meta charset="utf-8"><script type="module">
import { FilesetResolver, FaceDetector } from "/tv.mjs";
const fileset = await FilesetResolver.forVisionTasks("/vendor/1.0.1/wasm");
const detector = await FaceDetector.createFromOptions(fileset, { baseOptions: { modelAssetPath: "/vendor/models/blaze_face_full_range.tflite" }, runningMode: "IMAGE", minDetectionConfidence: 0.5 });
window.detect = async (src) => {
  const image = new Image(); image.src = src; await image.decode();
  const faces = detector.detect(image).detections.flatMap((d) => d.boundingBox ? [{ ...d.boundingBox, score: d.categories[0]?.score ?? 0 }] : []);
  return { width: image.naturalWidth, height: image.naturalHeight, faces };
};
window.ready = true;
</script>`;
const server = http.createServer(async (request, response) => {
  const url = decodeURIComponent(request.url.split("?")[0]);
  try {
    if (url === "/") return response.writeHead(200, { "content-type": "text/html" }).end(page);
    if (url === "/tv.mjs") return response.writeHead(200, { "content-type": types[".mjs"] }).end(await readFile(bundle));
    if (url.startsWith("/img/")) return response.writeHead(200).end(images.get(url.slice(5)));
    if (url.startsWith("/vendor/")) {
      const file = path.join(vendor, path.normalize(url.slice(8)));
      if (!file.startsWith(vendor)) throw new Error("path");
      return response.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" }).end(await readFile(file));
    }
  } catch { /* 404 أدناه */ }
  response.writeHead(404).end();
}).listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ channel: "chrome" });
const tab = await browser.newPage();
await tab.goto(`${base}/`);
await tab.waitForFunction(() => window.ready === true, null, { timeout: 60_000 });

// 3) الحساب: رابط القاعدة كما خُزّن ("/uploads/…" لصور المنصة) شرطًا في كل UPDATE.
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const stored = (image) => (image.startsWith(`${origin}/uploads/`) ? image.slice(origin.length) : image);
const lines = [];
let withFaces = 0;
for (const [index, story] of candidates.entries()) {
  try {
    const response = await fetch(story.image);
    if (!response.ok) throw new Error(String(response.status));
    images.set(String(index), Buffer.from(await response.arrayBuffer()));
    const result = await tab.evaluate((src) => window.detect(src), `${base}/img/${index}`);
    images.delete(String(index));
    const focus = imageFocusFromFaces(result.width, result.height, result.faces);
    if (!focus) continue;
    withFaces += 1;
    lines.push(`UPDATE "stories" SET "image_focus" = ${quote(focus)} WHERE "image_focus" IS NULL AND "image" = ${quote(stored(story.image))} AND ("id" = ${quote(story.id)} OR "revision_of" = ${quote(story.id)});`);
  } catch (error) {
    console.warn(`تخطّي ${story.id}: ${error instanceof Error ? error.message : error}`);
  }
}
await browser.close();
server.close();

const header = [
  `-- نقاط تركيز صور المواد من كشف الوجوه — ${new Date().toISOString()}`,
  `-- ${candidates.length} مادة فُحصت، ${withFaces} فيها وجه. الباقي يبقى على المنتصف.`,
  "-- آمن للتكرار: لا يمس مادة لها نقطة محفوظة أو تغيّرت صورتها.",
];
await writeFile(args.out, [...header, "BEGIN;", ...lines, "COMMIT;", ""].join("\n"));
console.log(`${args.out}: ${withFaces}/${candidates.length}`);
