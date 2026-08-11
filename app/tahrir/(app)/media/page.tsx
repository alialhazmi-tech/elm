import { APPROVER_ROLES, getSession } from "@/lib/tahrir/auth";
import { listMedia } from "@/lib/tahrir/service";
import { MediaClient } from "../../_components/media-client";

export const metadata = { title: "الوسائط" };
export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const session = await getSession();
  const rows = await listMedia().catch(() => []);

  return (
    <main className="th-screen">
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
