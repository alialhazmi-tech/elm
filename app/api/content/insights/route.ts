import { seedContentProvider } from "@/lib/content/provider";
import { storyInsights } from "@/lib/personalization/insights";

/** مؤشرات المادة المجمّعة — عامة، بلا بيانات فردية، بكاش قصير. */
export async function GET(request: Request) {
  const storyId = new URL(request.url).searchParams.get("storyId") ?? "";
  if (!storyId) {
    return Response.json({ error: "storyId مطلوب" }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }
  try {
    const story = await seedContentProvider.getStory(storyId);
    if (!story) return Response.json({ error: "STORY_NOT_FOUND" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    const insights = await storyInsights(storyId);
    return Response.json(insights, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=60" } });
  } catch {
    return Response.json({ error: "INSIGHTS_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
