import { homeRiver } from "@/lib/content/homeStream";
import { storyHref } from "@/lib/content/types";
import { relativeTimeAr } from "@/lib/format";
import { sectionName, seriesOf } from "@/lib/content/provider";

/** «الجديد الآن» — النهر الحي للرئيسية؛ يُستطلع من المتصفح كل دقيقتين. */
export async function GET(request: Request) {
  const exclude = new Set((new URL(request.url).searchParams.get("exclude") ?? "").split(",").filter(Boolean));
  const river = await homeRiver(exclude, 10);
  return Response.json(
    {
      items: river.map((story) => {
        const series = seriesOf(story);
        return {
          id: story.id,
          href: storyHref(story),
          title: story.title,
          image: story.image ?? null,
          kick: series?.name ?? sectionName(story.section),
          color: series?.color ?? null,
          when: relativeTimeAr(story.publishedAt) ?? "",
          publishedAt: story.publishedAt ?? null,
          fresh: Boolean(story.publishedAt && Date.now() - Date.parse(story.publishedAt) < 3_600_000),
        };
      }),
    },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" } },
  );
}
