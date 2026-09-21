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
import { formatRiyadhDate } from "@/lib/format";
import type { AudienceMember } from "@/lib/membership/admin";
import { apiCall } from "@/lib/tahrir/client-api";
const date = (value: string) => formatRiyadhDate(value) || "—";
/** حالة العضوية بلون دلالي من رموز .th (فعّال = ok، معلّق = block). */
const statusTone = (status: string) => (status === "active" ? "bg-(--t-ok-bg) text-(--t-ok)" : "bg-(--t-block-bg) text-(--t-block)");
/** أزرار الصف: 36px على الجوال (هدف لمس) و24px على المكتبي. */
const ROW_ICON_BUTTON = "size-9 md:size-6";
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
    const result = await apiCall(
      `/api/tahrir/audience/${encodeURIComponent(action.id)}/status`,
      { method: "POST", body: { status: action.status === "active" ? "suspended" : "active", reason } },
      { fallback: "تعذر الحفظ." },
    );
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(action.status === "active" ? "تم تعليق العضوية." : "تم استئناف العضوية.");
    setAction(null);
    setDetail(null);
    router.refresh();
  }
  return (
    <>
      {message && (
        <p role="status" className="text-sm text-(--t-ok)">
          {message}
        </p>
      )}
      <div className="overflow-hidden rounded-lg border border-border/80 bg-card">
        {/* على الجوال يبقى العضو والإجراءات؛ البريد والحالة والتوثيق والتاريخ تنزل شارات تحت الاسم. */}
        <Table containerClassName="scroll-fade-x" className="md:min-w-[750px] md:table-fixed">
          <TableHeader className="border-b border-border/80 bg-muted/20">
            <TableRow>
              <TableHead className="font-display text-xs font-semibold md:w-[23%]">العضو</TableHead>
              <TableHead className="hidden font-display text-xs font-semibold md:table-cell md:w-[27%]">البريد الإلكتروني</TableHead>
              <TableHead className="hidden font-display text-xs font-semibold md:table-cell md:w-[12%]">حالة الحساب</TableHead>
              <TableHead className="hidden font-display text-xs font-semibold lg:table-cell lg:w-[12%]">توثيق البريد</TableHead>
              <TableHead className="hidden font-display text-xs font-semibold lg:table-cell lg:w-[14%]">تاريخ الانضمام</TableHead>
              <TableHead className="w-20 font-display text-xs font-semibold md:w-[12%]">الإجراءات</TableHead>
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
                <TableCell className="whitespace-normal">
                  <div className="flex items-center gap-3">
                    <ProfileAvatar
                      name={member.name}
                      image={member.image}
                      size={34}
                    />
                    <div className="grid min-w-0 gap-1">
                      <span className="min-w-0 truncate font-semibold">
                        {member.name || "بلا اسم"}
                      </span>
                      <span dir="ltr" title={member.email} className="truncate text-start text-[11px] text-muted-foreground md:hidden">
                        {member.email}
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground lg:hidden">
                        <span className={`rounded-full px-2 py-0.5 font-semibold md:hidden ${statusTone(member.status)}`}>
                          {member.status === "active" ? "فعّال" : "معلّق"}
                        </span>
                        <span>{member.verified ? "موثّق" : "غير موثّق"}</span>
                        <span className="tabular-nums">انضم {date(member.createdAt)}</span>
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span
                    dir="ltr"
                    title={member.email}
                    className="block truncate text-start text-sm"
                  >
                    {member.email}
                  </span>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(member.status)}`}
                  >
                    {member.status === "active" ? "فعّال" : "معلّق"}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span className="flex items-center gap-1.5 text-xs">
                    {member.verified && (
                      <CheckCircle2Icon className="size-3.5 text-(--t-ok)" />
                    )}
                    {member.verified ? "موثّق" : "غير موثّق"}
                  </span>
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                  {date(member.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className={ROW_ICON_BUTTON}
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
                        className={ROW_ICON_BUTTON}
                        title={
                          member.status === "active"
                            ? "تعليق الحساب"
                            : "استئناف الحساب"
                        }
                        aria-label={`${member.status === "active" ? "تعليق" : "استئناف"} ${member.name}`}
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
                          <PlayCircleIcon className="text-(--t-ok)" />
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
                : "استئناف العضوية"}
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
                  : "استئناف العضوية"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
