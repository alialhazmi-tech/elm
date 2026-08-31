import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("التحرير الشامل يبث مراحله الفعلية ويحمي تعديلات المسودة", async () => {
  const [editorial, route, editor, css] = await Promise.all([
    read("lib/ai/editorial.ts"),
    read("app/api/tahrir/ai/assist/route.ts"),
    read("app/tahrir/_components/editor-client.tsx"),
    read("app/tahrir/tahrir.css"),
  ]);

  assert.match(editorial, /onFullEditProgress\?\.\("body_started"\)/);
  assert.match(editorial, /onFullEditProgress\?\.\("pack_started"\)/);
  assert.match(editorial, /onFullEditProgress\?\.\("body_ready"\)/);
  assert.match(editorial, /onFullEditProgress\?\.\("pack_ready"\)/);
  assert.match(editorial, /onFullEditProgress\?\.\("guard_checking"\)/);

  assert.match(route, /application\/x-ndjson/);
  assert.match(route, /"X-Accel-Buffering": "no"/);
  assert.match(route, /padding: " "\.repeat\(1100\)/);
  assert.match(route, /signal: request\.signal/);

  assert.match(editor, /response\.body\.getReader\(\)/);
  assert.match(editor, /fullEditStale/);
  assert.match(editor, /التطبيق متوقف لحماية تعديلاتك/);
  assert.match(editor, /role="tablist"/);
  assert.match(editor, /th-full-progress/);

  assert.match(css, /@keyframes th-ai-shimmer/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.th-inspector-tabs/);
});
