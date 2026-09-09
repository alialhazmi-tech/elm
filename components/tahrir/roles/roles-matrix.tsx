"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyPlusIcon, LockIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { RoleSummary } from "@/lib/tahrir/admin";
import { apiCall } from "@/lib/tahrir/client-api";
import { ADMIN_ROLE, WILDCARD, type PermissionGroup } from "@/lib/tahrir/permissions";
import { cn } from "@/lib/utils";

type RoleDialog = { kind: "create" } | { kind: "rename"; role: RoleSummary } | { kind: "delete"; role: RoleSummary };

/** غلاف رقيق فوق النقل الموحّد: fallback هو نص الشاشة عند فشل بلا رسالة من الخادم. */
async function call(url: string, method: string, body: unknown, fallback: string) {
  const result = await apiCall(url, { method, body }, { fallback });
  return result.ok ? { ok: true as const, error: undefined } : { ok: false as const, error: result.error };
}

/** العمود الأول لاصق عند التمرير الأفقي على الجوال؛ خلفية صريحة حتى لا تمرّ الخلايا تحته. */
const STICKY_FIRST = "sticky start-0 z-[1] bg-card md:static md:bg-transparent";
/** أزرار رأس الدور: 36px على الجوال (هدف لمس) و20px على المكتبي. */
const HEADER_ICON_BUTTON = "size-9 text-muted-foreground hover:text-foreground md:size-5";

/** مصفوفة الأدوار × الصلاحيات — صفوف الصلاحيات بمجموعاتها، وعمود لكل دور، ومسؤول النظام مقفل على الشاملة. */
export function RolesMatrix({ roles, groups }: { roles: RoleSummary[]; groups: PermissionGroup[] }) {
  const router = useRouter();
  const [granted, setGranted] = useState(() => new Map(roles.map((role) => [role.id, new Set(role.permissions)])));
  const [pending, setPending] = useState<string | null>(null);
  const [dialog, setDialog] = useState<RoleDialog | null>(null);
  const [busy, setBusy] = useState(false);

  const has = (roleId: string, key: string) => {
    const set = granted.get(roleId);
    return !!set && (set.has(WILDCARD) || set.has(key));
  };

  async function toggle(roleId: string, key: string, next: boolean) {
    const cell = `${roleId}:${key}`;
    setPending(cell);
    setGranted((prev) => {
      const copy = new Map(prev);
      const set = new Set(copy.get(roleId));
      if (next) set.add(key);
      else set.delete(key);
      copy.set(roleId, set);
      return copy;
    });
    const result = await call(`/api/tahrir/admin/roles/${roleId}/permissions`, "PATCH", { permissionKey: key, granted: next }, "تعذر حفظ التغيير.");
    setPending(null);
    if (!result.ok) {
      setGranted((prev) => {
        const copy = new Map(prev);
        const set = new Set(copy.get(roleId));
        if (next) set.delete(key);
        else set.add(key);
        copy.set(roleId, set);
        return copy;
      });
      toast.error(result.error);
    }
  }

  async function submitDialog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    let result: { ok: boolean; error?: string };
    const fallback = "تعذر تنفيذ الإجراء.";
    if (dialog.kind === "create") {
      result = await call(
        "/api/tahrir/admin/roles",
        "POST",
        { id: form.get("id"), label: form.get("label"), description: form.get("description"), copyFrom: form.get("copyFrom") || undefined },
        fallback,
      );
    } else if (dialog.kind === "rename") {
      result = await call(`/api/tahrir/admin/roles/${dialog.role.id}`, "PATCH", { label: form.get("label"), description: form.get("description") }, fallback);
    } else {
      result = await call(`/api/tahrir/admin/roles/${dialog.role.id}`, "DELETE", undefined, fallback);
    }
    setBusy(false);
    if (result.ok) {
      toast.success(dialog.kind === "create" ? "أُنشئ الدور." : dialog.kind === "rename" ? "حُفظ الدور." : "حُذف الدور.");
      setDialog(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const columnCount = roles.length + 1;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setDialog({ kind: "create" })}>
          <CopyPlusIcon data-icon="inline-start" />
          دور جديد
        </Button>
        <span className="text-[11px] text-muted-foreground">
          الأدوار النظامية الأربعة لا تُحذف. مسؤول النظام يملك كل شيء بحكم التعريف فلا يُحرَّر عموده.
        </span>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {/* تمرير أفقي بتلاشٍ عند الحافة المقصوصة؛ حافة البداية بلا تلاشٍ لأن العمود الأول لاصق هناك. */}
        <div className="scroll-fade-x overflow-x-auto [--scroll-fade-s-size:0px]">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border/80 bg-muted/20">
                <th className={cn("min-w-[150px] px-3 py-3 text-start font-display text-xs font-semibold text-foreground md:w-80 md:min-w-[240px] md:px-4", STICKY_FIRST)}>الصلاحية</th>
                {roles.map((role) => (
                  <th key={role.id} className="w-32 min-w-[110px] border-s border-border/50 px-2 py-3 text-center align-top">
                    <div className="grid justify-items-center gap-1">
                      <span className="inline-flex items-center gap-1 font-display text-xs font-bold text-foreground">
                        {role.id === ADMIN_ROLE ? <LockIcon className="size-3 text-(--t-warn)" /> : null}
                        {role.label}
                      </span>
                      <span className="inline-block rounded-full bg-muted/70 px-2 py-0.2 text-[10px] font-medium text-muted-foreground tabular-nums">
                        {role.members} عضو
                      </span>
                      {role.id !== ADMIN_ROLE ? (
                        <div className="mt-0.5 flex items-center gap-0.5">
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            className={HEADER_ICON_BUTTON}
                            title="تعديل الاسم والوصف"
                            aria-label={`تعديل ${role.label}`}
                            onClick={() => setDialog({ kind: "rename", role })}
                          >
                            <PencilIcon className="size-3" />
                          </Button>
                          {!role.isSystem ? (
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              className={cn(HEADER_ICON_BUTTON, "hover:text-destructive disabled:opacity-30")}
                              disabled={role.members > 0}
                              title={role.members > 0 ? "لا يمكن حذف دور به أعضاء" : "حذف الدور"}
                              aria-label={`حذف ${role.label}`}
                              onClick={() => setDialog({ kind: "delete", role })}
                            >
                              <Trash2Icon className="size-3" />
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[10px] font-semibold text-(--t-warn)">شاملة</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <GroupRows key={group.key} group={group} roles={roles} columnCount={columnCount} has={has} pending={pending} onToggle={toggle} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={dialog !== null} onOpenChange={(open) => (!open ? setDialog(null) : null)}>
        <DialogContent className="sm:max-w-md">
          {dialog ? (
            <form onSubmit={submitDialog} className="grid gap-4">
              <DialogHeader>
                <DialogTitle>
                  {dialog.kind === "create" ? "دور جديد" : dialog.kind === "rename" ? `تعديل «${dialog.role.label}»` : `حذف «${dialog.role.label}»`}
                </DialogTitle>
                <DialogDescription>
                  {dialog.kind === "create"
                    ? "يبدأ فارغًا أو نسخة من دور قائم، ثم تعدّل مربّعاته من المصفوفة."
                    : dialog.kind === "rename"
                      ? "المعرّف التقني ثابت؛ الاسم والوصف قابلان للتغيير."
                      : "الحذف نهائي ولا يُتاح إلا لدور بلا أعضاء."}
                </DialogDescription>
              </DialogHeader>

              {dialog.kind === "create" ? (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="role-id">المعرّف التقني</Label>
                    <Input id="role-id" name="id" dir="ltr" placeholder="senior_editor" pattern="[a-z][a-z0-9_]{1,40}" required />
                    <span className="text-[11px] text-muted-foreground">حروف لاتينية صغيرة وأرقام و_ — لا يتغير بعد الإنشاء.</span>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="role-label">الاسم</Label>
                    <Input id="role-label" name="label" placeholder="محرر أول" required minLength={2} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="role-desc">الوصف</Label>
                    <Textarea id="role-desc" name="description" rows={2} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="role-copy">نسخ الصلاحيات من</Label>
                    <Select name="copyFrom">
                      <SelectTrigger id="role-copy" className="w-full">
                        <SelectValue placeholder="يبدأ فارغًا" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles
                          .filter((role) => role.id !== ADMIN_ROLE)
                          .map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : dialog.kind === "rename" ? (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="role-label">الاسم</Label>
                    <Input id="role-label" name="label" defaultValue={dialog.role.label} required minLength={2} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="role-desc">الوصف</Label>
                    <Textarea id="role-desc" name="description" rows={2} defaultValue={dialog.role.description} />
                  </div>
                </>
              ) : null}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={busy}>
                  إلغاء
                </Button>
                <Button type="submit" variant={dialog.kind === "delete" ? "destructive" : "default"} disabled={busy}>
                  {busy ? "جارٍ…" : dialog.kind === "create" ? "إنشاء" : dialog.kind === "rename" ? "حفظ" : "حذف نهائي"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function GroupRows({
  group,
  roles,
  columnCount,
  has,
  pending,
  onToggle,
}: {
  group: PermissionGroup;
  roles: RoleSummary[];
  columnCount: number;
  has: (roleId: string, key: string) => boolean;
  pending: string | null;
  onToggle: (roleId: string, key: string, next: boolean) => void;
}) {
  return (
    <>
      <tr>
        <th
          colSpan={columnCount}
          className="border-y border-border/80 bg-muted/35 px-4 py-2 text-start font-display text-xs font-bold tracking-wide text-foreground"
        >
          {group.label}
        </th>
      </tr>
      {group.permissions.map((permission) => (
        <tr key={permission.key} className="border-b border-border/50 last:border-0 transition-colors hover:bg-muted/30">
          <th scope="row" className={cn("min-w-[150px] px-3 py-2.5 text-start font-normal md:w-80 md:min-w-[240px] md:px-4", STICKY_FIRST)}>
            <div className="text-[13px] font-semibold text-foreground">{permission.label}</div>
            <div className="text-[11px] leading-tight text-muted-foreground" title={permission.description}>
              {permission.description ? <span className="block">{permission.description}</span> : null}
              <code dir="ltr" className="mt-0.5 inline-block rounded bg-muted/70 px-1 py-0.2 font-mono text-[10px] text-muted-foreground/90">
                {permission.key}
              </code>
            </div>
          </th>
          {roles.map((role) => {
            const locked = role.id === ADMIN_ROLE;
            const checked = has(role.id, permission.key);
            const cell = `${role.id}:${permission.key}`;
            return (
              <td
                key={role.id}
                className={cn(
                  "w-32 min-w-[110px] border-s border-border/50 px-2 py-2 text-center align-middle",
                  locked && "bg-(--t-warn)/5",
                )}
              >
                {locked ? (
                  <CheckIcon aria-label="شاملة" className="mx-auto size-4 text-(--t-ok)" />
                ) : (
                  <div className="flex items-center justify-center">
                    <Checkbox
                      aria-label={`${permission.label} — ${role.label}`}
                      checked={checked}
                      disabled={pending === cell}
                      onCheckedChange={(value) => onToggle(role.id, permission.key, value === true)}
                    />
                  </div>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
