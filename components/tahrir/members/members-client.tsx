"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRoundIcon,
  PencilIcon,
  RefreshCwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { MemberSummary } from "@/lib/tahrir/admin";
import { ADMIN_ROLE, type OverrideEffect, type PermissionGroup } from "@/lib/tahrir/permissions";
import { cn } from "@/lib/utils";

type RoleOption = { id: string; label: string; isSystem: boolean };

type Action =
  | { kind: "create" }
  | { kind: "edit"; member: MemberSummary }
  | { kind: "password"; member: MemberSummary }
  | { kind: "overrides"; member: MemberSummary }
  | { kind: "suspend"; member: MemberSummary }
  | { kind: "reactivate"; member: MemberSummary };

interface Props {
  members: MemberSummary[];
  roles: RoleOption[];
  groups: PermissionGroup[];
  me: string;
  can: { manage: boolean; suspend: boolean; overrides: boolean };
}

const when = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Riyadh",
      }).format(new Date(iso))
    : "—";

/** كلمة مؤقتة قابلة للقراءة بلا محارف ملتبسة — تُولَّد في المتصفح وتُرسل مرة واحدة. */
function temporaryPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function call(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  const data = await response?.json().catch(() => null);
  return { ok: response?.ok === true, error: data?.error as string | undefined };
}

type Filter = "all" | "active" | "suspended";

/** جدول الحسابات الإدارية: الاسم والدور والحالة وآخر دخول، وإجراءات لكل صف؛ الإنشاء والتعديل في لوح جانبي. */
export function MembersClient({ members, roles, groups, me, can }: Props) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    // listRoles supplies the configured hierarchy, including custom roles.
    const roleOrder = new Map(roles.map((role, index) => [role.id, index]));
    return members.filter(
      (member) =>
        (filter === "all" || member.status === filter) &&
        (roleFilter === "all" || member.role === roleFilter) &&
        (!needle || `${member.displayName} ${member.username} ${member.email}`.toLowerCase().includes(needle)),
    ).sort((a, b) =>
      (roleOrder.get(a.role) ?? roles.length) - (roleOrder.get(b.role) ?? roles.length) ||
      a.roleLabel.localeCompare(b.roleLabel, "ar") ||
      Number(b.status === "active") - Number(a.status === "active") ||
      a.displayName.localeCompare(b.displayName, "ar") ||
      a.id.localeCompare(b.id),
    );
  }, [members, roles, filter, roleFilter, q]);

  const done = (message: string) => {
    toast.success(message);
    setAction(null);
    router.refresh();
  };

  async function submitStatus() {
    if (!action || (action.kind !== "suspend" && action.kind !== "reactivate")) return;
    const reason = (document.getElementById("suspend-reason") as HTMLTextAreaElement | null)?.value ?? "";
    setBusy(true);
    const result = await call(`/api/tahrir/admin/members/${action.member.id}/status`, "POST", {
      status: action.kind === "suspend" ? "suspended" : "active",
      reason,
    });
    setBusy(false);
    if (result.ok) done(action.kind === "suspend" ? "عُلّق الحساب — تسري فورًا." : "أُعيد تفعيل الحساب.");
    else toast.error(result.error ?? "تعذر تغيير الحالة.");
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="ابحث بالاسم أو البريد…"
              className="h-8 w-52 bg-card ps-8 text-xs sm:w-60"
              aria-label="بحث في الحسابات الإدارية"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger size="sm" className="h-8 w-36 bg-card text-xs" aria-label="تصفية بالدور">
              <SelectValue placeholder="كل الأدوار" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأدوار</SelectItem>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="inline-flex rounded-lg border border-border/80 bg-muted/30 p-0.5">
            {(
              [
                ["all", "الكل"],
                ["active", "فعّال"],
                ["suspended", "معلّق"],
              ] as Array<[Filter, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={cn(
                  "rounded-md px-2.5 py-1 font-display text-xs font-semibold transition-colors",
                  filter === key
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {can.manage ? (
          <Button size="sm" className="h-8 font-display font-bold shadow-xs" onClick={() => setAction({ kind: "create" })}>
            <UserPlusIcon data-icon="inline-start" className="size-3.5" />
            إضافة حساب إداري
          </Button>
        ) : null}
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/80 bg-muted/20 hover:bg-muted/20">
              <TableHead className="ps-4 font-display text-xs font-semibold">الحساب</TableHead>
              <TableHead className="w-40 hidden font-display text-xs font-semibold md:table-cell">الدور</TableHead>
              <TableHead className="w-48 font-display text-xs font-semibold">الحالة</TableHead>
              <TableHead className="w-36 hidden font-display text-xs font-semibold lg:table-cell">آخر دخول</TableHead>
              <TableHead className="w-28 hidden font-display text-xs font-semibold xl:table-cell">أُضيف</TableHead>
              <TableHead className="w-36 pe-4 font-display text-xs font-semibold text-start">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                  لا حسابات إدارية تطابق الفلاتر.
                </TableCell>
              </TableRow>
            ) : null}
            {visible.map((member) => {
              const isMe = member.id === me;
              return (
                <TableRow key={member.id} className={cn("transition-colors hover:bg-muted/30", member.status === "suspended" && "opacity-75")}>
                  <TableCell className="ps-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <ProfileAvatar name={member.displayName} image={member.avatarUrl} size={36} />
                      <div className="grid min-w-0 leading-tight">
                        <span className="truncate text-[13px] font-semibold">
                          {member.displayName}
                          {isMe ? <span className="ms-1.5 text-[10.5px] font-normal text-muted-foreground">(أنت)</span> : null}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground" dir="ltr">
                          {member.email || member.username}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="w-40 hidden py-2.5 md:table-cell">
                    <span className={cn("font-display text-xs font-semibold", member.role === ADMIN_ROLE && "text-(--t-warn)")}>{member.roleLabel}</span>
                    {member.overrides.length > 0 ? (
                      <span className="ms-1.5 inline-block rounded bg-muted/70 px-1 py-0.2 text-[10px] text-muted-foreground tabular-nums" title="استثناءات فردية">
                        +{member.overrides.length}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="w-48 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {can.suspend ? (
                        <Switch
                          checked={member.status === "active"}
                          disabled={isMe || busy}
                          aria-label={member.status === "active" ? `تعليق حساب ${member.displayName}` : `تفعيل حساب ${member.displayName}`}
                          title={
                            isMe
                              ? "لا يمكنك تعليق حسابك الحالي"
                              : member.status === "active"
                                ? "انقر لتعليق الحسابية"
                                : "انقر لتفعيل الحساب"
                          }
                          onCheckedChange={(checked) => {
                            if (!checked) {
                              setAction({ kind: "suspend", member });
                            } else {
                              setAction({ kind: "reactivate", member });
                            }
                          }}
                        />
                      ) : null}
                      <div className="grid leading-tight">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "text-xs font-semibold",
                              member.status === "active" ? "text-(--t-ok)" : "text-muted-foreground",
                            )}
                          >
                            {member.status === "active" ? "فعّال" : "معلّق"}
                          </span>
                          {member.mustChangePassword ? (
                            <span className="rounded-full bg-amber-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                              مؤقتة
                            </span>
                          ) : null}
                        </div>
                        {member.status === "suspended" && member.suspendReason ? (
                          <span className="max-w-36 truncate text-[10px] text-muted-foreground" title={member.suspendReason}>
                            {member.suspendReason}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="w-36 hidden py-2.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap lg:table-cell">{when(member.lastLoginAt)}</TableCell>
                  <TableCell className="w-28 hidden py-2.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap xl:table-cell">{member.createdAt.slice(0, 10)}</TableCell>
                  <TableCell className="w-36 pe-4 py-2.5">
                    <div className="flex items-center gap-1">
                      {can.manage ? (
                        <>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            className="text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="تعديل الاسم والبريد والدور"
                            aria-label={`تعديل ${member.displayName}`}
                            onClick={() => setAction({ kind: "edit", member })}
                          >
                            <PencilIcon className="size-3.5" />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            className="text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            title="توليد كلمة مرور مؤقتة"
                            aria-label={`كلمة مرور مؤقتة لـ ${member.displayName}`}
                            onClick={() => setAction({ kind: "password", member })}
                          >
                            <KeyRoundIcon className="size-3.5" />
                          </Button>
                        </>
                      ) : null}
                      {can.overrides && member.role !== ADMIN_ROLE ? (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          className="text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="استثناءات الصلاحيات الفردية"
                          aria-label={`استثناءات ${member.displayName}`}
                          onClick={() => setAction({ kind: "overrides", member })}
                        >
                          <SlidersHorizontalIcon className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* الإنشاء والتعديل وكلمة المرور والاستثناءات — لوح جانبي واحد يتبدّل محتواه */}
      <Sheet open={action !== null && action.kind !== "suspend" && action.kind !== "reactivate"} onOpenChange={(open) => (!open ? setAction(null) : null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {action?.kind === "create" || action?.kind === "edit" ? (
            <MemberForm key={action.kind === "edit" ? action.member.id : "new"} action={action} roles={roles} busy={busy} setBusy={setBusy} onDone={done} />
          ) : null}
          {action?.kind === "password" ? <PasswordForm member={action.member} busy={busy} setBusy={setBusy} onDone={done} /> : null}
          {action?.kind === "overrides" ? <OverridesForm key={action.member.id} member={action.member} groups={groups} busy={busy} setBusy={setBusy} onDone={done} /> : null}
        </SheetContent>
      </Sheet>

      <AlertDialog open={action?.kind === "suspend" || action?.kind === "reactivate"} onOpenChange={(open) => (!open ? setAction(null) : null)}>
        <AlertDialogContent>
          {action && "member" in action && <ProfileAvatar name={action.member.displayName} image={action.member.avatarUrl} size={56} />}
          {action?.kind === "suspend" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>تعليق حساب {action.member.displayName}؟</AlertDialogTitle>
                <AlertDialogDescription>
                  يُمنع فورًا من أي إجراء وتنتهي جلسته عند أول تنقل. لا يُحذف شيء — مواده وسجلّه يبقيان، ويمكن الاستئناف في أي وقت.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="grid gap-1.5">
                <Label htmlFor="suspend-reason">السبب (يُدوَّن في سجل التدقيق)</Label>
                <Textarea id="suspend-reason" rows={2} placeholder="مثال: انتهاء التعاقد" />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel>
                <AlertDialogAction variant="destructive" disabled={busy} onClick={submitStatus}>
                  {busy ? "جارٍ…" : "تعليق"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : action?.kind === "reactivate" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>تفعيل حساب {action.member.displayName}؟</AlertDialogTitle>
                <AlertDialogDescription>
                  يعود بدوره «{action.member.roleLabel}» وصلاحياته كما كانت.
                  {action.member.mustChangePassword ? " كلمة مروره مؤقتة وسيُجبر على تغييرها عند الدخول." : ""}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel>
                <AlertDialogAction disabled={busy} onClick={submitStatus}>
                  {busy ? "جارٍ…" : "استئناف"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MemberForm({
  action,
  roles,
  busy,
  setBusy,
  onDone,
}: {
  action: Extract<Action, { kind: "create" | "edit" }>;
  roles: RoleOption[];
  busy: boolean;
  setBusy: (value: boolean) => void;
  onDone: (message: string) => void;
}) {
  const editing = action.kind === "edit" ? action.member : null;
  const [password, setPassword] = useState(() => temporaryPassword());
  const [role, setRole] = useState(editing?.role ?? roles.find((r) => r.id === "editor")?.id ?? roles[0]?.id ?? "");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    const result = editing
      ? await call(`/api/tahrir/admin/members/${editing.id}`, "PATCH", {
          displayName: form.get("displayName"),
          email: form.get("email"),
          role,
        })
      : await call("/api/tahrir/admin/members", "POST", {
          username: form.get("username"),
          displayName: form.get("displayName"),
          email: form.get("email"),
          role,
          password,
        });
    setBusy(false);
    if (result.ok) onDone(editing ? "حُفظت بيانات الحساب." : "أُضيف الحساب بكلمة مرور مؤقتة.");
    else toast.error(result.error ?? "تعذر الحفظ.");
  }

  return (
    <form onSubmit={submit} className="grid gap-4 p-4">
      <SheetHeader className="p-0">
        {editing && <ProfileAvatar name={editing.displayName} image={editing.avatarUrl} size={64} />}
        <SheetTitle>{editing ? `تعديل ${editing.displayName}` : "حساب إداري جديد"}</SheetTitle>
        <SheetDescription>
          {editing ? "اسم المستخدم ثابت؛ الدور الجديد يسري على الطلب التالي مباشرة." : "يدخل بكلمة مرور مؤقتة ويُجبر على تغييرها أول مرة."}
        </SheetDescription>
      </SheetHeader>
      {!editing ? (
        <div className="grid gap-1.5">
          <Label htmlFor="m-username">اسم المستخدم</Label>
          <Input id="m-username" name="username" dir="ltr" autoComplete="off" required placeholder="name@trenddc.com" />
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor="m-name">الاسم المعروض</Label>
        <Input id="m-name" name="displayName" defaultValue={editing?.displayName} required minLength={2} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="m-email">البريد الإلكتروني</Label>
        <Input id="m-email" name="email" type="email" dir="ltr" defaultValue={editing?.email} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="m-role">الدور</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger id="m-role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!editing ? (
        <div className="grid gap-1.5">
          <Label htmlFor="m-password">كلمة المرور المؤقتة</Label>
          <div className="flex gap-1.5">
            <Input id="m-password" value={password} onChange={(event) => setPassword(event.target.value)} dir="ltr" className="font-mono" minLength={10} required />
            <Button type="button" size="icon" variant="outline" aria-label="توليد كلمة جديدة" onClick={() => setPassword(temporaryPassword())}>
              <RefreshCwIcon />
            </Button>
          </div>
          <span className="text-[11px] text-muted-foreground">انسخها لصاحب الحساب الآن — لا تُعرض بعد الحفظ.</span>
        </div>
      ) : null}
      <SheetFooter className="p-0">
        <Button type="submit" disabled={busy}>
          {busy ? "جارٍ…" : editing ? "حفظ" : "إضافة"}
        </Button>
      </SheetFooter>
    </form>
  );
}

function PasswordForm({
  member,
  busy,
  setBusy,
  onDone,
}: {
  member: MemberSummary;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onDone: (message: string) => void;
}) {
  const [password, setPassword] = useState(() => temporaryPassword());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const result = await call(`/api/tahrir/admin/members/${member.id}/password`, "POST", { password });
    setBusy(false);
    if (result.ok) onDone("وُضعت كلمة مؤقتة — يُجبر صاحب الحساب على تغييرها عند الدخول.");
    else toast.error(result.error ?? "تعذر إعادة التعيين.");
  }

  return (
    <form onSubmit={submit} className="grid gap-4 p-4">
      <SheetHeader className="p-0">
        <ProfileAvatar name={member.displayName} image={member.avatarUrl} size={64} />
        <SheetTitle>كلمة مرور مؤقتة لـ {member.displayName}</SheetTitle>
        <SheetDescription>تحل محل الحالية فورًا، ويُطلب من صاحب الحساب اختيار كلمته الخاصة عند الدخول التالي.</SheetDescription>
      </SheetHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="p-password">الكلمة المؤقتة</Label>
        <div className="flex gap-1.5">
          <Input id="p-password" value={password} onChange={(event) => setPassword(event.target.value)} dir="ltr" className="font-mono" minLength={10} required />
          <Button type="button" size="icon" variant="outline" aria-label="توليد كلمة جديدة" onClick={() => setPassword(temporaryPassword())}>
            <RefreshCwIcon />
          </Button>
        </div>
        <span className="text-[11px] text-muted-foreground">انسخها لصاحب الحساب الآن — لا تُعرض بعد الحفظ.</span>
      </div>
      <SheetFooter className="p-0">
        <Button type="submit" disabled={busy}>
          {busy ? "جارٍ…" : "إعادة التعيين"}
        </Button>
      </SheetFooter>
    </form>
  );
}

/** ثلاث حالات لكل صلاحية: من الدور (افتراضي) · منح · منع. */
function OverridesForm({
  member,
  groups,
  busy,
  setBusy,
  onDone,
}: {
  member: MemberSummary;
  groups: PermissionGroup[];
  busy: boolean;
  setBusy: (value: boolean) => void;
  onDone: (message: string) => void;
}) {
  const [overrides, setOverrides] = useState<Map<string, OverrideEffect>>(
    () => new Map(member.overrides.map((o) => [o.permissionKey, o.effect])),
  );

  const set = (key: string, effect: OverrideEffect | "role") =>
    setOverrides((prev) => {
      const copy = new Map(prev);
      if (effect === "role") copy.delete(key);
      else copy.set(key, effect);
      return copy;
    });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const result = await call(`/api/tahrir/admin/members/${member.id}/permissions`, "PUT", {
      overrides: [...overrides].map(([permissionKey, effect]) => ({ permissionKey, effect })),
    });
    setBusy(false);
    if (result.ok) onDone("حُفظت الاستثناءات — تسري على الطلب التالي.");
    else toast.error(result.error ?? "تعذر الحفظ.");
  }

  return (
    <form onSubmit={submit} className="grid gap-4 p-4">
      <SheetHeader className="p-0">
        <ProfileAvatar name={member.displayName} image={member.avatarUrl} size={64} />
        <SheetTitle>استثناءات {member.displayName}</SheetTitle>
        <SheetDescription>
          فوق دوره «{member.roleLabel}»: امنح صلاحية لا يملكها الدور، أو امنع واحدة يملكها — دون إنشاء دور جديد.
        </SheetDescription>
      </SheetHeader>
      <div className="grid gap-3">
        {groups.map((group) => (
          <div key={group.key} className="grid gap-1">
            <div className="font-display text-[11px] font-bold text-muted-foreground">{group.label}</div>
            {group.permissions.map((permission) => {
              const current = overrides.get(permission.key) ?? "role";
              return (
                <div key={permission.key} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-xs" title={permission.description}>
                    {permission.label}
                  </span>
                  <div className="inline-flex gap-0.5" role="radiogroup" aria-label={permission.label}>
                    {(
                      [
                        ["role", "الدور"],
                        ["allow", "منح"],
                        ["deny", "منع"],
                      ] as Array<[OverrideEffect | "role", string]>
                    ).map(([value, label]) => (
                      <Button
                        key={value}
                        type="button"
                        size="xs"
                        role="radio"
                        aria-checked={current === value}
                        variant={current === value ? (value === "deny" ? "destructive" : "default") : "ghost"}
                        onClick={() => set(permission.key, value)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <SheetFooter className="p-0">
        <Button type="submit" disabled={busy}>
          {busy ? "جارٍ…" : `حفظ (${overrides.size} استثناء)`}
        </Button>
      </SheetFooter>
    </form>
  );
}
