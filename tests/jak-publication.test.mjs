import assert from "node:assert/strict";
import test from "node:test";
import { jakPublicationTime } from "../lib/jak-publication.ts";
import { formatArticleTimestamp } from "../lib/format.ts";

test("legacy WordPress UTC dates display the same Riyadh time in every server timezone", () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ["UTC", "Asia/Riyadh", "America/New_York"]) {
      process.env.TZ = zone;
      const iso = jakPublicationTime({ sourcePublishedAt: "2026-08-20T16:34:50", publishedAt: "2026-09-30T00:00:00Z" });
      assert.equal(iso, "2026-08-20T16:34:50Z");
      const display = formatArticleTimestamp(iso);
      assert.match(display, /20 أغسطس 2026/);
      assert.match(display, /07:34 م/);
      assert.doesNotMatch(display, /[٠-٩۰-۹]/);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("explicit offsets remain intact and native reports use their publication date", () => {
  for (const iso of ["2026-08-20T16:34:50Z", "2026-08-20T19:34:50+03:00"]) {
    assert.equal(jakPublicationTime({ sourcePublishedAt: iso, publishedAt: null }), iso);
    assert.equal(jakPublicationTime({ sourcePublishedAt: null, publishedAt: iso }), iso);
  }
});

test("missing or invalid dates do not invent a publication timestamp", () => {
  assert.equal(jakPublicationTime({ sourcePublishedAt: null, publishedAt: null }), undefined);
  assert.equal(jakPublicationTime({ sourcePublishedAt: "invalid", publishedAt: null }), undefined);
});
