import { getSessionMemberId, privateJson, relatedForMember, relatedForVisitor } from "@/lib/personalization";
import { seedContentProvider } from "@/lib/content/provider";

export async function GET(request: Request) {
  const storyId = new URL(request.url).searchParams.get("storyId") ?? "";
  if (!storyId) return privateJson({ error: "storyId مطلوب" }, 400);
  const story = await seedContentProvider.getStory(storyId);
  if (!story) return privateJson({ items: [], personalized: false });

  const memberId = await getSessionMemberId();
  if (!memberId) {
    return privateJson({ items: await relatedForVisitor(story, 3), personalized: false });
  }
  try {
    const items = await relatedForMember(memberId, storyId, 3);
    return privateJson({ items, personalized: true });
  } catch {
    return privateJson({ items: await relatedForVisitor(story, 3), personalized: false });
  }
}
