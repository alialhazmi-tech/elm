import assert from "node:assert/strict";
import test from "node:test";

import { buildManifest, dedupeDecision, fetchAllPosts } from "../scripts/jak-reports-import.mjs";

function post(id, html = `<html>\r\n<script src="https://cdn.example.test/gsap.js"></script>\r\n<style>.x{color:red}</style>\r\n</html>`, css = "") {
  return {
    id,
    slug: `report-${id}`,
    link: `https://jakelelm.alelm.net/report-${id}/`,
    title: { rendered: `Report ${id}` },
    content: { rendered: "" },
    excerpt: { rendered: "" },
    meta: { custom_html: html, custom_css: css, show_on_homepage: true },
    date_gmt: "2026-01-01T00:00:00",
    modified_gmt: "2026-01-01T00:00:00",
    _embedded: {},
  };
}

function response(posts, total, totalPages) {
  return new Response(JSON.stringify(posts), {
    status: 200,
    headers: { "x-wp-total": String(total), "x-wp-totalpages": String(totalPages) },
  });
}

test("--all fetches every page and verifies x-wp-total", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    const page = Number(new URL(url).searchParams.get("page"));
    calls.push(page);
    return page === 1 ? response([post(1), post(2)], 3, 2) : response([post(3)], 3, 2);
  };

  const result = await fetchAllPosts(fetchImpl);
  assert.deepEqual(calls, [1, 2]);
  assert.equal(result.total, 3);
  assert.deepEqual(result.reports.map((report) => report.id), [1, 2, 3]);
  assert.equal(result.reports[0].html, post(1).meta.custom_html, "raw HTML must survive unchanged");
});

test("--all rejects a truncated or changing WordPress total", async () => {
  const fetchImpl = async (url) => {
    const page = Number(new URL(url).searchParams.get("page"));
    return page === 1 ? response([post(1)], 2, 2) : response([], 3, 2);
  };
  await assert.rejects(fetchAllPosts(fetchImpl), /تغير x-wp-total/);
});

test("dedupe is idempotent and preserves a locally changed report", () => {
  const report = { html: "same", css: "same" };
  assert.equal(dedupeDecision(null, report), "insert");
  assert.equal(dedupeDecision({ html: "same", css: "same" }, report), "skip-unchanged");
  assert.equal(dedupeDecision({ html: "edited locally", css: "same" }, report), "skip-conflict");
});

test("manifest records source paths, exact byte sizes, dependencies, and show flag", () => {
  const report = {
    id: 7,
    title: "Report 7",
    sourceUrl: "https://jakelelm.alelm.net/report-7/",
    html: "أ\r\n",
    css: "body{}",
    htmlSource: "meta.custom_html",
    cssSource: "meta.custom_css",
    showFlagPresent: true,
    showOnHomepage: true,
    inventory: {
      scripts: ["https://cdn.example.test/gsap.js"],
      styles: ["inline:1"],
      assetOrigins: ["https://cdn.example.test"],
      oxygenDependencies: [],
      globalScriptReferences: ["gsap"],
    },
  };
  const manifest = buildManifest([report], { total: 1, totalPages: 1, fetchedAt: "2026-09-30T00:00:00Z" });
  assert.deepEqual(manifest.reports[0], {
    sourceId: 7,
    sourceUrl: report.sourceUrl,
    sourcePath: "/report-7/",
    title: "Report 7",
    htmlSource: "meta.custom_html",
    htmlBytes: Buffer.byteLength(report.html),
    cssSource: "meta.custom_css",
    cssBytes: Buffer.byteLength(report.css),
    scripts: report.inventory.scripts,
    styles: report.inventory.styles,
    assetOrigins: report.inventory.assetOrigins,
    oxygenDependencies: [],
    globalScriptReferences: ["gsap"],
    showFlagPresent: true,
    showOnHomepage: true,
  });
});
