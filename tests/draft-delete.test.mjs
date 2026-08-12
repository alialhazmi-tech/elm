import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("حذف المواد مقيد بالمسودات ويزيل بيانات جاك المرتبطة ويسجل التدقيق", async () => {
  const service = await readFile(new URL("../lib/tahrir/service.ts", import.meta.url), "utf8");
  assert.match(service, /if \(story\.status !== "draft"\) return "not-draft"/);
  assert.match(service, /delete from story_slides where story_id in \(select id from deleted_story\)/);
  assert.match(service, /delete from jak_sources where story_id in \(select id from deleted_story\)/);
  assert.match(service, /'draft:delete'/);
  assert.match(service, /return result\.rows\.length > 0 \? "deleted" : "not-draft"/);
});

test("واجهة المواد تعرض الحذف للمسودة فقط وتتطلب تأكيدًا صريحًا", async () => {
  const [page, button] = await Promise.all([
    readFile(new URL("../app/tahrir/(app)/stories/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/tahrir/_components/delete-draft-button.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /storyStatus === "draft" \? <DeleteDraftButton/);
  assert.match(button, /window\.confirm/);
  assert.match(button, /method: "DELETE"/);
  assert.match(button, /لا يمكن التراجع/);
});
