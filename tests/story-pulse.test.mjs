import assert from "node:assert/strict";
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
