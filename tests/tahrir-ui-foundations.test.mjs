import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { build } from "esbuild";

import { formatRiyadhDate, formatRiyadhDateTime, formatRiyadhTime } from "../lib/format.ts";
import { API_MESSAGES, apiCall } from "../lib/tahrir/client-api.ts";
import { pageRange, pageWindow } from "../lib/tahrir/pagination.ts";
import { guardDbPush, isLocalDatabaseUrl } from "../scripts/guard-db-push.mjs";

/** fetch وهمي يسجّل الطلب ويعيد استجابة مُعدّة أو يفشل بالشكل المطلوب. */
function withFetch(impl, run) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return impl(url, init);
  };
  return run(calls).finally(() => {
    globalThis.fetch = original;
  });
}

test("apiCall يسلسل JSON ويعيد البيانات عند النجاح ويحترم الرأس والمهلة", async () => {
  await withFetch(
    async () => new Response(JSON.stringify({ id: "s1", saved: true }), { status: 200, headers: { "Content-Type": "application/json" } }),
    async (calls) => {
      const result = await apiCall("/api/tahrir/x", { method: "POST", body: { title: "عنوان" } });
      assert.deepEqual(result, { ok: true, status: 200, data: { id: "s1", saved: true } });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].init.method, "POST");
      assert.equal(calls[0].init.body, JSON.stringify({ title: "عنوان" }));
      assert.equal(calls[0].init.headers.get("Content-Type"), "application/json");
      assert.equal(calls[0].init.headers.get("Accept"), "application/json");
      assert.ok(calls[0].init.signal instanceof AbortSignal);
    },
  );
});

test("apiCall يمرّر FormData كما هو بلا Content-Type ويعتبر 204 نجاحًا بلا بيانات", async () => {
  await withFetch(
    async () => new Response(null, { status: 204 }),
    async (calls) => {
      const form = new FormData();
      form.append("file", new Blob(["x"]), "a.png");
      const result = await apiCall("/api/tahrir/media", { method: "POST", body: form });
      assert.deepEqual(result, { ok: true, status: 204, data: null });
      assert.equal(calls[0].init.body, form);
      assert.equal(calls[0].init.headers.has("Content-Type"), false);
    },
  );
});

test("apiCall يعيد رسالة الخادم العربية عند 4xx ونص الشاشة عند غيابها", async () => {
  await withFetch(
    async () => new Response(JSON.stringify({ error: "المادة مقفلة لمحرر آخر." }), { status: 409 }),
    async () => {
      const result = await apiCall("/api/tahrir/story", { method: "POST", body: {} });
      assert.deepEqual(result, { ok: false, status: 409, error: "المادة مقفلة لمحرر آخر." });
    },
  );
  await withFetch(
    async () => new Response(JSON.stringify({ ok: false }), { status: 400 }),
    async () => {
      const result = await apiCall("/api/tahrir/story", { method: "POST", body: {} }, { fallback: "تعذر الحفظ." });
      assert.deepEqual(result, { ok: false, status: 400, error: "تعذر الحفظ." });
    },
  );
  await withFetch(
    async () => new Response("", { status: 403 }),
    async () => {
      const result = await apiCall("/api/tahrir/story", { method: "DELETE" });
      assert.equal(result.ok, false);
      assert.equal(result.status, 403);
      assert.match(result.error, /صلاحية/);
    },
  );
});

test("apiCall لا يرمي على استجابة غير JSON ولا على تعطل الشبكة", async () => {
  await withFetch(
    async () => new Response("<html>gateway</html>", { status: 200 }),
    async () => {
      const result = await apiCall("/api/tahrir/story");
      assert.deepEqual(result, { ok: false, status: 200, error: API_MESSAGES.parse });
    },
  );
  await withFetch(
    async () => new Response("<html>502</html>", { status: 502 }),
    async () => {
      const result = await apiCall("/api/tahrir/story", {}, { fallback: "تعذر تنفيذ الإجراء." });
      assert.deepEqual(result, { ok: false, status: 502, error: "تعذر تنفيذ الإجراء." });
    },
  );
  await withFetch(
    async () => {
      throw new TypeError("Failed to fetch");
    },
    async () => {
      const result = await apiCall("/api/tahrir/story");
      assert.deepEqual(result, { ok: false, status: 0, error: API_MESSAGES.network });
    },
  );
});

test("apiCall ينهي الطلب بعد المهلة برسالة عربية ورمز 408", async () => {
  await withFetch(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(init.signal.reason));
      }),
    async () => {
      const started = Date.now();
      const result = await apiCall("/api/tahrir/slow", {}, { timeoutMs: 40 });
      assert.deepEqual(result, { ok: false, status: 408, error: API_MESSAGES.timeout });
      assert.ok(Date.now() - started < 2_000);
    },
  );
});

test("منسّقات الرياض تعطي أرقامًا لاتينية وتوقيت الرياض وتتحمل القيم الغائبة", () => {
  const iso = "2026-09-09T11:05:09Z"; // 14:05 بتوقيت الرياض
  assert.equal(formatRiyadhDate(iso), "9 سبتمبر 2026");
  assert.equal(formatRiyadhDate(iso, "short"), "9 سبتمبر");
  assert.equal(formatRiyadhTime(iso), "14:05");
  assert.equal(formatRiyadhTime(iso, { seconds: true }), "14:05:09");
  assert.equal(formatRiyadhDateTime(iso), "9 سبتمبر 2026، 14:05");
  assert.equal(formatRiyadhDateTime("2026-09-08T22:30:00Z", { style: "short" }), "9 سبتمبر، 01:30");
  assert.equal(formatRiyadhDate(null), "");
  assert.equal(formatRiyadhDateTime("not-a-date"), "");
  for (const value of [formatRiyadhDate(iso), formatRiyadhTime(iso), formatRiyadhDateTime(iso)]) {
    assert.doesNotMatch(value, /[٠-٩]/, "لا أرقام عربية-هندية");
  }
});

test("نافذة الترقيم تُبقي الأولى والأخيرة والمجاورتين، والمدى يتعامل مع الصفر", () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(1, 3), [1, 2, 3]);
  assert.deepEqual(pageWindow(5, 10), [1, 4, 5, 6, 10]);
  assert.deepEqual(pageWindow(10, 10), [1, 9, 10]);
  assert.deepEqual(pageWindow(99, 10), [1, 9, 10], "صفحة خارج المدى تُقصّ إلى الأخيرة");
  assert.deepEqual(pageRange(1, 30, 0), { from: 0, to: 0 });
  assert.deepEqual(pageRange(1, 30, 45), { from: 1, to: 30 });
  assert.deepEqual(pageRange(2, 30, 45), { from: 31, to: 45 });
});

test("حارس db:push يقبل localhost فقط ويرفض Neon والفارغ والتالف", () => {
  assert.equal(isLocalDatabaseUrl("postgresql://me@localhost:5432/alelm_dev"), true);
  assert.equal(isLocalDatabaseUrl("postgresql://me@127.0.0.1/alelm"), true);
  assert.equal(isLocalDatabaseUrl("postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"), false);
  assert.equal(isLocalDatabaseUrl("postgresql://u@localhost.evil.com/db"), false);
  assert.equal(isLocalDatabaseUrl(""), false);
  assert.equal(isLocalDatabaseUrl("not a url"), false);
  const errors = [];
  const logs = [];
  const io = { log: (m) => logs.push(m), error: (m) => errors.push(m) };
  assert.equal(guardDbPush("postgresql://u@ep-x.neon.tech/neondb", io), 1);
  assert.match(errors[0], /مرفوض/);
  assert.match(errors[0], /ep-x\.neon\.tech/);
  assert.equal(guardDbPush("", io), 1);
  assert.equal(guardDbPush("postgresql://u@localhost/alelm", io), 0);
  assert.equal(logs.length, 1);
});

test("التنقل: عناوين أمان الحساب وسجل النسخ، وجاك العلم بند حي لا «قريبًا»، ودليل الاستخدام آخر مجموعته", async () => {
  await mkdir("tmp", { recursive: true });
  const dir = await mkdtemp("tmp/tahrir-nav-");
  try {
    await build({
      entryPoints: ["components/tahrir/nav.ts"],
      outfile: `${dir}/nav.mjs`,
      bundle: true,
      platform: "node",
      format: "esm",
      plugins: [
        {
          name: "icons",
          setup(b) {
            b.onResolve({ filter: /^lucide-react$/ }, () => ({ path: "lucide-react", namespace: "fixture" }));
            b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
              loader: "js",
              contents: 'export default new Proxy({}, { get: (_t, name) => () => name });' +
                "export const " + ["BookOpenIcon","ClipboardListIcon","BarChart3Icon","CalendarClockIcon","CheckCheckIcon","FileClockIcon","ImagesIcon","LayoutDashboardIcon","LayoutGridIcon","LayersIcon","ListIcon","PenLineIcon","ShieldCheckIcon","UsersIcon","ChartNoAxesColumnIcon","SparklesIcon","Settings2Icon","SlidersHorizontalIcon"].map((n) => `${n}=()=>"${n}"`).join(","),
            }));
          },
        },
      ],
    });
    const { NAV_GROUPS, navGroupsFor, pageTitleFor } = await import(`${process.cwd()}/${dir}/nav.mjs`);
    assert.equal(pageTitleFor("/tahrir/security", null), "أمان الحساب");
    assert.equal(pageTitleFor("/tahrir/history/story-id", null), "سجل النسخ");
    assert.equal(pageTitleFor("/tahrir/stories", "review"), "الاعتماد");
    const jak = NAV_GROUPS.flatMap((g) => g.items).find((item) => item.href === "/tahrir/jak");
    assert.equal(jak.comingSoon, undefined);
    const daily = NAV_GROUPS[0].items;
    assert.equal(daily[daily.length - 1].title, "دليل الاستخدام");
    assert.ok(navGroupsFor(["jak.manage"]).flatMap((g) => g.items).some((item) => item.href === "/tahrir/jak"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
