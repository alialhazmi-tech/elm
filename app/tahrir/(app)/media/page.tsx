import { MediaClient } from "@/components/tahrir/media/media-client";
import { APPROVER_ROLES, getSession } from "@/lib/tahrir/auth";
import { listMedia } from "@/lib/tahrir/service";

export const metadata = { title: "الوسائط" };
export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const session = await getSession();
  const rows = await listMedia().catch(() => []);

  return (
    <main className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-xl font-extrabold">الوسائط</h1>
        <span className="text-xs text-muted-foreground tabular-nums">{rows.length} صورة في المكتبة</span>
      </div>
      <MediaClient
        canClear={session ? APPROVER_ROLES.includes(session.role) : false}
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
