import { setNewsletterSubscription } from "@/lib/membership/newsletter";
import { getMemberSession } from "@/lib/membership/session";
import { privateJson } from "@/lib/personalization/session";

/** نفس منطق `toggleNewsletter` في صفحة الحساب: الاشتراك يشترط بريدًا موثّقًا. */
export async function POST(request: Request) {
  const { data } = await getMemberSession();
  const user = data?.user;
  if (!user?.email) return privateJson({ error: "يلزم تسجيل الدخول" }, 401);
  const input = (await request.json().catch(() => null)) as { subscribed?: unknown } | null;
  if (typeof input?.subscribed !== "boolean") return privateJson({ error: "طلب غير صالح" }, 400);
  if (input.subscribed && !user.emailVerified) return privateJson({ error: "تحقق من بريدك الإلكتروني قبل الاشتراك في النشرة." }, 403);
  try {
    await setNewsletterSubscription(user.email, input.subscribed);
  } catch {
    return privateJson({ error: "تعذر حفظ التغيير الآن. حاول مرة أخرى." }, 503);
  }
  return privateJson({ ok: true, subscribed: input.subscribed });
}
