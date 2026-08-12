import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

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

test("الواجهة العامة تقود إلى التسجيل الحقيقي والحساب محمي بالجلسة", async () => {
  const [header, account, signup] = await Promise.all([
    read("app/_components/site-chrome.tsx"),
    read("app/account/page.tsx"),
    read("app/join/page.tsx"),
  ]);
  assert.match(header, /href="\/join"/);
  assert.match(account, /memberAuth\.getSession/);
  assert.match(account, /redirect\("\/join"\)/);
  assert.match(signup, /JoinForm/);
});
