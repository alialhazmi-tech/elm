import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editorPath = new URL("../app/tahrir/_components/editor-client.tsx", import.meta.url);
const guardRoutePath = new URL("../app/api/tahrir/guard/route.ts", import.meta.url);

test("الحارس الحي والخادم يفحصان النص والصورة ونوع المادة بالمدخلات نفسها", async () => {
  const [editor, route] = await Promise.all([
    readFile(editorPath, "utf8"),
    readFile(guardRoutePath, "utf8"),
  ]);

  assert.match(editor, /JSON\.stringify\(\{ title: nextTitle, body: nextBodyText, image: nextImage \|\| null, format: nextFormat \}\)/);
  assert.match(route, /media: await guardMediaFor\(image\)/);
  assert.match(route, /surface: format === "jakalelm" \? "design" : undefined/);
});

test("واجهة الحارس لا تفتح بوابة الاعتماد قبل اكتمال الفحص", async () => {
  const editor = await readFile(editorPath, "utf8");

  assert.match(editor, /const gateOpen = !guardBusy && report\?\.canRequestApproval === true/);
  assert.match(editor, /جارٍ فحص المادة/);
  assert.match(editor, /await runGuard\(title, bodyText\(\), image, format\)/);
  assert.match(editor, /data\.blocking\.join\("، "\)/);
  assert.doesNotMatch(editor, /report \? report\.canRequestApproval : true/);
});
