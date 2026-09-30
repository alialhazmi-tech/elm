import Link from "next/link";
import { requireScreen } from "@/lib/tahrir/screen";
import { listLatestByFormat } from "@/lib/tahrir/service";
export const metadata = { title: "جاك العلم المحدثة" };
export const dynamic = "force-dynamic";
export default async function RetiredJakPage() {
  const gate = await requireScreen("jak.manage", "جاك العلم المحدثة");
  if (!gate.ok) return gate.element;
  const reports = await listLatestByFormat("jakalelm", 100);
  return <main className="grid gap-4">
    <h1 className="text-xl font-bold">جاك العلم المحدثة</h1>
    <p className="rounded-lg border p-4">هذا القسم متوقف. التقارير والشرائح السابقة محفوظة للقراءة، وإضافة التقارير متاحة في قسم جاك العلم.</p>
    <Link className="text-primary underline" href="/tahrir/jak-reports">الانتقال إلى جاك العلم</Link>
    {reports.map(report => <Link key={report.id} className="rounded-lg border p-3" href={`/tahrir/jak/${report.id}`}>{report.title}</Link>)}
  </main>;
}
