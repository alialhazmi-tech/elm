import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("مكتبة الوسائط تُرقَّم على الخادم ولا تُجلب كاملة في أي شاشة", async () => {
  const [service, mediaPage, client, pagination, editor, jakNew, jakEdit, aiImages] = await Promise.all([
    read("lib/tahrir/service.ts"),
    read("app/tahrir/(app)/media/page.tsx"),
    read("components/tahrir/media/media-client.tsx"),
    read("components/tahrir/pagination.tsx"),
    read("app/tahrir/(app)/editor/[id]/page.tsx"),
    read("app/tahrir/(app)/jak/page.tsx"),
    read("app/tahrir/(app)/jak/[id]/page.tsx"),
    read("app/tahrir/(app)/ai-images/page.tsx"),
  ]);
  // الاستعلام بحدّ وإزاحة، والعدّ بضربة تجميعية واحدة.
  assert.match(service, /export async function listMediaPage/);
  assert.match(service, /\.limit\(perPage\)\.offset\(Math\.max\(0, page - 1\) \* perPage\)/);
  assert.match(service, /export async function countMedia/);
  assert.match(service, /groupBy\(media\.rightsCleared\)/);
  assert.match(service, /export async function listRecentMedia/);
  // شاشة المكتبة تقرأ الصفحة والمرشّح والبحث من الاستعلام.
  assert.match(mediaPage, /listMediaPage\(filter, page, PER_PAGE, q \|\| undefined\)/);
  // الترقيم عبر المكوّن المشترك (components/tahrir/pagination.tsx) الذي يحمل تسمية التنقل.
  assert.match(client, /<Pagination[\s\S]*hrefFor=\{\(number\) => href\(\{ p: number > 1 \? String\(number\) : null \}\)\}/);
  assert.match(pagination, /ariaLabel = "ترقيم الصفحات"/);
  // لا شاشة تستدعي listMedia\(\) الكاملة بعد اليوم.
  for (const [name, source] of [["editor", editor], ["jak", jakNew], ["jak/[id]", jakEdit], ["ai-images", aiImages], ["media", mediaPage]]) {
    assert.doesNotMatch(source, /\blistMedia\(\)/, `${name} ما زالت تجلب المكتبة كاملة`);
  }
  assert.match(editor, /listRecentMedia\(\{[\s\S]*rightsCleared: settings\.governance\.requireImageRights \? true : undefined,[\s\S]*limit: 6/);
  assert.match(aiImages, /listRecentMedia\(\{ aiGenerated: true, limit: 6 \}\)/);
});
