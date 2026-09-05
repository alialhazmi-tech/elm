import { sql } from "drizzle-orm";
import { auditLog, memberProfiles } from "@/db/schema";
import { getDb } from "@/lib/db";
export class AudienceError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export type AudienceMember = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  verified: boolean;
  status: "active" | "suspended";
  reason: string;
  createdAt: string;
  onboarded: boolean;
};
export type AudienceFilters = {
  q?: string;
  status?: string;
  verified?: string;
  page?: string;
};
export async function listAudience(input: AudienceFilters) {
  const db = getDb();
  if (!db) throw new Error("Membership database unavailable");
  const q = (input.q ?? "").trim().slice(0, 100);
  const status = ["active", "suspended"].includes(input.status ?? "")
    ? input.status!
    : "all";
  const verified = ["yes", "no"].includes(input.verified ?? "")
    ? input.verified!
    : "all";
  const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const where = sql`(${q} = '' or u.name ilike ${pattern} or u.email ilike ${pattern})
    and (${status} = 'all' or coalesce(p.status, 'active') = ${status})
    and (${verified} = 'all' or u."emailVerified" = ${verified === "yes"})`;
  // Managed Auth schema is read-only here. Application moderation lives in member_profiles.
  const totals = await db.execute<{
    total: number;
    verified: number;
    suspended: number;
  }>(sql`
    select count(*)::int as total, count(*) filter(where u."emailVerified")::int as verified,
      count(*) filter(where p.status = 'suspended')::int as suspended
    from neon_auth."user" u left join member_profiles p on p.auth_user_id = u.id::text where ${where}`);
  const counts = totals.rows[0];
  const pages = Math.max(1, Math.ceil(counts.total / 25));
  const requested = Number(input.page);
  const page = Number.isSafeInteger(requested)
    ? Math.max(1, Math.min(pages, requested))
    : 1;
  const result = await db.execute<AudienceMember>(sql`
    select u.id, coalesce(u.name, '') as name, u.email, p.avatar_url as image, u."emailVerified" as verified,
      coalesce(p.status, 'active') as status, coalesce(p.suspend_reason, '') as reason,
      u."createdAt"::text as "createdAt", coalesce(p.onboarding_completed, 0) = 1 as onboarded
    from neon_auth."user" u left join member_profiles p on p.auth_user_id = u.id::text
    where ${where} order by u."createdAt" desc, u.id limit 25 offset ${(page - 1) * 25}`);
  return { members: result.rows, counts, page, pages, q, status, verified };
}
export async function setAudienceStatus(
  id: string,
  status: "active" | "suspended",
  reason: string,
  actor: string,
) {
  const db = getDb();
  if (!db) throw new AudienceError("قاعدة البيانات غير متاحة.", 503);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new AudienceError("الحساب غير موجود.", 404);
  const exists = await db.execute(
    sql`select id from neon_auth."user" where id = ${id}`,
  );
  if (!exists.rows.length) throw new AudienceError("الحساب غير موجود.", 404);
  const note = reason.trim();
  if (note.length > 500 || (status === "suspended" && !note))
    throw new AudienceError("اكتب سبب التعليق، حتى 500 حرف.");
  const now = new Date().toISOString();
  await db.batch([
    db
      .insert(memberProfiles)
      .values({
        authUserId: id,
        status,
        suspendReason: status === "suspended" ? note : "",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: memberProfiles.authUserId,
        set: {
          status,
          suspendReason: status === "suspended" ? note : "",
          updatedAt: now,
        },
      }),
    db
      .insert(auditLog)
      .values({
        id: crypto.randomUUID(),
        actor,
        at: now,
        action:
          status === "suspended" ? "members:suspend" : "members:reactivate",
        detail: `${id}${status === "suspended" ? `: ${note}` : ""}`,
      }),
  ]);
}
