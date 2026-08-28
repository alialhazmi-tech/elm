import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyParity,
  extractCanonicals,
  extractSitemapLocations,
  normalizePath,
  parseArticlePath,
  toCsv,
} from "../scripts/audit-wp-parity.mjs";

test("normalizes encoded Arabic archive paths without changing the identity triple", () => {
  const path = normalizePath("https://alelm.net/politics/123/%D8%A7%D9%84%D8%B9%D9%84%D9%85/");
  assert.equal(path, "/politics/123/العلم");
  assert.deepEqual(parseArticlePath(path), {
    section: "politics",
    id: "123",
    slug: "العلم",
    path: "/politics/123/العلم",
  });
});

test("extracts sitemap locations and canonical links safely", () => {
  assert.deepEqual(
    extractSitemapLocations("<urlset><url><loc>https://alelm.net/a?x=1&amp;y=2</loc></url></urlset>"),
    ["https://alelm.net/a?x=1&y=2"],
  );
  assert.deepEqual(
    extractCanonicals('<html><link href="https://alelm.net/politics/123/a" rel="canonical"></html>'),
    ["https://alelm.net/politics/123/a"],
  );
});

test("classifies an exact live 200 only with one matching canonical", () => {
  const result = classifyParity({
    sourcePath: "https://alelm.net/politics/123/a",
    sourceId: "123",
    target: { id: "123", section: "politics", slug: "a", status: "published" },
    probe: { status: 200, canonicals: ["https://alelm.net/politics/123/a"], finalStatus: null, finalCanonicals: [] },
  });
  assert.equal(result.classification, "EXACT_200");
});

test("rejects a noncanonical 200 and accepts a permanent redirect to canonical 200", () => {
  const target = { id: "123", section: "varieties", slug: "a", status: "published" };
  const bad = classifyParity({
    sourcePath: "https://alelm.net/uncategorized/123/a",
    sourceId: "123",
    target,
    probe: { status: 200, canonicals: ["https://alelm.net/varieties/123/a"], finalStatus: null, finalCanonicals: [] },
  });
  assert.deepEqual({ classification: bad.classification, reason: bad.reason }, { classification: "CONFLICT", reason: "NONCANONICAL_URL_RETURNS_200" });

  const good = classifyParity({
    sourcePath: "https://alelm.net/uncategorized/123/a",
    sourceId: "123",
    target,
    probe: {
      status: 301,
      location: "https://alelm.net/varieties/123/a",
      canonicals: [],
      finalStatus: 200,
      finalCanonicals: ["https://alelm.net/varieties/123/a"],
    },
  });
  assert.equal(good.classification, "VALID_301");
});

test("marks a missing target row as inferred or live 404 with explicit evidence", () => {
  const inferred = classifyParity({ sourcePath: "/politics/123/a", sourceId: "123", target: null, probe: null });
  assert.deepEqual(inferred, { classification: "404", reason: "TARGET_ROW_ABSENT_INFERRED_404" });
  const live = classifyParity({ sourcePath: "/politics/123/a", sourceId: "123", target: null, probe: { status: 404 } });
  assert.deepEqual(live, { classification: "404", reason: "TARGET_404_LIVE" });
});

test("CSV output preserves commas, quotes and newlines", () => {
  assert.equal(toCsv([{ a: 'x,"y"', b: "سطر\nثان" }], ["a", "b"]), 'a,b\n"x,""y""","سطر\nثان"\n');
});
