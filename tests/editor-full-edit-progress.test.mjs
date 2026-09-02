import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("التحرير الشامل يبث مراحله الفعلية ويحمي تعديلات المسودة", async () => {
  const [editorial, route, editor, fullEdit, css] = await Promise.all([
    read("lib/ai/editorial.ts"),
    read("app/api/tahrir/ai/assist/route.ts"),
    read("components/tahrir/editor/editor-client.tsx"),
    read("components/tahrir/editor/full-edit.tsx"),
    read("app/tahrir/shadcn.css"),
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
  assert.match(fullEdit, /التطبيق متوقف لحماية تعديلاتك/);
  // المفتّش تبويبات shadcn (Tabs/TabsList تعطي role="tablist" وقت التشغيل).
  assert.match(editor, /<TabsList/);
  assert.match(fullEdit, /th-full-progress/);

  assert.match(css, /@keyframes tahrir-shimmer/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.th-ai-shimmer/);
});
