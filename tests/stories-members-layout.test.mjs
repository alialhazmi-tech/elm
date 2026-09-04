import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("صفحة المواد تتبع بنية صفحة الأعضاء في الفلاتر ورأس الجدول والإجراءات الظاهرة", async () => {
  const [page, toolbar, stories, members] = await Promise.all([
    read("app/tahrir/(app)/stories/page.tsx"),
    read("components/tahrir/stories/toolbar.tsx"),
    read("components/tahrir/stories/stories-table.tsx"),
    read("components/tahrir/members/members-client.tsx"),
  ]);

  assert.match(page, /<StoriesToolbar q=\{q\} series=\{seriesSlug\} \/>[\s\S]*rounded-lg border border-border\/80 bg-muted\/30 p-0\.5/);
  assert.match(toolbar, /className="h-8 w-52 bg-card/);
  assert.match(toolbar, /<SelectTrigger size="sm" className="h-8 w-36 bg-card/);
  assert.match(stories, />الإجراءات<\/TableHead>/);
  assert.doesNotMatch(stories, /MoreHorizontalIcon|DropdownMenu/);
  assert.match(stories, /title="فتح في المحرر"/);
  assert.match(stories, /title="عرض على الموقع"/);
  assert.match(stories, /title="أرشفة"/);
  assert.match(stories, /className="transition-colors hover:bg-muted\/30"/);

  for (const shared of ["border-b border-border/80 bg-muted/20", "font-display text-xs font-semibold", "size=\"icon-xs\""]) {
    assert.ok(stories.includes(shared), `ينقص جدول المواد النمط المشترك: ${shared}`);
    assert.ok(members.includes(shared), `ينقص جدول الأعضاء النمط المرجعي: ${shared}`);
  }
});
