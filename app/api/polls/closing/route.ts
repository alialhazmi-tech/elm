import { closingAnswerCounts } from "@/lib/personalization/poll";
import { seedContentProvider } from "@/lib/content/provider";

export async function GET(request: Request) {
  const storyId = new URL(request.url).searchParams.get("storyId") ?? "";
  if (!storyId) {
    return Response.json({ error: "storyId مطلوب" }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  }
  const story = await seedContentProvider.getStory(storyId);
  const counts = story ? await closingAnswerCounts(storyId) : [0, 0];
  const total = counts[0] + counts[1];
  return Response.json(
    { counts, total },
    { headers: { "Cache-Control": "no-store" } },
  );
}
