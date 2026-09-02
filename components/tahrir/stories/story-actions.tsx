"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { countLabel } from "./types";

/** الحد الأدنى الذي تحتاجه الحوارات — يعمل من الجدول ومن المحرر. */
export type ActionRow = { id: string; title: string };

export type StoryAction = { kind: "archive" | "restore" | "delete"; rows: ActionRow[] };

const REASON_CHIPS = [
  "خطأ وقائعي يحتاج تصحيحًا",
  "تكرار لمادة أخرى",
  "طلب إزالة أو تحديث رسمي",
  "لم تعد صالحة للنشر",
];

const NOUN = { one: "مادة واحدة", two: "مادتين", few: "مواد", many: "مادة" };

async function call(url: string, method: string, body: Record<string, string>): Promise<string | null> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (response?.ok) return null;
  const data = await response?.json().catch(() => null);
  return data?.error ?? "تعذر تنفيذ الإجراء.";
}

/** ينفّذ الإجراء على كل صف بالتتابع (المسارات فردية) ويلخّص النتيجة في تنبيه واحد. */
async function runAll(action: StoryAction, reason: string): Promise<{ ok: number; failed: string[] }> {
  let ok = 0;
  const failed: string[] = [];
  for (const row of action.rows) {
    const error =
      action.kind === "archive"
        ? await call("/api/tahrir/story/archive", "POST", { id: row.id, reason })
        : action.kind === "restore"
          ? await call("/api/tahrir/story/restore", "POST", { id: row.id })
          : await call("/api/tahrir/story", "DELETE", { id: row.id });
    if (error) failed.push(`${row.title}: ${error}`);
    else ok += 1;
  }
  return { ok, failed };
}

function announce(kind: StoryAction["kind"], result: { ok: number; failed: string[] }) {
  const verb = kind === "archive" ? "أُرشفت" : kind === "restore" ? "استُعيدت" : "حُذفت";
  if (result.ok > 0) toast.success(`${verb} ${countLabel(result.ok, NOUN)}.`);
  for (const message of result.failed) toast.error(message);
}

/** أرشفة بسبب إلزامي: تُخفى المادة عن الموقع فورًا وتبقى في تبويب المؤرشفة. */
export function ArchiveDialog({
  action,
  onClose,
  onDone,
}: {
  action: StoryAction | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = action?.rows ?? [];

  const submit = async () => {
    if (!action || busy) return;
    setBusy(true);
    const result = await runAll(action, reason);
    setBusy(false);
    announce("archive", result);
    if (result.ok > 0) {
      setReason("");
      onDone();
    }
  };

  return (
    <Dialog open={action?.kind === "archive"} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>أرشفة {rows.length === 1 ? "المادة" : countLabel(rows.length, NOUN)}</DialogTitle>
          <DialogDescription>
            {rows.length === 1 ? `تُخفى «${rows[0]?.title}»` : "تُخفى المواد المحددة"} عن الموقع فورًا وتبقى في تبويب
            المؤرشفة مع التاريخ والسبب. ليست حذفًا نهائيًا.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-1.5">
            {REASON_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setReason(chip)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent",
                  reason === chip && "border-foreground bg-foreground text-background hover:bg-foreground",
                )}
              >
                {chip}
              </button>
            ))}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="archive-reason">سبب الأرشفة</Label>
            <Textarea
              id="archive-reason"
              rows={3}
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="لماذا تُخفى هذه المادة عن القرّاء؟"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
          <Button variant="destructive" onClick={submit} disabled={busy || reason.trim().length === 0}>
            {busy ? "يؤرشف…" : "أرشفة وإخفاء عن الموقع"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** تأكيد الاستعادة أو حذف المسودة — الحذف نهائي، والاستعادة تعيد المادة مسودةً لا منشورة. */
export function ConfirmDialog({
  action,
  onClose,
  onDone,
}: {
  action: StoryAction | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const rows = action?.rows ?? [];
  const isDelete = action?.kind === "delete";
  const noun = rows.length === 1 ? `«${rows[0]?.title}»` : countLabel(rows.length, NOUN);

  const submit = async () => {
    if (!action || busy) return;
    setBusy(true);
    const result = await runAll(action, "");
    setBusy(false);
    announce(action.kind, result);
    if (result.ok > 0) onDone();
  };

  return (
    <AlertDialog open={action?.kind === "restore" || action?.kind === "delete"} onOpenChange={(open) => !open && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isDelete ? "حذف المسودة نهائيًا؟" : "استعادة كمسودة؟"}</AlertDialogTitle>
          <AlertDialogDescription>
            {isDelete
              ? `تُحذف ${noun} نهائيًا ولا يمكن التراجع عن هذا الإجراء.`
              : `تعود ${noun} مسودةً في اللوحة ولا تظهر على الموقع حتى يُعاد نشرها.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void submit();
            }}
            disabled={busy}
            className={cn(isDelete && "bg-destructive text-white hover:bg-destructive/90")}
          >
            {busy ? "ينفّذ…" : isDelete ? "حذف نهائي" : "استعادة"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** يجمع الحوارين ويربطهما بتحديث شجرة الخادم بعد النجاح. */
export function useStoryActions(onDone?: () => void) {
  const router = useRouter();
  const [action, setAction] = useState<StoryAction | null>(null);
  const close = () => setAction(null);
  const done = () => {
    setAction(null);
    onDone?.();
    router.refresh();
  };
  const dialogs = (
    <>
      <ArchiveDialog action={action} onClose={close} onDone={done} />
      <ConfirmDialog action={action} onClose={close} onDone={done} />
    </>
  );
  return { action, setAction, dialogs };
}
