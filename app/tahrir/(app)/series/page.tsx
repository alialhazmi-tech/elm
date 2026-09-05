import { GuardChip, SeriesTag } from "@/components/tahrir/badges";
import { Panel, PanelEmpty } from "@/components/tahrir/overview/panel";
import { ArchiveToggle, ProposalDecision, ProposalForm } from "@/components/tahrir/series/series-client";
import { Card } from "@/components/ui/card";
import { ARCHIVED_SERIES, SERIES } from "@/lib/content/series";
import { loadActor } from "@/lib/tahrir/access";
import { listProposals, listSeriesRows, seriesDistribution } from "@/lib/tahrir/service";

export const metadata = { title: "السلاسل" };
export const dynamic = "force-dynamic";

const PROPOSAL_LABELS: Record<string, { label: string; tone: "ok" | "warn" | "block" }> = {
  pending: { label: "بانتظار القرار", tone: "warn" },
  accepted: { label: "مقبول — تفعيله إصدار تقني", tone: "ok" },
  rejected: { label: "مرفوض", tone: "block" },
};

export default async function SeriesPage() {
  const actor = await loadActor();
  const [distribution, proposals, seriesRows] = await Promise.all([
    seriesDistribution().catch(() => []),
    listProposals().catch(() => []),
    listSeriesRows().catch(() => []),
  ]);
  const bySlug = new Map(distribution.map((row) => [row.seriesSlug, row]));
  const hiddenBySlug = new Map(seriesRows.map((row) => [row.slug, row.hidden === 1]));
  const canToggle = actor?.can("series.visibility") ?? false;
  const canDecide = actor?.can("series.decide") ?? false;

  const withCounts = SERIES.map((series) => ({
    ...series,
    count: bySlug.get(series.slug)?.total ?? 0,
    week: bySlug.get(series.slug)?.week ?? 0,
  }));
  const maxWeek = Math.max(1, ...withCounts.map((series) => series.week));

  return (
    <main className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-xl font-extrabold">السلاسل</h1>
        <span className="text-xs text-muted-foreground">{SERIES.length} سلاسل حية وأرشيف بمفتاح ظهور</span>
      </div>
      <div className="grid items-start gap-3 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {withCounts.map((series) => (
              <Card key={series.slug} className="gap-0 overflow-hidden py-0">
                <div className="h-1" style={{ background: series.color }} />
                <div className="grid gap-1 p-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-[13.5px] font-bold">{series.name}</span>
                    <span className="ms-auto text-[11px] text-muted-foreground tabular-nums">{series.count} مادة</span>
                  </div>
                  <div className="text-[11.5px] leading-relaxed text-muted-foreground">{series.description}</div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" title={`${series.week} هذا الأسبوع`}>
                    <i className="block h-full rounded-full" style={{ width: `${(series.week / maxWeek) * 100}%`, background: series.color }} />
                  </div>
                  <div className="text-[10.5px] text-muted-foreground tabular-nums">{series.week} هذا الأسبوع</div>
                </div>
              </Card>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            أسماء السلاسل وألوانها جزء من هوية الموقع المفحوصة بالعقود — تعديلها أو تفعيل سلسلة مقبولة يمر كإصدار تقني، لا
            من اللوحة.
          </p>
          <Panel title="أرشيف السلاسل — صفحات حية بمفتاح ظهور">
            {ARCHIVED_SERIES.map((series) => {
              const hidden = hiddenBySlug.get(series.slug) ?? true;
              const count = bySlug.get(series.slug)?.total ?? 0;
              return (
                <div key={series.slug} className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5 last:border-0">
                  <SeriesTag name={series.name} color={series.color} className="text-foreground" />
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {series.description} · {count} مادة
                  </span>
                  <GuardChip tone={hidden ? "warn" : "ok"} label={hidden ? "مخفية من الفهرس" : "ظاهرة في الفهرس"} />
                  {canToggle ? <ArchiveToggle slug={series.slug} hidden={hidden} /> : null}
                </div>
              );
            })}
            <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
              الإخفاء يرفع السلسلة من فهرس /series فقط — صفحتها وموادها وروابطها تبقى حية دائمًا.
            </p>
          </Panel>
        </div>
        <div className="grid gap-3">
          <Panel title="اقتراح سلسلة جديدة">
            <ProposalForm />
          </Panel>
          <Panel title="المقترحات">
            {proposals.length === 0 ? <PanelEmpty>لا مقترحات بعد.</PanelEmpty> : null}
            {proposals.map((proposal) => {
              const meta = PROPOSAL_LABELS[proposal.status] ?? PROPOSAL_LABELS.pending;
              return (
                <div key={proposal.id} className="grid gap-1.5 border-b px-4 py-3 last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-[13px]">{proposal.name}</b>
                    <GuardChip tone={meta.tone} label={meta.label} />
                  </div>
                  <div className="text-[11.5px] leading-relaxed text-muted-foreground">
                    <b className="text-foreground">القيمة:</b> {proposal.valueCase} · <b className="text-foreground">الفجوة:</b> {proposal.gapCase} ·{" "}
                    <b className="text-foreground">الأثر:</b> {proposal.impactCase}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    اقترحها {proposal.proposedBy} — {proposal.createdAt.slice(0, 10)}
                    {canDecide && proposal.status === "pending" ? <ProposalDecision id={proposal.id} /> : null}
                  </div>
                </div>
              );
            })}
          </Panel>
        </div>
      </div>
    </main>
  );
}
