import { getSessionMemberId, privateJson } from "@/lib/personalization/session";
import { getMemberProfile, saveMemberInterests } from "@/lib/membership/profile";
import { MEMBER_INTEREST_IDS } from "@/lib/membership/interests";
import { clearBehavioralData, setPersonalizationEnabled } from "@/lib/personalization/privacy";
import { getDb } from "@/lib/db";
export async function GET() {
  const memberId = await getSessionMemberId();
  if (!memberId) return privateJson({ error: "يلزم تسجيل الدخول" }, 401);
  if (!getDb()) return privateJson({ error: "الخدمة غير متاحة" }, 503);
  const profile = await getMemberProfile(memberId);
  return privateJson({ memberId, interestIds: profile.interests.map(item => item.id), personalizationEnabled: profile.personalizationEnabled });
}
export async function POST(request: Request) {
  const memberId = await getSessionMemberId();
  if (!memberId) return privateJson({ error: "يلزم تسجيل الدخول" }, 401);
  const input = await request.json().catch(() => null);
  if (input?.expectedMemberId !== memberId) return privateJson({ error: "تغيّر الحساب" }, 409);
  try {
    if (input.action === "interests") {
      if (!Array.isArray(input.interestIds) || input.interestIds.length > 12 || input.interestIds.some((id: unknown) => typeof id !== "string" || !MEMBER_INTEREST_IDS.has(id))) return privateJson({ error: "اهتمامات غير صالحة" }, 400);
      await saveMemberInterests(memberId, input.interestIds);
    } else if (input.action === "personalization" && typeof input.enabled === "boolean") {
      await setPersonalizationEnabled(memberId, input.enabled);
    } else if (input.action === "clear-behavior") {
      await clearBehavioralData(memberId);
    } else return privateJson({ error: "طلب غير صالح" }, 400);
    return privateJson({ ok: true });
  } catch { return privateJson({ error: "تعذر حفظ التفضيلات. حاول مجددًا." }, 503); }
}
