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
  const [page, controls, provider] = await Promise.all([
    read("app/tahrir/(app)/stories/page.tsx"),
    read("app/tahrir/_components/archive-controls.tsx"),
    read("lib/content/provider.ts"),
  ]);
  assert.match(page, /href\("archived"\)/);
  assert.match(page, /مؤرشفة/);
  assert.match(page, /archiveEvents\.get/);
  assert.match(page, /ArchiveStoryButton/);
  assert.match(page, /RestoreStoryButton/);
  assert.match(controls, /سبب الأرشفة/);
  assert.match(controls, /\/api\/tahrir\/story\/archive/);
  assert.match(provider, /invalidateCorpus/);
  assert.match(provider, /eq\(storiesTable\.status, "published"\)/);
});
