import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("أرشفة المادة تخفيها بالحالة ولا تحذف المنشور", async () => {
  const [service, archiveRoute, restoreRoute, deleteRoute] = await Promise.all([
    read("lib/tahrir/service.ts"),
    read("app/api/tahrir/story/archive/route.ts"),
    read("app/api/tahrir/story/restore/route.ts"),
    read("app/api/tahrir/story/route.ts"),
  ]);
  assert.match(service, /archived: "مؤرشفة"/);
  assert.match(service, /ARCHIVE_ACTION = "story:archive"/);
  assert.match(service, /if \(story\.status === "draft"\) return "is-draft"/);
  assert.match(service, /status: "archived"/);
  assert.match(service, /status: "draft"/);
  assert.match(archiveRoute, /APPROVER_ROLES/);
  assert.match(archiveRoute, /archiveStory/);
  assert.match(restoreRoute, /restoreArchived/);
  assert.match(deleteRoute, /الحذف النهائي متاح للمسودات فقط/);
});

test("واجهة المواد تعرض تاب المؤرشفة وسبب الأرشفة وتتطلب سببًا", async () => {
  const [page, table, actions, provider] = await Promise.all([
    read("app/tahrir/(app)/stories/page.tsx"),
    read("components/tahrir/stories/stories-table.tsx"),
    read("components/tahrir/stories/story-actions.tsx"),
    read("lib/content/provider.ts"),
  ]);
  assert.match(page, /key: "archived", label: "مؤرشفة"/);
  assert.match(page, /archiveEvents\.get/);
  // الأرشفة والاستعادة للمعتمدين فقط، ولا أرشفة لمسودة ولا لمؤرشفة.
  assert.match(table, /canArchive && row\.status !== "draft" && row\.status !== "archived"/);
  assert.match(table, /canArchive && row\.status === "archived"/);
  assert.match(table, /kind: "restore"/);
  // الحوار يطلب سببًا ولا يفعّل زر الأرشفة بدونه.
  assert.match(actions, /سبب الأرشفة/);
  assert.match(actions, /\/api\/tahrir\/story\/archive/);
  assert.match(actions, /disabled=\{busy \|\| reason\.trim\(\)\.length === 0\}/);
  assert.match(provider, /invalidateCorpus/);
  assert.match(provider, /eq\(storiesTable\.status, "published"\)/);
});
