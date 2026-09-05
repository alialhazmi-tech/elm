import Link from "next/link";
import { Forbidden } from "@/components/tahrir/forbidden";
import { AuditBrowser } from "@/components/tahrir/audit-browser";
import { loadActor } from "@/lib/tahrir/access";
import { listAuditEntries } from "@/lib/tahrir/audit-data";
export const metadata = { title: "سجل التدقيق" };
export const dynamic = "force-dynamic";
export default async function AuditPage() {
  const actor = await loadActor();
  if (!actor?.can("audit.view"))
    return <Forbidden title="سجل التدقيق" permission="audit.view" />;
  const result = await listAuditEntries().catch(() => null);
  return (
    <main className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">سجل التدقيق</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          من نفّذ الإجراء، وماذا تغيّر، ومتى حدث.
        </p>
      </div>
      {result ? (
        <AuditBrowser rows={result.rows} loadedAt={result.loadedAt} />
      ) : (
        <div className="rounded-xl border bg-card p-6">
          <p role="alert">تعذر تحميل سجل التدقيق الآن.</p>
          <Link className="mt-3 inline-block underline" href="/tahrir/audit">
            إعادة المحاولة
          </Link>
        </div>
      )}
    </main>
  );
}
