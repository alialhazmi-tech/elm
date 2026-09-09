import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import {
  ADMIN_ROLE,
  hasPermission,
  isPermissionKey,
  LEGACY_ROLE_MAP,
  PERMISSION_KEYS,
  resolvePermissions,
  SYSTEM_ROLES,
  WILDCARD,
} from "../lib/tahrir/permissions.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("الكتالوج: مفاتيح فريدة، وكل افتراض لدور نظامي مفتاح معروف أو الشاملة", () => {
  assert.equal(new Set(PERMISSION_KEYS).size, PERMISSION_KEYS.length);
  assert.ok(PERMISSION_KEYS.length >= 25);
  for (const role of SYSTEM_ROLES) {
    for (const key of role.defaults) {
      assert.ok(key === WILDCARD || isPermissionKey(key), `${role.id}: ${key}`);
    }
  }
  const admin = SYSTEM_ROLES.find((role) => role.id === ADMIN_ROLE);
  assert.deepEqual(admin.defaults, [WILDCARD]);
  // رئيس التحرير لا يدير الأعضاء ولا الأدوار افتراضيًا — ذلك لمسؤول النظام.
  const chief = SYSTEM_ROLES.find((role) => role.id === "chief");
  assert.ok(!chief.defaults.includes("roles.manage") && !chief.defaults.includes("users.manage"));
  assert.ok(chief.defaults.includes("story.publish") && chief.defaults.includes("users.view"));
  // المحرر لا ينشر ولا يعتمد.
  const editor = SYSTEM_ROLES.find((role) => role.id === "editor");
  for (const key of ["story.publish", "story.approve", "story.archive", "users.view"]) assert.ok(!editor.defaults.includes(key), key);
  assert.equal(LEGACY_ROLE_MAP.approver, "managing_editor");
});

test("حلّ الصلاحيات: الاستثناء الفردي يمنح ويمنع، والشاملة لا تُستثنى", () => {
  const base = ["story.create", "story.submit"];
  const granted = resolvePermissions(base, [{ permissionKey: "story.publish", effect: "allow" }]);
  assert.ok(hasPermission(granted, "story.publish"));
  const denied = resolvePermissions(base, [{ permissionKey: "story.submit", effect: "deny" }]);
  assert.ok(!hasPermission(denied, "story.submit"));
  assert.ok(hasPermission(denied, "story.create"));
  const admin = resolvePermissions([WILDCARD], [{ permissionKey: "story.publish", effect: "deny" }]);
  assert.ok(hasPermission(admin, "story.publish"));
  assert.ok(hasPermission(admin, "anything.future"));
});

test("كل صلاحية في الكتالوج تُفرض في مسار API أو شاشة واحدة على الأقل", async () => {
  const roots = ["app/api/tahrir", "app/tahrir", "components/tahrir", "lib/tahrir"];
  const sources = [];
  for (const root of roots) {
    const entries = await readdir(new URL(`../${root}`, import.meta.url), { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name) || entry.name.endsWith("permissions.ts")) continue;
      sources.push(await readFile(`${entry.parentPath}/${entry.name}`, "utf8"));
    }
  }
  const corpus = sources.join("\n");
  for (const key of PERMISSION_KEYS) {
    assert.ok(corpus.includes(`"${key}"`), `صلاحية بلا موضع فرض: ${key}`);
  }
});

test("مسارات اللوحة تمر بالحارس الموحّد لا بفحص الدور المبثوث", async () => {
  const dir = new URL("../app/api/tahrir/", import.meta.url);
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || entry.name !== "route.ts") continue;
    const source = await readFile(`${entry.parentPath}/${entry.name}`, "utf8");
    const path = entry.parentPath.slice(dir.pathname.length);
    if (/^(login|logout|tick)$/.test(path)) continue;
    assert.doesNotMatch(source, /APPROVER_ROLES|session\.role|role === "chief"/, path);
    assert.match(source, /require(Permission|Actor)\(/, path);
  }
});

test("الجلسة تحمل الهوية فقط والفاعل يُحلّ من القاعدة مع فحص التعليق", async () => {
  const [access, login, layout, crypto] = await Promise.all([
    read("lib/tahrir/access.ts"),
    read("app/api/tahrir/login/route.ts"),
    read("app/tahrir/(app)/layout.tsx"),
    read("lib/tahrir/crypto.ts"),
  ]);
  assert.match(access, /user\.status !== "active"\) return null/);
  assert.match(access, /ROLE_CACHE_MS = 30_000/);
  assert.match(access, /mustChangePassword/);
  assert.match(login, /status === "suspended"/);
  assert.match(login, /lastLoginAt/);
  assert.match(layout, /loadActor\(\)/);
  assert.match(layout, /redirect\("\/tahrir\/password"\)/);
  assert.doesNotMatch(crypto, /APPROVER_ROLES/);
});

test("حارس آخر مسؤول نظام ومنع تعليق النفس وحماية الأدوار النظامية", async () => {
  const admin = await read("lib/tahrir/admin.ts");
  assert.match(admin, /لا يمكن تعليق آخر مسؤول نظام فعّال/);
  // تعليق النفس صار ضمن حارس «لا تعديل للحساب نفسه من شاشة الأعضاء» — السلوك مُختبر في permission-matrix.integration.
  assert.match(admin, /لا يمكنك تعليق عضويتك أنت/);
  assert.match(admin, /لا يمكنك تعديل حسابك من شاشة الأعضاء/);
  assert.match(admin, /الأدوار النظامية لا تُحذف/);
  assert.match(admin, /مسؤول النظام يملك كل الصلاحيات بحكم التعريف/);
  assert.match(admin, /invalidateRoleCache\(\)/);
});
