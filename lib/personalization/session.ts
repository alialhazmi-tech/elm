import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";

/** معرّف العضو من الجلسة فقط — أي memberId من العميل يُتجاهل. */
export async function getSessionMemberId(): Promise<string | null> {
  if (!memberAuthConfigured) return null;
  const { data } = await memberAuth.getSession().catch(() => ({ data: null }));
  const id = data?.user?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function privateJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
