import { getSessionMemberId, privateJson } from "@/lib/personalization/session";
import { savedPage, setSaved } from "@/lib/personalization/saved";
import { seedContentProvider } from "@/lib/content/provider";
import { requestOrigin, toMobileCard } from "@/lib/mobile/home";

export async function GET(request: Request) {
  const memberId = await getSessionMemberId();
  if (!memberId) return privateJson({ error: "يلزم تسجيل الدخول" }, 401);
  const offset = Math.max(0, Math.min(100_000, Math.floor(Number(new URL(request.url).searchParams.get("offset")) || 0)));
  const rows = await savedPage(memberId, offset);
  const stories = await Promise.all(rows.slice(0, 100).map(row => seedContentProvider.getStory(row.id)));
  return privateJson({ memberId, items: stories.filter(story => story !== null).map(story => toMobileCard(story, requestOrigin(request))), nextOffset: rows.length > 100 ? offset + 100 : null });
}
export async function POST(request: Request) {
  const memberId = await getSessionMemberId();
  if (!memberId) return privateJson({ error: "يلزم تسجيل الدخول" }, 401);
  const body = await request.json().catch(() => null);
  if (body?.expectedMemberId !== memberId) return privateJson({ error: "تغيّر الحساب" }, 409);
  if (typeof body?.storyId !== "string" || body.storyId.length > 64 || typeof body.saved !== "boolean") return privateJson({ error: "طلب غير صالح" }, 400);
  if (body.saved && !await seedContentProvider.getStory(body.storyId)) return privateJson({ error: "المادة غير متاحة" }, 404);
  await setSaved(memberId, body.storyId, body.saved);
  return privateJson({ saved: body.saved });
}
