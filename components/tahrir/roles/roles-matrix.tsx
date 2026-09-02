"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyPlusIcon, LockIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { RoleSummary } from "@/lib/tahrir/admin";
import { ADMIN_ROLE, WILDCARD, type PermissionGroup } from "@/lib/tahrir/permissions";
import { cn } from "@/lib/utils";

type RoleDialog = { kind: "create" } | { kind: "rename"; role: RoleSummary } | { kind: "delete"; role: RoleSummary };

async function call(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  const data = await response?.json().catch(() => null);
  return { ok: response?.ok === true, error: data?.error as string | undefined };
}

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
    const result = await call(`/api/tahrir/admin/roles/${roleId}/permissions`, "PATCH", { permissionKey: key, granted: next });
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
      toast.error(result.error ?? "تعذر حفظ التغيير.");
    }
  }

  async function submitDialog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    let result: { ok: boolean; error?: string };
    if (dialog.kind === "create") {
      result = await call("/api/tahrir/admin/roles", "POST", {
        id: form.get("id"),
        label: form.get("label"),
        description: form.get("description"),
        copyFrom: form.get("copyFrom") || undefined,
      });
    } else if (dialog.kind === "rename") {
      result = await call(`/api/tahrir/admin/roles/${dialog.role.id}`, "PATCH", {
        label: form.get("label"),
        description: form.get("description"),
      });
    } else {
      result = await call(`/api/tahrir/admin/roles/${dialog.role.id}`, "DELETE");
    }
    setBusy(false);
    if (result.ok) {
      toast.success(dialog.kind === "create" ? "أُنشئ الدور." : dialog.kind === "rename" ? "حُفظ الدور." : "حُذف الدور.");
      setDialog(null);
      router.refresh();
    } else {
      toast.error(result.error ?? "تعذر تنفيذ الإجراء.");
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b">
                <th className="px-4 py-2.5 text-start font-display text-xs font-semibold text-muted-foreground">الصلاحية</th>
                {roles.map((role) => (
                  <th key={role.id} className="min-w-28 px-2 py-2.5 text-center align-top">
                    <div className="grid justify-items-center gap-0.5">
                      <span className="inline-flex items-center gap-1 font-display text-xs font-bold">
                        {role.id === ADMIN_ROLE ? <LockIcon className="size-3 text-(--t-warn)" /> : null}
                        {role.label}
                      </span>
                      <span className="text-[10.5px] text-muted-foreground tabular-nums">{role.members} عضو</span>
                      {role.id !== ADMIN_ROLE ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-xs" variant="ghost" aria-label={`إجراءات ${role.label}`}>
                              <MoreHorizontalIcon />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center" className="w-44">
                            <DropdownMenuItem onSelect={() => setDialog({ kind: "rename", role })}>
                              <PencilIcon />
                              الاسم والوصف
                            </DropdownMenuItem>
                            {!role.isSystem ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" disabled={role.members > 0} onSelect={() => setDialog({ kind: "delete", role })}>
                                  <Trash2Icon />
                                  حذف الدور
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
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
        <th colSpan={columnCount} className="bg-muted/60 px-4 py-1.5 text-start font-display text-[11px] font-bold tracking-wide text-muted-foreground">
          {group.label}
        </th>
      </tr>
      {group.permissions.map((permission) => (
        <tr key={permission.key} className="border-b last:border-0 hover:bg-muted/30">
          <th scope="row" className="px-4 py-2 text-start font-normal">
            <div className="text-[13px]">{permission.label}</div>
            <div className="text-[10.5px] text-muted-foreground" title={permission.description}>
              <code dir="ltr" className="font-mono">{permission.key}</code>
            </div>
          </th>
          {roles.map((role) => {
            const locked = role.id === ADMIN_ROLE;
            const checked = has(role.id, permission.key);
            const cell = `${role.id}:${permission.key}`;
            return (
              <td key={role.id} className={cn("px-2 py-2 text-center", locked && "bg-(--t-warn-bg)/40")}>
                {locked ? (
                  <CheckIcon aria-label="شاملة" className="mx-auto size-4 text-(--t-ok)" />
                ) : (
                  <Checkbox
                    aria-label={`${permission.label} — ${role.label}`}
                    checked={checked}
                    disabled={pending === cell}
                    onCheckedChange={(value) => onToggle(role.id, permission.key, value === true)}
                  />
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
