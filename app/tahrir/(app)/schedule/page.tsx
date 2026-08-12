import Link from "next/link";

import { SERIES } from "@/lib/content/series";
import { editorHref } from "@/lib/tahrir/routes";
import { listLatestByStatus, promoteDueScheduled } from "@/lib/tahrir/service";

export const metadata = { title: "جدولة النشر" };
export const dynamic = "force-dynamic";

const seriesBySlug = new Map<string, (typeof SERIES)[number]>(
  SERIES.map((series) => [series.slug, series]),
);

const hourOf = (iso: string) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

const dayOf = (iso: string) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

export default async function SchedulePage() {
  // نبضة الترقية تعمل مع كل فتح للشاشة — والمراقب الخارجي يضرب /api/tahrir/tick.
  await promoteDueScheduled().catch(() => []);
  const [latestPublished, scheduled] = await Promise.all([
    listLatestByStatus("published", 60).catch(() => []),
    listLatestByStatus("scheduled", 100).catch(() => []),
  ]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayItems = [
    ...latestPublished.filter((row) => (row.publishedAt ?? "").startsWith(todayIso)),
    ...scheduled.filter((row) => (row.scheduledAt ?? "").startsWith(todayIso)),
  ]
    .map((row) => ({
      row,
      at: row.status === "scheduled" ? row.scheduledAt! : row.publishedAt!,
    }))
    .sort((a, b) => a.at.localeCompare(b.at));

  const upcoming = scheduled
    .filter((row) => !(row.scheduledAt ?? "").startsWith(todayIso))
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));

  return (
    <main className="th-screen">
      <div className="th-cols" style={{ gridTemplateColumns: "1.5fr 1fr", marginTop: 0 }}>
        <div className="th-panel">
          <div className="hd">
            <h2>جدول اليوم</h2>
            <Link className="mr" href="/tahrir/stories?status=scheduled">
              كل المجدول ←
            </Link>
          </div>
          {todayItems.length === 0 && (
            <div className="th-empty">لا نشر ولا جدولة اليوم بعد — الجدولة من داخل المحرر.</div>
          )}
          <div className="th-tl">
            {todayItems.map(({ row, at }) => {
              const series = row.seriesSlug ? seriesBySlug.get(row.seriesSlug) : undefined;
              return (
                <div
                  className="th-tlrow filled"
                  key={row.id}
                  style={{ "--sc": series?.color ?? "var(--t-navy)" } as React.CSSProperties}
                >
                  <span className="tm">{hourOf(at)}</span>
                  <div className="cell">
                    <Link className="th-tlcard" href={editorHref(row)}>
                      <span className="t">{row.title}</span>
                      {series && (
                        <span
                          className="th-serchip"
                          style={{ "--sc": series.color } as React.CSSProperties}
                        >
                          {series.name}
                        </span>
                      )}
                      {row.status === "published" ? (
                        <span className="th-gchip ok">نُشرت</span>
                      ) : (
                        <span className="th-pill sch">مجدولة</span>
                      )}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="th-panel">
            <div className="hd">
              <h2>القادم بعد اليوم</h2>
            </div>
            {upcoming.length === 0 && <div className="th-empty">لا مواد مجدولة لاحقًا.</div>}
            {upcoming.slice(0, 8).map((row) => (
              <Link className="th-qrow" key={row.id} href={editorHref(row)}>
                <span className="th-pill sch">{dayOf(row.scheduledAt!)}</span>
                <span className="t">{row.title}</span>
              </Link>
            ))}
          </div>

          <div className="th-panel" style={{ marginTop: 14 }}>
            <div className="hd">
              <h2>كيف تعمل الجدولة</h2>
            </div>
            <div className="th-rythm">
              الجدولة من المحرر ومن صلاحية <b>المعتمدين</b> — الحارس يفحص المادة عند الجدولة،
              ثم يفحصها <b>ثانية لحظة الموعد</b>: السليمة تُنشر آليًا، وأي مخالفة قاطعة توقف
              النشر وتعيدها للاعتماد مع تدوين السبب في السجل.
              <br />
              النبضة تعمل مع نشاط اللوحة، وللدقة الكاملة اربط مراقبًا خارجيًا بـ
              <b> /api/tahrir/tick</b> كل دقائق.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
