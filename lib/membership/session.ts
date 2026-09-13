import { eq } from "drizzle-orm";
import { memberProfiles } from "@/db/schema";
import { getDb } from "@/lib/db";
import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";

/** Always check live application status; an Auth cookie alone does not grant membership access. */
export async function getMemberSession({ strict = false }: { strict?: boolean } = {}) {
  if (!memberAuthConfigured) return { data: null, suspended: false };
  const read = async (fresh = false) => {
    try {
      const result = await memberAuth.getSession(fresh ? { query: { disableCookieCache: "true" } } : undefined);
      if (strict && result.error) throw new Error("Membership session unavailable");
      return result;
    } catch (error) {
      if (strict) throw error;
      return { data: null };
    }
  };
  let result = await read();
  // قد تحمل الكوكي القديمة حالة «غير موثّق» بعد نجاح التوثيق في تبويب آخر.
  // نراجع هذه الحالة من مزوّد الهوية، مع إبقاء مسار العضو الموثّق مخزّنًا مؤقتًا.
  if (result.data?.user && !result.data.user.emailVerified) {
    result = await read(true);
  }
  if (!result.data?.user) return { data: null, suspended: false };
  const db = getDb();
  if (!db) {
    if (strict) throw new Error("Membership storage unavailable");
    return { data: null, suspended: false };
  }
  const [profile] = await db
    .select({
      status: memberProfiles.status,
      avatarUrl: memberProfiles.avatarUrl,
    })
    .from(memberProfiles)
    .where(eq(memberProfiles.authUserId, result.data.user.id))
    .limit(1);
  if (profile?.status === "suspended") return { data: null, suspended: true };
  return {
    data: {
      ...result.data,
      user: { ...result.data.user, image: profile?.avatarUrl ?? null },
    },
    suspended: false,
  };
}
