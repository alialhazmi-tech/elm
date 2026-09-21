import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("المحرر يرفع صورة المادة عبر مكتبة الوسائط ويعينها ويفحص حقوقها", async () => {
  const [editor, details] = await Promise.all([
    readFile(new URL("../components/tahrir/editor/editor-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/tahrir/editor/details-panel.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(editor, /await uploadStoryImageFile\(file,/);
  assert.match(editor, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(editor, /setImage\(data\.url\)/);
  // الصورة المرفوعة تدخل الحارس الحي فور تعيينها (واجهة الترقيع الجديدة تحمل بقية القيم من الحالة).
  assert.match(editor, /guard\.scheduleGuard\(\{ image: data\.url, body: bodyHtml\(\) \}\)/);
  assert.match(editor, /يلزم توثيق الحقوق قبل الاعتماد/);
  assert.match(details, /إزالة الصورة/);
});
