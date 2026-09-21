"use server";
import { getMemberSession } from "@/lib/membership/session";

import { redirect } from "next/navigation";
import { memberAuthConfigured } from "@/lib/membership/auth";
import { saveMemberInterests } from "@/lib/membership/profile";

export type InterestsState = { error?: string };

export async function completeOnboarding(
  _state: InterestsState,
  formData: FormData,
): Promise<InterestsState> {
  if (!memberAuthConfigured) return { error: "خدمة العضوية غير مهيأة حاليًا." };
  const { data } = await getMemberSession();
  if (!data?.user) redirect("/join");

  const ids = formData.getAll("interests").map(String);
  if (ids.length < 3) return { error: "اختر 3 اهتمامات على الأقل لنرتّب لك بداية مفيدة." };
  if (ids.length > 7) return { error: "اختر حتى 7 اهتمامات لتبقى صفحتك مركزة." };

  try {
    await saveMemberInterests(data.user.id, ids);
  } catch {
    return { error: "تعذر حفظ اهتماماتك الآن. حاول مرة أخرى." };
  }

  redirect("/welcome/ready");
}
