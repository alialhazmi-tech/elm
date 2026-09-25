import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { getTableName } from "drizzle-orm";
import * as schema from "../db/schema.ts";

const pagePath = new URL("../app/prototype/membership/page.tsx", import.meta.url);
const clientPath = new URL("../app/prototype/membership/membership-prototype.tsx", import.meta.url);
const dataPath = new URL("../lib/membership/prototype-data.ts", import.meta.url);

test("النموذج محجوب في الإنتاج افتراضيًا ولا يقبل الفهرسة", async () => {
  const page = await readFile(pagePath, "utf8");
  assert.match(page, /NODE_ENV === "production"/);
  assert.match(page, /MEMBERSHIP_PROTOTYPE !== "1"/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /index: false, follow: false/);
});

test("رحلة العضوية التجريبية تغطي المحطات والحالات الأساسية", async () => {
  const client = await readFile(clientPath, "utf8");
  for (const marker of [
    "انضم إلى العلم",
    "تحقق من الرمز",
    "ما الذي يثير فضولك؟",
    "اقتراحات ذكية",
    "جهّزنا العلم لك",
    "لماذا ظهرت لي؟",
    "مسح الإشارات المستنتجة",
    "لا توجد مواد مناسبة الآن",
    "انتهت جلستك",
    "التوصيات الذكية غير متاحة",
  ]) assert.match(client, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("بيانات النموذج محلية ولا تستخدم قاعدة البيانات أو طلبات API", async () => {
  const [client, data] = await Promise.all([readFile(clientPath, "utf8"), readFile(dataPath, "utf8")]);
  assert.doesNotMatch(client, /fetch\s*\(|database|db\./);
  assert.doesNotMatch(data, /from ["']@\/db|fetch\s*\(/);
  assert.match(data, /prototypeStories/);
});

test("مخطط العضوية المعتمد مستقل عن مستخدمي التحرير", () => {
  assert.equal(getTableName(schema.memberProfiles), "member_profiles");
  assert.equal(getTableName(schema.memberInterests), "member_interests");
  assert.equal(schema.memberProfiles.authUserId.primary, true);
  assert.equal(schema.memberProfiles.authUserId.name, "auth_user_id");
  assert.equal(schema.memberInterests.memberId.notNull, true);
  const membershipTables = Object.entries(schema).filter(([name]) => name.startsWith("member"));
  assert.ok(membershipTables.length >= 2);
  for (const [name, table] of membershipTables) {
    for (const foreignKey of getTableConfig(table).foreignKeys) {
      assert.notEqual(getTableName(foreignKey.reference().foreignTable), "users", name);
    }
  }
});
