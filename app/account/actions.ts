"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";
import { saveMemberInterests } from "@/lib/membership/profile";
import { MEMBER_INTEREST_IDS } from "@/lib/membership/interests";
import {
  clearBehavioralData,
  setPersonalizationEnabled,
} from "@/lib/personalization/privacy";
import { setSaved } from "@/lib/personalization/saved";
import { setLiked } from "@/lib/personalization/likes";
import { newsletterSubscribers } from "@/db/schema";
import { getDb } from "@/lib/db";

export type AccountFormState = { error?: string; success?: string };
async function currentMember() {
  if (!memberAuthConfigured) return null;
  const { data } = await memberAuth.getSession().catch(() => ({ data: null }));
  return data?.user ?? null;
}
const expired = { error: "انتهت جلستك. سجّل الدخول مرة أخرى لحفظ التغييرات." };
const failed = { error: "تعذر حفظ التغيير الآن. حاول مرة أخرى." };
function saved(success: string): AccountFormState {
  revalidatePath("/account");
  revalidatePath("/for-you");
  return { success };
}
export async function updateMemberDetails(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await currentMember();
  if (!user) return expired;
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 40)
    return { error: "اكتب اسمًا من حرفين إلى 40 حرفًا." };
  try {
    const result = await memberAuth.updateUser({ name });
    if (result.error) return failed;
    return saved("تم تحديث اسمك.");
  } catch {
    return failed;
  }
}
export async function changeMemberPassword(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  if (!(await currentMember())) return expired;
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  if (!currentPassword || currentPassword.length > 128)
    return { error: "أدخل كلمة المرور الحالية." };
  if (newPassword.length < 8 || newPassword.length > 128)
    return { error: "اختر كلمة مرور جديدة من 8 إلى 128 حرفًا." };
  if (newPassword !== formData.get("confirmPassword"))
    return { error: "كلمتا المرور الجديدتان غير متطابقتين." };
  if (newPassword === currentPassword)
    return { error: "اختر كلمة مرور مختلفة عن الحالية." };
  try {
    const result = await memberAuth.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    if (result.error)
      return { error: "تعذر تغيير كلمة المرور. تحقق من كلمة المرور الحالية." };
    return saved("تم تغيير كلمة المرور وتسجيل الخروج من الجلسات الأخرى.");
  } catch {
    return failed;
  }
}
export async function saveAccountInterests(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await currentMember();
  if (!user) return expired;
  const ids = [...new Set(formData.getAll("interests").map(String))];
  if (ids.length > 12 || ids.some((id) => !MEMBER_INTEREST_IDS.has(id)))
    return { error: "اختر من الموضوعات المتاحة فقط." };
  try {
    await saveMemberInterests(user.id, ids);
    return saved("تم حفظ اهتماماتك.");
  } catch {
    return failed;
  }
}
export async function togglePersonalization(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await currentMember();
  if (!user) return expired;
  const enabled = formData.get("enabled");
  if (enabled !== "0" && enabled !== "1") return failed;
  try {
    await setPersonalizationEnabled(user.id, enabled === "1");
    return saved(enabled === "1" ? "تم تشغيل التخصيص." : "تم إيقاف التخصيص.");
  } catch {
    return failed;
  }
}
export async function clearInferredSignals(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await currentMember();
  if (!user) return expired;
  if (formData.get("confirm") !== "yes")
    return { error: "أكد رغبتك في مسح سجل القراءة والإشارات المستنتجة." };
  try {
    await clearBehavioralData(user.id);
    return saved(
      "تم مسح سجل القراءة والإشارات المستنتجة، مع الاحتفاظ بمحفوظاتك واهتماماتك.",
    );
  } catch {
    return failed;
  }
}
export async function toggleNewsletter(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await currentMember();
  if (!user?.email) return expired;
  const db = getDb();
  if (!db) return failed;
  const email = user.email.trim().toLowerCase();
  const enabled = formData.get("enabled");
  if (enabled !== "0" && enabled !== "1") return failed;
  if (enabled === "1" && !user.emailVerified)
    return { error: "تحقق من بريدك الإلكتروني قبل الاشتراك في النشرة." };
  try {
    if (enabled === "0")
      await db
        .delete(newsletterSubscribers)
        .where(eq(newsletterSubscribers.email, email));
    else
      await db
        .insert(newsletterSubscribers)
        .values({
          id: crypto.randomUUID(),
          email,
          source: "account",
          createdAt: new Date().toISOString(),
        })
        .onConflictDoNothing();
    return saved(
      enabled === "1"
        ? "تم تسجيل اشتراكك في النشرة."
        : "تم إلغاء اشتراكك في النشرة.",
    );
  } catch {
    return failed;
  }
}
export async function removeSavedStory(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await currentMember();
  if (!user) return expired;
  const storyId = String(formData.get("storyId") ?? "").trim();
  if (!storyId || storyId.length > 64) return failed;
  try {
    await setSaved(user.id, storyId, false);
    return saved("أُزيلت المادة من المحفوظات.");
  } catch {
    return failed;
  }
}
export async function removeLikedStory(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await currentMember();
  if (!user) return expired;
  const storyId = String(formData.get("storyId") ?? "").trim();
  if (!storyId || storyId.length > 64) return failed;
  try {
    await setLiked(user.id, storyId, false);
    return saved("أُزيل الإعجاب بالمادة.");
  } catch {
    return failed;
  }
}
export async function sendMemberVerification(): Promise<AccountFormState> {
  const user = await currentMember();
  if (!user?.email) return expired;
  if (user.emailVerified) return { success: "بريدك الإلكتروني موثّق بالفعل." };
  try {
    const result = await memberAuth.emailOtp.sendVerificationOtp({
      email: user.email,
      type: "email-verification",
    });
    return result.error
      ? failed
      : { success: "أرسلنا رمز التحقق إلى بريدك الإلكتروني." };
  } catch {
    return failed;
  }
}
export async function verifyMemberEmail(
  _state: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await currentMember();
  if (!user?.email) return expired;
  if (user.emailVerified) return { success: "بريدك الإلكتروني موثّق بالفعل." };
  const otp = String(formData.get("otp") ?? "").trim();
  if (!/^\d{6}$/.test(otp))
    return { error: "أدخل رمز التحقق المكوّن من 6 أرقام." };
  try {
    const result = await memberAuth.emailOtp.verifyEmail({
      email: user.email,
      otp,
    });
    if (result.error)
      return { error: "الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا." };
    return saved("تم توثيق بريدك الإلكتروني.");
  } catch {
    return failed;
  }
}
export async function signOutMember(): Promise<AccountFormState> {
  try {
    const result = await memberAuth.signOut();
    if (result.error) return { error: "تعذر تسجيل الخروج. حاول مرة أخرى." };
  } catch {
    return { error: "تعذر تسجيل الخروج. حاول مرة أخرى." };
  }
  redirect("/");
}
