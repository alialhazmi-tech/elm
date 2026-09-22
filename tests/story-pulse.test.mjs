import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { publicRecencyIso } from "../lib/content/recency.ts";

test("النبض يتقدم في الترتيب وتاريخ النشر يبقى المرجع عند غيابه", () => {
  const published = "2024-03-01T08:00:00.000Z";
  const pulsed = "2026-09-22T07:30:00.000Z";
  assert.equal(publicRecencyIso({ boostedAt: pulsed, publishedAt: published }), pulsed);
  assert.equal(publicRecencyIso({ boostedAt: null, publishedAt: published }), published);
  assert.equal(publicRecencyIso({ boostedAt: "  ", publishedAt: published }), published);
  assert.equal(publicRecencyIso({}), "");
  const older = { publishedAt: "2026-09-22T06:00:00.000Z" };
  const boosted = { publishedAt: published, boostedAt: pulsed };
  assert.ok(publicRecencyIso(boosted) > publicRecencyIso(older));
});

test("النبض لمادة واحدة: نبض مادة جديدة يعيد السابقة إلى موضع تاريخ نشرها", async () => {
  const service = await readFile(new URL("../lib/tahrir/service.ts", import.meta.url), "utf8");
  const body = service.slice(service.indexOf("export async function pulseStory"), service.indexOf("export async function restoreArchived"));
  assert.match(body, /ne\(stories\.id, id\)/);
  assert.match(body, /set\(\{ boostedAt: null \}\)/);
  assert.match(body, /PULSE_END_ACTION/);
  // المسح داخل نفس الدفعة الذرية مع النبض الجديد.
  assert.ok(body.indexOf("boostedAt: null") > body.indexOf("db.batch(["));
});
