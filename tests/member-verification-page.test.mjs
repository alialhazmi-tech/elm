import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("verification has its own guarded page and both verified/unverified states", async () => {
  await mkdir("tmp", { recursive: true });
  const dir = await mkdtemp(`${process.cwd()}/tmp/verify-page-`);
  try {
    await build({
      stdin: { contents: "export { default as Page } from './app/account/verify-email/page'; export { MemberEntry } from './app/_components/member-entry';", resolveDir: process.cwd(), loader: "ts" },
      outfile: `${dir}/subject.mjs`, bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic",
      plugins: [{ name: "isolated-session", setup(b) {
        b.onResolve({ filter: /\.css$/ }, () => ({ path: "empty", namespace: "fixture" }));
        b.onResolve({ filter: /^next\/(navigation|link|image)$/ }, ({ path }) => ({ path, namespace: "fixture" }));
        b.onResolve({ filter: /^@\/app\/_components\/site-chrome$/ }, () => ({ path: "chrome", namespace: "fixture" }));
        b.onResolve({ filter: /^@\/lib\/membership\/session$/ }, () => ({ path: "session", namespace: "fixture" }));
        b.onResolve({ filter: /^(\.\/actions|@\/app\/account\/actions)$/ }, () => ({ path: "actions", namespace: "fixture" }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ loader: "js", resolveDir: process.cwd(), contents: {
          empty: "",
          chrome: "export const SiteHeader=()=>null,SiteFooter=()=>null;",
          session: "export async function getMemberSession(){return {data:globalThis.__verificationUser?{user:globalThis.__verificationUser}:null}}",
          "next/navigation": "export function redirect(location){throw Object.assign(new Error('redirect'),{location})};export const usePathname=()=>'/';export const useRouter=()=>({});",
          "next/link": "import {createElement} from 'react';export default function Link(p){return createElement('a',p)}",
          "next/image": "import {createElement} from 'react';export default function Image(p){return createElement('img',p)}",
          actions: "export const changeMemberPassword=async()=>({}),saveAccountInterests=async()=>({}),sendMemberVerification=async()=>({}),updateMemberDetails=async()=>({}),verifyMemberEmail=async()=>({}),endMemberSession=async()=>({});",
        }[path] }));
      } }],
    });
    const { Page, MemberEntry } = await import(`${dir}/subject.mjs`);
    globalThis.__verificationUser = null;
    await assert.rejects(Page(), error => error.location === "/join?mode=signin&next=%2Faccount%2Fverify-email");
    globalThis.__verificationUser = { email: "reader@example.invalid", emailVerified: false };
    const unverified = renderToStaticMarkup(await Page());
    assert.match(unverified, /<h1>توثيق البريد الإلكتروني<\/h1>/);
    assert.match(unverified, /reader@example.invalid/);
    assert.match(unverified, /name="otp"/);
    assert.match(unverified, /إرسال رمز التحقق/);
    assert.doesNotMatch(unverified, /إعدادات الحساب|البيانات الشخصية|ac-profile-head/);
    assert.match(unverified, /href="\/account"/);
    globalThis.__verificationUser.emailVerified = true;
    const verified = renderToStaticMarkup(await Page());
    assert.match(verified, /موثّق بالفعل/);
    assert.doesNotMatch(verified, /<form|name="otp"/);
    const menu = renderToStaticMarkup(createElement(MemberEntry, { preview: { name: "قارئ", emailVerified: false } }));
    assert.match(menu, /class="account-menu-alert" href="\/account\/verify-email"/);
  } finally {
    delete globalThis.__verificationUser;
    await rm(dir, { recursive: true, force: true });
  }
});
