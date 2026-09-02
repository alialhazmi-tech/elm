import { AiImagesClient } from "@/components/tahrir/ai/ai-images-client";
import { Panel } from "@/components/tahrir/overview/panel";
import { keyStatus, loadAiSettings } from "@/lib/ai/settings";
import { listMedia } from "@/lib/tahrir/service";

export const metadata = { title: "توليد الصور" };
export const dynamic = "force-dynamic";

export default async function AiImagesPage() {
  const [settings, media] = await Promise.all([loadAiSettings(), listMedia().catch(() => [])]);
  const recent = media.filter((row) => row.aiGenerated === 1).slice(0, 6);

  return (
    <main className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-xl font-extrabold">توليد الصور</h1>
        <span className="text-xs text-muted-foreground">ثلاثة أنماط بهوية العلم — وكل صورة تدخل المكتبة موثقة</span>
      </div>
      <AiImagesClient imagesEnabled={settings.tools.images} keyReady={keyStatus().image} />
      {recent.length > 0 ? (
        <Panel title="آخر ما وُلّد" href="/tahrir/media" hrefLabel="المكتبة كاملة">
          {recent.map((row) => (
            <div key={row.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-2 last:border-0">
              <span className="text-primary">✦</span>
              <span className="truncate text-xs">{row.filename}</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">{row.createdAt.slice(0, 10)}</span>
            </div>
          ))}
        </Panel>
      ) : null}
    </main>
  );
}
