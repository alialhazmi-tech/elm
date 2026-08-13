import Link from "next/link";

import { listAudit } from "@/lib/tahrir/service";

export const metadata = { title: "سجل التدقيق" };
export const dynamic = "force-dynamic";

/** تصنيف الأفعال إلى مجموعات فلترة وأصناف ألوان. */
function actionMeta(action: string): { label: string; cls: string; group: string } {
  if (action.startsWith("publish") || action === "status:published")
    return { label: "نشر", cls: "pub", group: "pub" };
  if (action === "status:review") return { label: "طلب اعتماد", cls: "rev", group: "rev" };
  if (action === "status:scheduled") return { label: "جدولة", cls: "rev", group: "rev" };
  if (action === "schedule:blocked") return { label: "أوقفه الحارس", cls: "blk", group: "blk" };
  if (action === "story:archive") return { label: "أرشفة", cls: "blk", group: "blk" };
  if (action === "story:restore") return { label: "استعادة", cls: "rev", group: "rev" };
  if (action === "draft:delete") return { label: "حذف مسودة", cls: "blk", group: "blk" };
  if (action.startsWith("media:")) return { label: "وسائط", cls: "sav", group: "sav" };
  if (action.startsWith("series:")) return { label: "سلاسل", cls: "rev", group: "rev" };
  if (action === "login") return { label: "دخول", cls: "sav", group: "sav" };
  return { label: "حفظ", cls: "sav", group: "sav" };
}

const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f } = await searchParams;
  const rows = await listAudit(200).catch(() => []);

  const groups = [
    { key: undefined, label: "الكل", count: rows.length },
    { key: "pub", label: "نشر", count: 0 },
    { key: "rev", label: "اعتماد وجدولة", count: 0 },
    { key: "blk", label: "منع الحارس", count: 0 },
    { key: "sav", label: "حفظ ودخول", count: 0 },
  ];
  for (const row of rows) {
    const group = actionMeta(row.action).group;
    const entry = groups.find((item) => item.key === group);
    if (entry) entry.count += 1;
  }

  const visible = f ? rows.filter((row) => actionMeta(row.action).group === f) : rows;

  return (
    <main className="th-screen">
      <div className="th-filters">
        {groups.map((group) => (
          <Link
            key={group.label}
            className={`th-fch ${f === group.key || (!f && !group.key) ? "on" : ""}`}
            href={group.key ? `/tahrir/audit?f=${group.key}` : "/tahrir/audit"}
          >
            {group.label} <b>{group.count}</b>
          </Link>
        ))}
      </div>

      <div className="th-panel">
        {visible.length === 0 && <div className="th-empty">لا أحداث بهذا الفلتر.</div>}
        {visible.map((row) => {
          const meta = actionMeta(row.action);
          return (
            <div className="th-audrow" key={row.id}>
              <span className="at">{timeOf(row.at)}</span>
              <span className={`act ${meta.cls}`}>{meta.label}</span>
              <span className="tt4">
                {row.storyId ? (
                  <Link href={`/tahrir/editor/${row.storyId}`}>{row.detail || row.storyId}</Link>
                ) : (
                  row.detail || "—"
                )}
              </span>
              <span className="dt">{row.actor}</span>
            </div>
          );
        })}
        <div className="th-audlock">
          🔒 السجل يُدوَّن آليًا من الخادم وغير قابل للتعديل أو الحذف — مرجع المساءلة التحريرية
          الوحيد. (آخر 200 حدث)
        </div>
      </div>
    </main>
  );
}
