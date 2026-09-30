import assert from "node:assert/strict";
import test from "node:test";
import { jakIndexMetadata, jakReportMetadata } from "../lib/jak-sharing.ts";

test("Jak section shares its own identity and URL on Open Graph and Twitter", () => {
  const meta = jakIndexMetadata();
  assert.deepEqual(meta.title, { absolute: "جاك العلم" });
  assert.equal(meta.openGraph.title, "جاك العلم");
  assert.equal(meta.openGraph.siteName, "جاك العلم");
  assert.equal(meta.openGraph.url, "https://alelm.net/jak");
  assert.equal(meta.twitter.title, meta.openGraph.title);
  assert.equal(meta.twitter.description, meta.description);
  assert.equal(meta.twitter.card, "summary_large_image");
});

test("each report overrides inherited sharing tags with its own branded title and JPEG", () => {
  const report = { id: "82ad2759-12cb-4d33-a0ae-886b631aa728", slug: "الفيفا", title: "الفيفا لعبة المال والفساد", excerpt: "<p>وصف التقرير</p>", image: "https://jakelelm.alelm.net/wp-content/uploads/2026/08/cover.webp", publishedAt: "2026-09-30T00:00:00Z", sourcePublishedAt: "2026-08-01T00:00:00Z" };
  const meta = jakReportMetadata(report);
  assert.deepEqual(meta.title, { absolute: `${report.title} | جاك العلم` });
  assert.equal(meta.openGraph.title, meta.twitter.title);
  assert.equal(meta.openGraph.description, "وصف التقرير");
  assert.equal(meta.openGraph.siteName, "جاك العلم");
  assert.equal(meta.openGraph.type, "article");
  assert.equal(meta.openGraph.publishedTime, report.sourcePublishedAt);
  assert.equal(meta.openGraph.url, `https://alelm.net/jak/${report.id}/${encodeURIComponent(report.slug)}`);
  assert.match(meta.openGraph.images[0].url, /\/share-images\/jak-report-82ad2759-12cb-4d33-a0ae-886b631aa728\.v.+\.jpg$/);
  assert.equal(meta.twitter.images[0].url, meta.openGraph.images[0].url);
  assert.equal(meta.openGraph.images[0].type, "image/jpeg");
  assert.equal(meta.openGraph.images[0].width, 1200);
  assert.equal(meta.openGraph.images[0].height, 630);
  assert.match(jakReportMetadata({ ...report, image: null }).openGraph.images[0].url, /\/brand\/share.jpg/);
});
