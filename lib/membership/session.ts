import { eq } from "drizzle-orm";
import { memberProfiles } from "@/db/schema";
import { getDb } from "@/lib/db";
import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";

/** Always check live application status; an Auth cookie alone does not grant membership access. */
export async function getMemberSession() {
  if (!memberAuthConfigured) return { data: null, suspended: false };
  const result = await memberAuth.getSession().catch(() => ({ data: null }));
  if (!result.data?.user) return { data: null, suspended: false };
  const db = getDb();
  if (!db) return { data: null, suspended: false };
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
