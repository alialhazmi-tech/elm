import { SERIES } from "@/lib/content/series";
import { getSession } from "@/lib/tahrir/auth";
import { listForDashboard, listProposals } from "@/lib/tahrir/service";
import { ProposalDecision, ProposalForm } from "../../_components/series-client";

export const metadata = { title: "السلاسل" };
export const dynamic = "force-dynamic";

const PROPOSAL_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: "بانتظار القرار", cls: "warn" },
  accepted: { label: "مقبول — تفعيله إصدار تقني", cls: "ok" },
  rejected: { label: "مرفوض", cls: "block" },
};

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export default async function SeriesPage() {
  const session = await getSession();
  const [rows, proposals] = await Promise.all([
    listForDashboard().catch(() => []),
    listProposals().catch(() => []),
  ]);

  const weekAgo = daysAgoIso(7);
  const withCounts = SERIES.map((series) => {
    const all = rows.filter((row) => row.seriesSlug === series.slug);
    return {
      ...series,
      count: all.length,
      week: all.filter((row) => (row.publishedAt ?? "") >= weekAgo).length,
    };
  });
  const maxWeek = Math.max(1, ...withCounts.map((series) => series.week));

  return (
    <main className="th-screen">
      <div className="th-cols" style={{ gridTemplateColumns: "1.5fr 1fr", marginTop: 0 }}>
        <div>
          <div className="th-sergrid">
            {withCounts.map((series) => (
              <div
                className="th-sercard"
                key={series.slug}
                style={{ "--sc": series.color } as React.CSSProperties}
              >
                <div className="sh">
                  <span className="nm">{series.name}</span>
                  <span className="ct">{series.count} مادة</span>
                </div>
                <div className="ds">{series.description}</div>
                <div className="wk" title={`${series.week} هذا الأسبوع`}>
                  <i style={{ width: `${(series.week / maxWeek) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--t-ink3)", marginTop: 10, lineHeight: 1.8 }}>
            أسماء السلاسل وألوانها جزء من هوية الموقع المفحوصة بالعقود — تعديلها أو تفعيل سلسلة
            مقبولة يمر كإصدار تقني، لا من اللوحة.
          </div>
        </div>

        <div>
          <div className="th-panel">
            <div className="hd">
              <h2>اقتراح سلسلة جديدة</h2>
            </div>
            <ProposalForm />
          </div>

          {proposals.length > 0 && (
            <div className="th-panel" style={{ marginTop: 14 }}>
              <div className="hd">
                <h2>المقترحات</h2>
              </div>
              {proposals.map((proposal) => {
                const meta = PROPOSAL_LABELS[proposal.status] ?? PROPOSAL_LABELS.pending;
                return (
                  <div className="th-prop" key={proposal.id}>
                    <div className="ph">
                      {proposal.name}
                      <span className={`th-gchip ${meta.cls} st`}>{meta.label}</span>
                    </div>
                    <div className="pd">
                      <b>القيمة:</b> {proposal.valueCase} · <b>الفجوة:</b> {proposal.gapCase} ·{" "}
                      <b>الأثر:</b> {proposal.impactCase}
                      <br />
                      اقترحها {proposal.proposedBy} — {proposal.createdAt.slice(0, 10)}
                      {session?.role === "chief" && proposal.status === "pending" && (
                        <>
                          {" · "}
                          <ProposalDecision id={proposal.id} />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
