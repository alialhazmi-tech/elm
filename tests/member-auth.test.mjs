import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("رابط استعادة كلمة المرور لا يحمّل متتبعًا يقرأ رمز الاستعادة", async () => {
  const layout = await read("app/layout.tsx");
  const assignment = layout.match(/const tagManagerInit = `[^`]+`;/)?.[0];
  assert.ok(assignment);
  const script = runInNewContext(`${assignment}; tagManagerInit`);
  for (const pathname of ["/join/reset", "/join/reset/", "/tahrir/recover", "/tahrir/recover/"]) {
    runInNewContext(script, {
      window: { location: { pathname } },
      document: { createElement() { throw new Error("Tracker must not load on reset page"); } },
    });
  }
  let loaded = 0;
  runInNewContext(script, {
    window: { location: { pathname: "/" } },
    document: { createElement: () => ({}), getElementsByTagName: () => [{ parentNode: { insertBefore() { loaded++; } } }] },
  });
  assert.equal(loaded, 1);
});

test("عضوية الجمهور تستخدم Neon Auth ولا تعيد استخدام جلسة التحرير", async () => {
  const [memberAuth, tahrirAuth] = await Promise.all([
    read("lib/membership/auth.ts"),
    read("lib/tahrir/crypto.ts"),
  ]);
  assert.match(memberAuth, /@neondatabase\/auth\/next\/server/);
  assert.match(memberAuth, /NEON_AUTH_COOKIE_SECRET/);
  assert.doesNotMatch(memberAuth, /AUTH_SECRET|alelm_tahrir|lib\/tahrir/);
  assert.match(tahrirAuth, /alelm_tahrir/);
});

test("مسار العضوية يعيد 503 بأمان عندما تغيب إعدادات البيئة", async () => {
  const route = await read("app/api/auth/[...path]/route.ts");
  assert.match(route, /memberAuthConfigured/);
  assert.match(route, /status: 503/);
  for (const method of ["GET", "POST", "PUT", "DELETE", "PATCH"]) {
    assert.match(route, new RegExp(`export function ${method}`));
  }
});

test("نموذج التسجيل يتحقق خادميًا ولا يكشف وجود الحساب", async () => {
  const actions = await read("app/join/actions.ts");
  assert.match(actions, /password\.length < 8/);
  assert.match(actions, /emailPattern\.test/);
  assert.match(actions, /قد يكون البريد مستخدمًا أو البيانات غير مكتملة/);
  assert.doesNotMatch(actions, /console\.(log|error).*password/);
});

test("زر العضوية ظاهر في الهيدر ومسار التسجيل والحساب المحمي متاحان", async () => {
  const [header, account, signup, form] = await Promise.all([
    read("app/_components/site-chrome.tsx"),
    read("app/account/page.tsx"),
    read("app/join/page.tsx"),
    read("app/join/join-form.tsx"),
  ]);
  assert.match(header, /<MemberEntry/);
  assert.match(account, /getMemberSession/);
  assert.match(account, /redirect\("\/join"\)/);
  assert.match(signup, /JoinForm/);
  assert.match(form, /useActionState\(\s*signUpMember,\s*initialState,?\s*\)/);
  assert.match(form, /useActionState\(\s*signInMember,\s*initialState,?\s*\)/);
  assert.doesNotMatch(form, /const action = mode ===/);
});

test("نجاح التسجيل يبدأ الترحيب والاهتمامات ثم صفحة لك", async () => {
  const [actions, welcome, ready, feed, account, header] = await Promise.all([
    read("app/join/actions.ts"), read("app/welcome/page.tsx"), read("app/welcome/ready/page.tsx"),
    read("app/for-you/page.tsx"), read("app/account/page.tsx"), read("app/_components/member-entry.tsx"),
  ]);
  assert.match(actions, /redirect\("\/welcome"\)/);
  assert.match(welcome, /InterestPicker/);
  assert.match(ready, /جهّزنا العلم لك/);
  assert.match(feed, /صباح المعرفة/);
  assert.match(account, /getMemberAccountData/);
  assert.match(header, /\/api\/viewer/);
  assert.match(header, /الملف الشخصي/);
});
