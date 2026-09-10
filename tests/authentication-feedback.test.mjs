import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { build } from "esbuild";
import { memberSessionStore } from "../lib/membership/client-session.ts";

const form = (values) => { const data = new FormData(); Object.entries(values).forEach(([key, value]) => data.set(key, value)); return data; };

test("حالة الدخول المشتركة تبلغ النموذج عند اكتشاف الجلسة والخروج فقط", () => {
  memberSessionStore.update(false);
  let updates = 0;
  const stop = memberSessionStore.subscribe(() => updates++);
  assert.equal(memberSessionStore.getServerSnapshot(), false);
  memberSessionStore.update(true);
  assert.equal(memberSessionStore.getSnapshot(), true);
  memberSessionStore.update(true);
  assert.equal(updates, 1);
  memberSessionStore.update(false);
  assert.equal(memberSessionStore.getSnapshot(), false);
  assert.equal(updates, 2);
  stop();
  memberSessionStore.update(false);
});

test("التسجيل يرفض التأكيد الناقص والمختلف ويحفظ كلمة المرور حرفيًا ثم يحوّل المستخدم", async () => {
  await mkdir("tmp", { recursive: true });
  const directory = await mkdtemp(`${process.cwd()}/tmp/auth-feedback-`);
  globalThis.__feedbackAuth = { calls: [], completed: false };
  try {
    const mocks = {
      "@/lib/membership/auth": `export const memberAuthConfigured=true; export const memberAuth={signUp:{email:async data=>{globalThis.__feedbackAuth.calls.push(data);return {data:{user:{id:'reader'}}}}},signIn:{email:async()=>({data:{user:{id:'reader'}}})}};`,
      "@/lib/membership/profile": "export async function getMemberProfile(){return {onboardingCompleted:globalThis.__feedbackAuth.completed}}",
      "@/lib/membership/email/reset-receipt": "export function readResetReceipt(){}",
      "@/lib/membership/email/notifications": "export function notifyAccountChange(){}",
      "next/navigation": "export function redirect(url){throw new Error('REDIRECT:'+url)}",
    };
    await build({ entryPoints: ["app/join/actions.ts"], outfile: `${directory}/actions.mjs`, bundle: true, platform: "node", format: "esm", packages: "external", plugins: [{ name: "auth-fixtures", setup(b) {
      b.onResolve({ filter: /.*/ }, args => mocks[args.path] ? { path: args.path, namespace: "fixture" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: mocks[args.path], loader: "js" }));
    } }] });
    const { signUpMember, signInMember } = await import(`${directory}/actions.mjs`);
    const values = { name: "عضو تجريبي", email: " READER@example.invalid ", password: " Long! Password 123 " };
    assert.match((await signUpMember({}, form(values))).error, /غير متطابقتين/);
    assert.match((await signUpMember({}, form({ ...values, confirmPassword: values.password.trim() }))).error, /غير متطابقتين/);
    assert.equal(globalThis.__feedbackAuth.calls.length, 0);
    await assert.rejects(signUpMember({}, form({ ...values, confirmPassword: values.password })), /REDIRECT:\/welcome/);
    assert.deepEqual(globalThis.__feedbackAuth.calls[0], { name: values.name, email: "reader@example.invalid", password: values.password });
    await assert.rejects(signInMember({}, form(values)), /REDIRECT:\/welcome/);
    globalThis.__feedbackAuth.completed = true;
    await assert.rejects(signInMember({}, form({ ...values, next: "/series" })), /REDIRECT:\/series/);
    await assert.rejects(signInMember({}, form({ ...values, next: "https://untrusted.invalid" })), /REDIRECT:\/account/);
  } finally { delete globalThis.__feedbackAuth; await rm(directory, { recursive: true, force: true }); }
});
