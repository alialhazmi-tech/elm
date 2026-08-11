import Link from "next/link";

import { keyStatus, loadAiSettings } from "@/lib/ai/settings";
import { listMedia } from "@/lib/tahrir/service";
import { AiImagesClient } from "../../_components/ai-images-client";

export const metadata = { title: "توليد الصور" };
export const dynamic = "force-dynamic";

export default async function AiImagesPage() {
  const [settings, media] = await Promise.all([loadAiSettings(), listMedia().catch(() => [])]);
  const recent = media.filter((row) => row.aiGenerated === 1).slice(0, 6);

  return (
    <main className="th-screen">
      <AiImagesClient imagesEnabled={settings.tools.images} keyReady={keyStatus().image} />

      {recent.length > 0 && (
        <div className="th-panel" style={{ marginTop: 14 }}>
          <div className="hd">
            <h2>آخر ما وُلّد</h2>
            <Link className="mr" href="/tahrir/media">
              المكتبة كاملة ←
            </Link>
          </div>
          {recent.map((row) => (
            <div className="th-qrow" key={row.id}>
              <span className="th-ai-tag" style={{ flex: "none" }}>✦</span>
              <span className="t">{row.filename}</span>
              <span className="who">{row.createdAt.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
