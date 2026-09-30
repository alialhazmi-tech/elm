import Link from "next/link";
import { requireScreen } from "@/lib/tahrir/screen";
import { listJakReports } from "@/lib/tahrir/jak-reports";
import { JakReportIndex } from "@/components/jak-report-index";

export const dynamic = "force-dynamic";
export const metadata = { title: "معاينة قسم جاك العلم", robots: { index: false, follow: false } };
export default async function JakSectionPreview() {
  const gate = await requireScreen("jak.manage", "معاينة جاك العلم");
  if (!gate.ok) return gate.element;
  const reports = await listJakReports({ actor: gate.actor, limit: 100 });
  return <main className="grid gap-4">
    <div className="rounded-lg border p-4"><Link href="/tahrir/jak-reports">← إدارة جاك العلم</Link><p className="mt-2 text-sm text-muted-foreground">هذه معاينة خاصة لشكل القسم، تشمل المسودات الظاهرة في صفحة جاك العلم. التقارير غير المنشورة لا تظهر للجمهور.</p></div>
    <div className="sx-page"><JakReportIndex reports={reports.filter((report) => report.status !== "archived")} preview /></div>
  </main>;
}
