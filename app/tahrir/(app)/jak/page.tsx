import { SECTION_NAMES } from "@/lib/content/seed";
import { getSession } from "@/lib/tahrir/auth";
import { listMedia } from "@/lib/tahrir/service";
import { JakEditor } from "../../_components/jak-editor";

export const metadata = { title: "جاك العلم" };
export const dynamic = "force-dynamic";

/** إنشاء جاك علم جديد — حقلان وزر واحد، والتعقيد كله بعد التحليل. */
export default async function JakNewPage() {
  const session = await getSession();
  const mediaRows = await listMedia().catch(() => []);
  const recentMedia = mediaRows
    .filter((row) => row.rightsCleared === 1)
    .slice(0, 8)
    .map((row) => ({ url: row.url, filename: row.filename }));

  const sections = Object.entries(SECTION_NAMES).filter(([slug]) => slug !== "videos");

  return (
    <main className="th-screen">
      <JakEditor
        role={session?.role ?? "editor"}
        sections={sections}
        recentMedia={recentMedia}
        initial={null}
      />
    </main>
  );
}
