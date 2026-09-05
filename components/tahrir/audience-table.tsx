"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  EyeIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AudienceMember } from "@/lib/membership/admin";
const date = (value: string) =>
  new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    dateStyle: "medium",
    timeZone: "Asia/Riyadh",
  }).format(new Date(value));
export function AudienceTable({
  members,
  canSuspend,
}: {
  members: AudienceMember[];
  canSuspend: boolean;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<AudienceMember | null>(null);
  const [action, setAction] = useState<AudienceMember | null>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit() {
    if (!action) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/tahrir/audience/${encodeURIComponent(action.id)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: action.status === "active" ? "suspended" : "active",
            reason,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage(
        action.status === "active" ? "تم تعليق العضوية." : "تم تفعيل العضوية.",
      );
      setAction(null);
      setDetail(null);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "تعذر الحفظ.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      {message && (
        <p role="status" className="text-sm text-emerald-700">
          {message}
        </p>
      )}
      <div className="overflow-hidden rounded-lg border border-border/80 bg-card">
        <Table className="min-w-[750px] table-fixed">
          <TableHeader className="border-b border-border/80 bg-muted/20">
            <TableRow>
              {[
                "العضو",
                "البريد الإلكتروني",
                "حالة الحساب",
                "توثيق البريد",
                "تاريخ الانضمام",
                "الإجراءات",
              ].map((title, index) => (
                <TableHead
                  key={title}
                  style={{
                    width: ["23%", "27%", "12%", "12%", "14%", "12%"][index],
                  }}
                  className="font-display text-xs font-semibold"
                >
                  {title}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!members.length && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-muted-foreground"
                >
                  لا توجد عضويات تطابق البحث.
                </TableCell>
              </TableRow>
            )}
            {members.map((member) => (
              <TableRow
                key={member.id}
                className="transition-colors hover:bg-muted/30"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <ProfileAvatar
                      name={member.name}
                      image={member.image}
                      size={34}
                    />
                    <span className="min-w-0 truncate font-semibold">
                      {member.name || "بلا اسم"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    dir="ltr"
                    title={member.email}
                    className="block truncate text-start text-sm"
                  >
                    {member.email}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${member.status === "active" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300"}`}
                  >
                    {member.status === "active" ? "فعّال" : "معلّق"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5 text-xs">
                    {member.verified && (
                      <CheckCircle2Icon className="size-3.5 text-emerald-600" />
                    )}
                    {member.verified ? "موثّق" : "غير موثّق"}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {date(member.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      title="عرض التفاصيل"
                      aria-label={`عرض تفاصيل ${member.name}`}
                      onClick={() => setDetail(member)}
                    >
                      <EyeIcon />
                    </Button>
                    {canSuspend && (
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        title={
                          member.status === "active"
                            ? "تعليق الحساب"
                            : "تفعيل الحساب"
                        }
                        aria-label={`${member.status === "active" ? "تعليق" : "تفعيل"} ${member.name}`}
                        onClick={() => {
                          setAction(member);
                          setReason("");
                          setError("");
                          setMessage("");
                        }}
                      >
                        {member.status === "active" ? (
                          <PauseCircleIcon className="text-destructive" />
                        ) : (
                          <PlayCircleIcon className="text-emerald-600" />
                        )}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent side="left" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>تفاصيل العضو</SheetTitle>
            <SheetDescription>
              بيانات العضوية الحالية في العلم.
            </SheetDescription>
          </SheetHeader>
          {detail && (
            <div className="grid gap-6 px-6 pb-6">
              <ProfileAvatar
                name={detail.name}
                image={detail.image}
                size={72}
              />
              <dl className="grid gap-5 text-sm">
                {[
                  ["الاسم", detail.name],
                  ["البريد الإلكتروني", detail.email],
                  [
                    "حالة الحساب",
                    detail.status === "active" ? "فعّال" : "معلّق",
                  ],
                  ["توثيق البريد", detail.verified ? "موثّق" : "غير موثّق"],
                  ["تاريخ الانضمام", date(detail.createdAt)],
                  [
                    "إعداد الاهتمامات",
                    detail.onboarded ? "مكتمل" : "لم يُكمل بعد",
                  ],
                  ...(detail.reason ? [["سبب التعليق", detail.reason]] : []),
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="mt-1 break-words font-medium">
                      <bdi dir="auto">{value}</bdi>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={!!action}
        onOpenChange={(open) => {
          if (!open && !pending) setAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action?.status === "active"
                ? "تعليق العضوية"
                : "إعادة تفعيل العضوية"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action?.name} —{" "}
              {action?.status === "active"
                ? "سيتوقف الوصول إلى خدمات العضوية فورًا. تبقى بيانات العضو محفوظة."
                : "سيتمكن العضو من استخدام حسابه مجددًا."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {action?.status === "active" && (
            <div className="grid gap-2">
              <Label htmlFor="suspend-reason">سبب التعليق</Label>
              <Textarea
                id="suspend-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                required
              />
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>إلغاء</AlertDialogCancel>
            <Button
              variant={action?.status === "active" ? "destructive" : "default"}
              disabled={
                pending || (action?.status === "active" && !reason.trim())
              }
              onClick={() => void submit()}
            >
              {pending
                ? "جارٍ الحفظ…"
                : action?.status === "active"
                  ? "تعليق العضوية"
                  : "تفعيل العضوية"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
