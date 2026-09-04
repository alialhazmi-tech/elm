import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { runConfiguredPolicyGuard } from "../lib/policy/index.ts";

const draft = {
  title: "شاهد الآن",
  body: "نص قصير",
  media: [{ url: "/uploads/unverified.webp", rightsCleared: false }],
};

test("بوابتا السياسة وحقوق الصور مستقلتان وآمنتان افتراضيًا", async () => {
  const bothOn = runConfiguredPolicyGuard(draft, { editorialGuard: true, requireImageRights: true });
  assert.equal(bothOn.canRequestApproval, false);
  assert.ok(bothOn.findings.some((finding) => finding.kind === "image-rights"));
  assert.ok(bothOn.findings.some((finding) => finding.kind !== "image-rights"));

  const rightsOnly = runConfiguredPolicyGuard(draft, { editorialGuard: false, requireImageRights: true });
  assert.deepEqual(rightsOnly.findings.map((finding) => finding.kind), ["image-rights"]);
  assert.equal(rightsOnly.canRequestApproval, false);

  const policyOnly = runConfiguredPolicyGuard(draft, { editorialGuard: true, requireImageRights: false });
  assert.ok(policyOnly.findings.length > 0);
  assert.ok(policyOnly.findings.every((finding) => finding.kind !== "image-rights"));

  const bothOff = runConfiguredPolicyGuard(draft, { editorialGuard: false, requireImageRights: false });
  assert.equal(bothOff.findings.length, 0);
  assert.equal(bothOff.canRequestApproval, true);

  const settingsSource = await readFile(new URL("../lib/ai/settings.ts", import.meta.url), "utf8");
  assert.match(settingsSource, /editorialGuard: true/);
  assert.match(settingsSource, /requireImageRights: true/);
});

test("إعدادات النظام محمية ومدققة وتظهر في تنقل اللوحة", async () => {
  const [route, page, client, nav] = await Promise.all([
    readFile(new URL("../app/api/tahrir/settings/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/tahrir/(app)/settings/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/tahrir/settings/system-settings-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/tahrir/nav.ts", import.meta.url), "utf8"),
  ]);

  assert.match(route, /requirePermission\("ai\.settings"/);
  assert.match(route, /"system:settings"/);
  assert.match(route, /typeof incoming\.governance\.editorialGuard !== "boolean"/);
  assert.match(page, /إعدادات النظام/);
  assert.match(client, /حارس السياسة التحريرية/);
  assert.match(client, /اشتراط توثيق حقوق الصورة/);
  assert.match(nav, /href: "\/tahrir\/settings"/);
});

test("كل مسارات الإرسال والنشر والجدولة تفرض الإعدادات والصورة من الخادم", async () => {
  const paths = [
    "../app/api/tahrir/story/submit/route.ts",
    "../app/api/tahrir/story/publish/route.ts",
    "../app/api/tahrir/story/schedule/route.ts",
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /loadAiSettings\(\)/);
    assert.match(source, /guardMediaFor\(story\.image\)/);
    assert.match(source, /runConfiguredPolicyGuard/);
    assert.match(source, /settings\.governance/);
  }

  const service = await readFile(new URL("../lib/tahrir/service.ts", import.meta.url), "utf8");
  assert.match(service, /promoteDueScheduled[\s\S]*loadAiSettings\(\)[\s\S]*runConfiguredPolicyGuard/);
  assert.match(service, /const unknown = \[\{ url: imageUrl, rightsCleared: false/);
});

test("مفتش المحرر وتبويباته ومحتواها تُفرض عليها جهة RTL", async () => {
  const [editor, details, seo, guard, ai] = await Promise.all([
    readFile(new URL("../components/tahrir/editor/editor-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/tahrir/editor/details-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/tahrir/editor/seo-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/tahrir/editor/guard-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/tahrir/editor/ai-panel.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(editor, /<Card dir="rtl"/);
  assert.match(editor, /<Tabs dir="rtl"/);
  for (const panel of [details, seo, guard, ai]) assert.match(panel, /dir="rtl"/);
  assert.match(details, /<Select dir="rtl"/);
  assert.match(details, /<Input dir="ltr" placeholder="\/uploads/);
});
