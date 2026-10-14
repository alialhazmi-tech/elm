import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";
import { prefersMarkdown, markdownPath, DISCOVERY_LINKS } from "../lib/agents/discovery.ts";
import { bodyMarkdown, articleMarkdown } from "../lib/agents/markdown.ts";

test("Markdown requires explicit acceptable preference and honors HTML quality", () => {
  for (const value of [null, "*/*", "text/*", "text/html", "text/markdown;q=0", "text/markdown;q=0,*/*;q=1", "text/html,text/markdown;q=0.5", "text/markdown;q=invalid"]) assert.equal(prefersMarkdown(value), false, String(value));
  for (const value of ["text/markdown", "text/markdown, text/html", "text/markdown;q=0.8,text/html;q=0.1", "TEXT/MARKDOWN", "text/markdown;q=0.5,text/*;q=0.1"]) assert.equal(prefersMarkdown(value), true, value);
});

test("negotiation stays out of sessions, CMS, APIs and interactive reports", () => {
  for (const path of ["/", "/health/123/خبر", "/varieties/123/test"]) assert.equal(markdownPath(path), true);
  for (const path of ["/api/viewer", "/api/content/v1", "/tahrir/editor/123", "/account/a/b", "/jak/123/خبر", "/podcasts/show", "/search", "/content.md", "/health/" + "1".repeat(65) + "/test"]) assert.equal(markdownPath(path), false, path);
});

test("Markdown preserves Arabic structure and citations without executable HTML", () => {
  const body = '<h2>عنوان &amp; تفاصيل</h2><p>نص <strong>مهم</strong> مع <a href="https://example.com/source?a=1&amp;b=2">مصدر</a>.</p><ol><li>الأول</li><li>الثاني</li></ol><blockquote>اقتباس</blockquote><script>SECRET_SCRIPT</script><p><a href="javascript:alert(1)">نص</a></p>';
  const result = bodyMarkdown(body);
  assert.match(result, /## عنوان & تفاصيل/);
  assert.match(result, /\*\*مهم\*\*/);
  assert.match(result, /\[مصدر\]\(https:\/\/example.com\/source\?a=1&b=2\)/);
  assert.match(result, /1\. الأول\n2\. الثاني/);
  assert.match(result, /> اقتباس/);
  assert.doesNotMatch(result, /SECRET_SCRIPT|javascript:|<script/);
  assert.match(bodyMarkdown("فقرة أولى\n\nفقرة ثانية"), /فقرة أولى\n\nفقرة ثانية/);
});

test("article text identifies its publisher and canonical URL without inventing transcripts", () => {
  const base = { title: "عنوان", description: "ملخص", url: "https://alelm.net/health/123/test", body: null,
    publishedAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z", videoUrl: "https://youtu.be/abc123", factCheck: null };
  const result = articleMarkdown(base);
  assert.match(result, /المصدر: \[العلم\]\(https:\/\/alelm.net\/health\/123\/test\)/);
  assert.match(result, /تاريخ التحديث: 2026-10-02/);
  assert.match(result, /لا يتضمن تفريغًا تلقائيًا/);
  assert.match(result, /لا يتوفر متن نصي إضافي/);
  assert.doesNotMatch(articleMarkdown({ ...base, updatedAt: "2026-09-01T00:00:00Z" }), /تاريخ التحديث/);
});

test("published discovery URLs and skill digests resolve to actual artifacts", async () => {
  const read = (path) => readFile(new URL(`../public${path}`, import.meta.url), "utf8");
  const index = JSON.parse(await read("/.well-known/agent-skills/index.json"));
  assert.equal(index.$schema, "https://schemas.agentskills.io/discovery/0.2.0/schema.json");
  for (const skill of index.skills) {
    const artifact = await read(new URL(skill.url).pathname);
    assert.equal(skill.digest, "sha256:" + createHash("sha256").update(artifact).digest("hex"));
    assert.ok(artifact.includes(`name: ${skill.name}`));
    assert.ok(artifact.includes(`description: ${skill.description}`));
  }
  const catalog = JSON.parse(await read("/.well-known/api-catalog"));
  assert.equal(catalog.linkset[0].anchor, "https://alelm.net/api/content/v1");
  for (const relation of ["service-desc", "service-doc"]) await read(new URL(catalog.linkset[0][relation][0].href).pathname);
  for (const match of DISCOVERY_LINKS.matchAll(/<([^>]+)>/g)) await read(match[1]);
  const api = JSON.parse(await read("/openapi.json"));
  assert.deepEqual(api.security, []);
  for (const path of Object.values(api.paths)) assert.deepEqual(Object.keys(path), ["get"]);
  const robots = await read("/robots.txt");
  assert.match(robots, /Content-Signal: ai-train=yes, search=yes, ai-input=yes/);
  assert.match(robots, /Disallow: \/api\//);
  assert.doesNotMatch(robots, /Allow: \/api\/\s/);
});
