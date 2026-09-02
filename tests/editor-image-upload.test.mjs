import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("المحرر يرفع صورة المادة عبر مكتبة الوسائط ويعينها ويفحص حقوقها", async () => {
  const [editor, details] = await Promise.all([
    readFile(new URL("../components/tahrir/editor/editor-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/tahrir/editor/details-panel.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(editor, /form\.append\("file", file\)/);
  assert.match(editor, /fetch\("\/api\/tahrir\/media", \{ method: "POST", body: form \}\)/);
  assert.match(editor, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(editor, /setImage\(data\.url\)/);
  assert.match(editor, /scheduleGuard\(title, bodyText\(\), data\.url, format\)/);
  assert.match(editor, /يلزم توثيق الحقوق قبل الاعتماد/);
  assert.match(details, /إزالة الصورة/);
});
