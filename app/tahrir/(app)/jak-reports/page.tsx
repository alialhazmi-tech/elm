import { JakReportList } from "@/components/tahrir/jak-reports/jak-report-list";
import { requireScreen } from "@/lib/tahrir/screen";
import { listJakReports } from "@/lib/tahrir/jak-reports";

export const metadata = { title: "جاك العلم" };
export const dynamic = "force-dynamic";

export default async function JakReportsPage() {
  const gate = await requireScreen("jak.manage", "جاك العلم");
  if (!gate.ok) return gate.element;
  const reports = await listJakReports({ actor: gate.actor, limit: 100 });
  return <main><JakReportList reports={reports} /></main>;
}
