import { Forbidden } from "@/components/tahrir/forbidden";
import { RolesMatrix } from "@/components/tahrir/roles/roles-matrix";
import { loadActor } from "@/lib/tahrir/access";
import { listRoles } from "@/lib/tahrir/admin";
import { PERMISSION_GROUPS, PERMISSION_KEYS } from "@/lib/tahrir/permissions";

export const metadata = { title: "الأدوار والصلاحيات" };
export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const actor = await loadActor();
  if (!actor?.can("roles.manage")) return <Forbidden title="الأدوار والصلاحيات" permission="roles.manage" />;

  const roles = await listRoles();

  return (
    <main className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-xl font-extrabold">الأدوار والصلاحيات</h1>
        <span className="text-xs text-muted-foreground tabular-nums">
          {roles.length} أدوار · {PERMISSION_KEYS.length} صلاحية — كل مربّع يُحفظ فور تبديله ويسري خلال 30 ثانية
        </span>
      </div>
      <RolesMatrix roles={roles} groups={PERMISSION_GROUPS} />
    </main>
  );
}
