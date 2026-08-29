import { seedContentProvider } from "@/lib/content/provider";
import { EMPTY_INSIGHTS, storyInsights } from "@/lib/personalization/insights";

/** مؤشرات المادة المجمّعة — عامة، بلا بيانات فردية، بكاش قصير. */
export async function GET(request: Request) {
  const storyId = new URL(request.url).searchParams.get("storyId") ?? "";
  if (!storyId) {
    return Response.json({ error: "storyId مطلوب" }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }
  const story = await seedContentProvider.getStory(storyId);
  const insights = story ? await storyInsights(storyId).catch(() => EMPTY_INSIGHTS) : EMPTY_INSIGHTS;
  return Response.json(insights, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
