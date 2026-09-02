import { MediaClient } from "@/components/tahrir/media/media-client";
import { APPROVER_ROLES, getSession } from "@/lib/tahrir/auth";
import { countMedia, listMediaPage, type MediaFilter } from "@/lib/tahrir/service";

export const metadata = { title: "الوسائط" };
export const dynamic = "force-dynamic";

const PER_PAGE = 24;
const FILTERS = new Set<string>(["all", "ok", "pending"]);

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; p?: string; q?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const filter = (FILTERS.has(params.f ?? "") ? params.f : "all") as MediaFilter;
  const page = Math.max(1, Number(params.p) || 1);
  const q = (params.q ?? "").trim().slice(0, 80);

  // الصفحة والعدّادات معًا — المكتبة ~29 ألف صورة فلا تُجلب كاملة أبدًا.
  const [rows, counts] = await Promise.all([
    listMediaPage(filter, page, PER_PAGE, q || undefined).catch(() => []),
    countMedia(q || undefined).catch(() => ({ all: 0, ok: 0, pending: 0 })),
  ]);
  const total = counts[filter];

  return (
    <main className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-xl font-extrabold">الوسائط</h1>
        <span className="text-xs text-muted-foreground tabular-nums">{q ? `${counts.all} صورة تطابق «${q}»` : `${counts.all} صورة في المكتبة`}</span>
      </div>
      <MediaClient
        canClear={session ? APPROVER_ROLES.includes(session.role) : false}
        filter={filter}
        q={q}
        counts={counts}
        page={page}
        perPage={PER_PAGE}
        total={total}
        items={rows.map((row) => ({
          id: row.id,
          url: row.url,
          filename: row.filename,
          bytes: row.bytes,
          width: row.width,
          height: row.height,
          rightsCleared: row.rightsCleared === 1,
          flags: row.flags,
          uploadedBy: row.uploadedBy,
        }))}
      />
    </main>
  );
}
