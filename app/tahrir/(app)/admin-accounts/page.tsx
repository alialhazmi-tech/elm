import { MembersClient } from "@/components/tahrir/members/members-client";
import { requireScreen } from "@/lib/tahrir/screen";
import { listMembers, listRoles } from "@/lib/tahrir/admin";
import { PERMISSION_GROUPS } from "@/lib/tahrir/permissions";

export const metadata = { title: "الحسابات الإدارية" };
export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const gate = await requireScreen("users.view", "الحسابات الإدارية");
  if (!gate.ok) return gate.element;
  const actor = gate.actor;

  const [members, roles] = await Promise.all([listMembers(), listRoles()]);
  const active = members.filter((member) => member.status === "active").length;

  return (
    <main className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-xl font-extrabold">
          الحسابات الإدارية
        </h1>
        <span className="text-xs text-muted-foreground tabular-nums">
          {members.length} حسابًا · {active} فعّال · {members.length - active}{" "}
          معلّق
        </span>
      </div>
      <MembersClient
        members={members}
        roles={roles.map(({ id, label, isSystem }) => ({
          id,
          label,
          isSystem,
        }))}
        groups={PERMISSION_GROUPS}
        me={actor.userId}
        can={{
          manage: actor.can("users.manage"),
          suspend: actor.can("users.suspend"),
          overrides: actor.can("roles.manage"),
        }}
      />
    </main>
  );
}
