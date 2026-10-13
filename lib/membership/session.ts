import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NEON_AUTH_SESSION_COOKIE_NAME } from "@neondatabase/auth/server";
import { memberProfiles } from "@/db/schema";
import { getDb } from "@/lib/db";
import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";
import { SessionReadError, sessionOperation } from "@/lib/session-diagnostics";

/** Always check live application status; an Auth cookie alone does not grant membership access. */
export async function getMemberSession({ strict = false }: { strict?: boolean } = {}) {
  if (!memberAuthConfigured) return { data: null, suspended: false };
  // The SDK still fetches /get-session with no token. Anonymous page views must
  // not consume the identity provider's rate limit or depend on its availability.
  const token = await sessionOperation("member.cookie", async () => (await cookies()).get(NEON_AUTH_SESSION_COOKIE_NAME)?.value);
  if (!token) return { data: null, suspended: false };
  const read = async (fresh = false) => {
    try {
      return await sessionOperation(fresh ? "member.refresh" : "member.session", async () => {
        const result = await memberAuth.getSession(fresh ? { query: { disableCookieCache: "true" } } : undefined);
        if (result.error) throw result.error;
        return result;
      });
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
  const authUserId = result.data.user.id;
  const db = await sessionOperation("member.profile", async () => getDb());
  if (!db) {
    if (strict) throw new SessionReadError("member.profile", { code: "STORAGE_UNAVAILABLE" });
    return { data: null, suspended: false };
  }
  const [profile] = await sessionOperation("member.profile", () => db
    .select({
      status: memberProfiles.status,
      avatarUrl: memberProfiles.avatarUrl,
    })
    .from(memberProfiles)
    .where(eq(memberProfiles.authUserId, authUserId))
    .limit(1));
  if (profile?.status === "suspended") return { data: null, suspended: true };
  return {
    data: {
      ...result.data,
      user: { ...result.data.user, image: profile?.avatarUrl ?? null },
    },
    suspended: false,
  };
}
