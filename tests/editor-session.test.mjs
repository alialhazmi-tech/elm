import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("editor navigation checks the live session without relying on a layout render", async () => {
  await mkdir("tmp", { recursive: true });
  const directory = await mkdtemp(`${process.cwd()}/tmp/editor-session-`);
  const fixture = {
    actor: null, canEdit: true, story: { id: "story", authorId: "another-user", format: "news" },
    reads: 0, storyError: null,
  };
  globalThis.__editorSession = fixture;
  try {
    await build({
      stdin: { contents: `
        export { default as EditorPage } from './app/tahrir/(app)/editor/[id]/page';
        export { requireScreen, requireScreenActor } from './lib/tahrir/screen';
      `, resolveDir: process.cwd(), loader: "ts" },
      outfile: `${directory}/subject.mjs`, bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic",
      plugins: [{ name: "editor-session-fixture", setup(builder) {
        const mocks = {
          "next/navigation": `export const redirect = location => { throw Object.assign(new Error('redirect'), { location }); }; export const notFound = () => { throw Object.assign(new Error('not found'), { status: 404 }); };`,
          "@/lib/tahrir/access": `export const loadActor = async () => globalThis.__editorSession.actor; export const canEditStory = () => globalThis.__editorSession.canEdit;`,
          "@/lib/ai/settings": `export const loadAiSettings = async () => { globalThis.__editorSession.reads++; return { governance: {} }; };`,
          "@/lib/content/taxonomy-settings": `export const loadEditorialTaxonomy = async () => ({ sections: [], series: [] });`,
          "@/lib/tahrir/service": `export const getStory = async () => { const f = globalThis.__editorSession; if (f.storyError) throw f.storyError; return f.story; }; export const listRecentMedia = async () => []; export const latestArchiveEvents = async () => new Map();`,
          "@/components/tahrir/editor/editor-client": `export const EditorClient = 'editor-fixture';`,
          "@/components/tahrir/forbidden": `export const Forbidden = 'forbidden-fixture';`,
        };
        builder.onResolve({ filter: /^\.\/access$/ }, args => args.importer.endsWith("/screen.ts") ? { path: "@/lib/tahrir/access", namespace: "fixture" } : undefined);
        builder.onResolve({ filter: /.*/ }, ({ path }) => path in mocks ? { path, namespace: "fixture" } : undefined);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: mocks[path], loader: "js" }));
      } }],
    });
    const { EditorPage, requireScreen } = await import(`${directory}/subject.mjs`);
    const page = (id = "story") => EditorPage({ params: Promise.resolve({ id }) });
    const active = { userId: "resumed-admin", can: () => true, mustChangePassword: false, mfaRequired: false };

    // A revoked session remains null after resumption until a fresh login.
    for (const id of ["story", "new"]) {
      await assert.rejects(page(id), error => error.location === "/tahrir/login");
    }
    assert.equal(fixture.reads, 0, "protected data must not load before session validation");
    await assert.rejects(requireScreen("jak.manage", "جاك العلم"), error => error.location === "/tahrir/login");

    fixture.actor = { ...active, mustChangePassword: true };
    await assert.rejects(page(), error => error.location === "/tahrir/password");
    fixture.actor = { ...active, mfaRequired: true };
    await assert.rejects(page(), error => error.location === "/tahrir/security");
    await assert.rejects(requireScreen("jak.manage", "جاك العلم"), error => error.location === "/tahrir/security");
    assert.equal(fixture.reads, 0);

    fixture.actor = active;
    const opened = await page();
    assert.equal(opened.props.children.type, "editor-fixture");
    assert.equal(opened.props.children.props.initial.id, "story");
    fixture.canEdit = false;
    const forbidden = await page();
    assert.equal(forbidden.type, "forbidden-fixture", "missing permission is visible instead of a silent bounce");
    assert.match(forbidden.props.message, /لا تملك صلاحية تعديل هذه المادة/);
    fixture.actor = { ...active, can: () => false };
    assert.equal((await requireScreen("jak.manage", "جاك العلم")).ok, false);

    fixture.actor = active;
    fixture.canEdit = true;
    fixture.story = null;
    await assert.rejects(page(), error => error.status === 404);
    assert.equal((await page("new")).props.children.props.initial, null);
    fixture.storyError = new Error("database connection failed");
    await assert.rejects(page(), fixture.storyError, "load errors reach the retry boundary instead of becoming a new draft");
    fixture.storyError = null;
    fixture.story = { id: "jak-story", format: "jakalelm" };
    await assert.rejects(page(), error => error.location === "/tahrir/jak/jak-story");
  } finally {
    delete globalThis.__editorSession;
    await rm(directory, { recursive: true, force: true });
  }
});

test("story rows explain denied editing and preserve allowed editor links", async () => {
  await mkdir("tmp", { recursive: true });
  const directory = await mkdtemp(`${process.cwd()}/tmp/story-edit-links-`);
  try {
    await build({
      entryPoints: ["components/tahrir/stories/stories-table.tsx"],
      outfile: `${directory}/table.mjs`, bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic",
      plugins: [{ name: "table-fixture", setup(builder) {
        const mocks = {
          "next/link": `export default 'a';`,
          "./story-actions": `export const useStoryActions=()=>({setAction:()=>{},dialogs:null});`,
          "@/components/tahrir/story-timeline": `export const StoryTimeline=()=>null;`,
        };
        builder.onResolve({ filter: /.*/ }, ({ path }) => path in mocks ? { path, namespace: "fixture" } : undefined);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: mocks[path], loader: "js" }));
      } }],
    });
    const { StoriesTable } = await import(`${directory}/table.mjs`);
    const row = { id: "story", title: "مقال لكاتب آخر", meta: "كاتب", series: null, guard: { tone: "ok", label: "سليم" }, status: "published", statusLabel: "منشورة", updated: "اليوم", href: null, publicHref: "/news/story", isJak: false };
    const render = href => renderToStaticMarkup(createElement(StoriesTable, { rows: [{ ...row, href }], canArchive: false }));
    const denied = render(null);
    assert.match(denied, /غير متاح للتحرير بصلاحياتك الحالية/);
    assert.doesNotMatch(denied, /فتح في المحرر|href="\/tahrir\/editor/);
    assert.match(denied, /href="\/news\/story"/);
    const allowed = render("/tahrir/editor/story");
    assert.match(allowed, /href="\/tahrir\/editor\/story"/);
    assert.match(allowed, /فتح في المحرر/);
    assert.doesNotMatch(allowed, /غير متاح للتحرير/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
