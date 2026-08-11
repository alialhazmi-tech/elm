import { SERIES } from "@/lib/content/series";
import { runPolicyGuard } from "@/lib/policy";
import { bodiesFor, listAudit, listLatestByStatus, listPage, seriesDistribution, statusCounts } from "@/lib/tahrir/service";

export const metadata = { title: "الإحصاءات" };
export const dynamic = "force-dynamic";

const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export default async function StatsPage() {
  const [counts, audit, recentPublished, distribution] = await Promise.all([
    statusCounts().catch(() => ({}) as Record<string, number>),
    listAudit(500).catch(() => []),
    listLatestByStatus("published", 400).catch(() => []),
    seriesDistribution().catch(() => []),
  ]);

  // إيقاع النشر آخر 14 يومًا حسب اليوم — من أحدث المنشور (خفيف بلا متون).
  const twoWeeksAgo = daysAgoIso(14);
  const recent = recentPublished.filter((row) => (row.publishedAt ?? "") >= twoWeeksAgo);
  const byDay = DAY_NAMES.map((name, index) => ({
    name,
    count: recent.filter((row) => new Date(row.publishedAt!).getDay() === index).length,
  }));
  const maxDay = Math.max(1, ...byDay.map((day) => day.count));

  // الحارس على أحدث 100 مادة — عينة حية بدل مسح الأرشيف كله في كل زيارة.
  const GUARD_SAMPLE = 100;
  const samplePage = await listPage(undefined, 1, GUARD_SAMPLE).catch(() => []);
  const sampleBodies = await bodiesFor(samplePage.map((row) => row.id));
  const guardTotals = { blocking: 0, warning: 0, suggestion: 0, clean: 0 };
  for (const [, content] of sampleBodies) {
    const report = runPolicyGuard({ title: content.title, body: content.body });
    guardTotals.blocking += report.counts.blocking;
    guardTotals.warning += report.counts.warning;
    guardTotals.suggestion += report.counts.suggestion;
    if (report.findings.length === 0) guardTotals.clean += 1;
  }
  const maxGuard = Math.max(1, guardTotals.blocking, guardTotals.warning, guardTotals.suggestion);

  const totalsBySlug = new Map(distribution.map((row) => [row.seriesSlug, row.total]));
  const seriesCounts = SERIES.map((series) => ({
    ...series,
    count: totalsBySlug.get(series.slug) ?? 0,
  })).sort((a, b) => b.count - a.count);
  const maxSeries = Math.max(1, ...seriesCounts.map((series) => series.count));
  const published = { length: counts.published ?? 0 };
  const rows = { length: Object.values(counts).reduce((sum, value) => sum + value, 0) };

  const guardBlocks = audit.filter(
    (row) => row.action === "schedule:blocked" || row.action.startsWith("series:proposal"),
  ).length;

  return (
    <main className="th-screen">
      <div className="th-statnote">
        ◈ مؤشرات القراء (الزيارات، زمن القراءة، الاكتمال) تتفعل مع القياس الميداني RUM عند النشر
        الإنتاجي على Cloudflare — لا نعرض أرقامًا غير مقاسة. ما تراه أدناه محسوب من قاعدة البيانات
        والحارس مباشرة.
      </div>

      <div className="th-tiles">
        <div className="th-tile">
          <div className="lb">مواد منشورة</div>
          <div className="v">{published.length}</div>
          <div className="tr">من إجمالي {rows.length}</div>
        </div>
        <div className="th-tile">
          <div className="lb">نُشر آخر 14 يومًا</div>
          <div className="v">{recent.length}</div>
          <div className="tr">{(recent.length / 14).toFixed(1)} مادة يوميًا</div>
        </div>
        <div className="th-tile">
          <div className="lb">مواد سليمة من الحارس</div>
          <div className="v">{guardTotals.clean}</div>
          <div className="tr up">من أحدث 100</div>
        </div>
        <div className="th-tile">
          <div className="lb">قراء الآن</div>
          <div className="v th-pending">بانتظار RUM</div>
          <div className="tr">يتفعل مع الإنتاج</div>
        </div>
      </div>

      <div className="th-cols">
        <div className="th-panel">
          <div className="hd">
            <h2>إيقاع النشر — آخر 14 يومًا بالأيام</h2>
          </div>
          <div className="th-cadence">
            {byDay.map((day) => (
              <div className={`cb ${day.count === maxDay && day.count > 0 ? "peak" : ""}`} key={day.name}>
                <i style={{ height: `${(day.count / maxDay) * 78}%` }} title={String(day.count)} />
                <span>{day.name}</span>
              </div>
            ))}
          </div>
          <div className="hd" style={{ borderTop: "1px solid var(--t-line)" }}>
            <h2>توزيع المنشور على السلاسل</h2>
          </div>
          <div className="th-serbars">
            {seriesCounts.map((series) => (
              <div
                className="th-serb"
                key={series.slug}
                style={{ "--sc": series.color } as React.CSSProperties}
              >
                <span>{series.name}</span>
                <span className="bar">
                  <i style={{ width: `${(series.count / maxSeries) * 100}%` }} />
                </span>
                <b>{series.count}</b>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="th-panel">
            <div className="hd">
              <h2>حارس السياسة — أحدث 100 مادة</h2>
            </div>
            <div className="th-serbars">
              <div className="th-serb" style={{ "--sc": "var(--t-block)" } as React.CSSProperties}>
                <span>قاطعة</span>
                <span className="bar">
                  <i style={{ width: `${(guardTotals.blocking / maxGuard) * 100}%` }} />
                </span>
                <b>{guardTotals.blocking}</b>
              </div>
              <div className="th-serb" style={{ "--sc": "var(--t-warn)" } as React.CSSProperties}>
                <span>تحذيرات</span>
                <span className="bar">
                  <i style={{ width: `${(guardTotals.warning / maxGuard) * 100}%` }} />
                </span>
                <b>{guardTotals.warning}</b>
              </div>
              <div className="th-serb" style={{ "--sc": "var(--t-sug)" } as React.CSSProperties}>
                <span>مقترحات</span>
                <span className="bar">
                  <i style={{ width: `${(guardTotals.suggestion / maxGuard) * 100}%` }} />
                </span>
                <b>{guardTotals.suggestion}</b>
              </div>
            </div>
          </div>

          <div className="th-panel" style={{ marginTop: 14 }}>
            <div className="hd">
              <h2>نشاط اللوحة</h2>
            </div>
            <div className="th-rythm">
              أحداث مسجلة: <b>{audit.length}</b> (آخر 500)
              <br />
              قرارات حوكمة (منع حارس + مقترحات): <b>{guardBlocks}</b>
              <br />
              التفصيل الكامل في <b>سجل التدقيق</b>.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
