import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** حدود الخطأ في Next تستقبل { error, reset }: الزر يجب أن يستدعي reset فعلًا لا خاصية باسم آخر. */
test("error boundaries render with Next's { error, reset } contract and the retry button calls reset", async () => {
  await mkdir(`${process.cwd()}/tmp`, { recursive: true });
  const dir = await mkdtemp(`${process.cwd()}/tmp/error-boundary-`);
  try {
    await build({
      stdin: { contents: "export { default as RootError } from './app/tahrir/error'; export { default as AppError } from './app/tahrir/(app)/error';", loader: "ts", resolveDir: process.cwd() },
      outfile: `${dir}/subject.mjs`, bundle: true, platform: "node", format: "esm", packages: "external",
      plugins: [{ name: "fixture", setup(b) {
        b.onResolve({ filter: /^next\/link$/ }, () => ({ path: "next/link", namespace: "fixture" }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ loader: "js", resolveDir: process.cwd(), contents: "import {createElement} from 'react'; export default function Link({href,children}){return createElement('a',{href},children)}" }));
      } }],
    });
    const { RootError, AppError } = await import(`${dir}/subject.mjs`);
    for (const [name, Component, expectedTitle] of [["root", RootError, "تعذّر فتح لوحة التحكم"], ["app", AppError, "تعذّر فتح هذه الشاشة"]]) {
      let resets = 0;
      const props = { error: Object.assign(new Error("boom"), { digest: "d1" }), reset: () => { resets++; } };
      const html = renderToStaticMarkup(createElement(Component, props));
      assert.ok(html.includes(expectedTitle), `${name}: renders the Arabic title`);
      assert.ok(html.includes("إعادة المحاولة"), `${name}: renders the retry button`);
      assert.ok(html.includes('dir="rtl"'), `${name}: stays RTL`);
      assert.ok(!html.includes("boom"), `${name}: never prints the raw error to the visitor`);
      // The retry button must be wired to reset(), whatever the prop was previously misnamed.
      const nodes = (n) => !n || typeof n !== "object" ? [] : [n, ...[n.props?.children].flat(Infinity).flatMap(nodes)];
      const retry = nodes(Component(props)).find((n) => n.props?.onClick && [n.props.children].flat(Infinity).includes("إعادة المحاولة"));
      assert.ok(retry, `${name}: retry button found`);
      retry.props.onClick();
      assert.equal(resets, 1, `${name}: clicking retry calls reset once`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
