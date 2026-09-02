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
  const [table, actions] = await Promise.all([
    readFile(new URL("../components/tahrir/stories/stories-table.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/tahrir/stories/story-actions.tsx", import.meta.url), "utf8"),
  ]);
  // الحذف لا يظهر إلا للمسودات — في قائمة الصف وفي الشريط الجماعي.
  assert.match(table, /row\.status === "draft" \? \(\s*<DropdownMenuItem variant="destructive"/);
  assert.match(table, /const drafts = selectedRows\.filter\(\(row\) => row\.status === "draft"\)/);
  // التأكيد حوار AlertDialog صريح لا تنفيذ فوري، والطلب DELETE على مسار المادة.
  assert.match(actions, /AlertDialogAction/);
  assert.match(actions, /call\("\/api\/tahrir\/story", "DELETE"/);
  assert.match(actions, /لا يمكن التراجع/);
});
