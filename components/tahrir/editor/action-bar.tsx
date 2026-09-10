"use client";

import Link from "next/link";
import { ExternalLinkIcon, FilePenLineIcon, HistoryIcon, RefreshCwIcon, SaveIcon, SendIcon, ShieldCheckIcon } from "lucide-react";

import { StatusPill } from "@/components/tahrir/badges";
import { StoryTimeline } from "@/components/tahrir/story-timeline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { GuardControls } from "@/lib/policy";
import { cn } from "@/lib/utils";

import { ArticlePreview } from "./article-preview";

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  review: "بانتظار الاعتماد",
  scheduled: "مجدولة",
  published: "منشورة",
  archived: "مؤرشفة",
};

const riyadh = (iso: string, style: "short" | "long") =>
  new Date(iso).toLocaleString("ar-SA-u-ca-gregory-nu-latn", style === "short" ? { timeZone: "Asia/Riyadh", dateStyle: "short", timeStyle: "short" } : { timeZone: "Asia/Riyadh" });

export interface ActionBarProps {
  isNew: boolean;
  id: string;
  status: string;
  canApprove: boolean;
  canSubmit: boolean;
  historyHref?: string | null;
  busy: boolean;
  workflowBusy: boolean;
  navigating: boolean;
  autosave: { state: "idle" | "saving" | "saved" | "error"; dirty: boolean; savedAt: Date | null };
  recoveryPending: boolean;
  lastUpdatedAt: string | null;
  guardBusy: boolean;
  guardError: boolean;
  gateOpen: boolean;
  blocking: number;
  guardControls: GuardControls;
  publicHref: string | null;
  getPreview: () => { title: string; excerpt: string; body: string; image: string; section: string };
  onSave: () => void;
  onSubmit: () => void;
  onPublish: () => void;
  onReturnToDraft: () => void;
  onRetryGuard: () => void;
}

/** شريط الإجراءات اللاصق: الحالة، مؤشر الحفظ، حالة الحارس، ثم أزرار الحفظ والإرسال والنشر. */
export function ActionBar(props: ActionBarProps) {
  const { autosave, guardControls } = props;
  const allGatesDisabled = !guardControls.editorialGuard && !guardControls.requireImageRights;
  const rightsOnly = !guardControls.editorialGuard && guardControls.requireImageRights;

  const saveStatus = props.workflowBusy
    ? props.navigating ? "اكتملت العملية؛ جارٍ العودة إلى قائمة المواد…" : "جارٍ إتمام الإجراء على الخادم…"
    : props.busy ? "جارٍ الحفظ على الخادم…"
      : autosave.state === "error" ? "لم يُحفظ على الخادم — أعد الحفظ يدويًا"
        : props.recoveryPending ? "الحفظ التلقائي متوقف حتى مراجعة النسخة المحلية"
          : props.status !== "draft" ? `الحفظ التلقائي للمسودات؛ احفظ التعديل يدويًا${props.lastUpdatedAt ? ` · آخر حفظ: ${riyadh(props.lastUpdatedAt, "short")} (الرياض)` : ""}`
            : autosave.dirty ? "تعديلات غير محفوظة — تُحفظ تلقائيًا بعد توقف الكتابة"
              : autosave.savedAt ? `محفوظ على الخادم · ${autosave.savedAt.toLocaleTimeString("ar-SA-u-ca-gregory-nu-latn", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                : props.id ? props.lastUpdatedAt ? `محفوظ على الخادم · ${riyadh(props.lastUpdatedAt, "long")}` : "محفوظ على الخادم"
                  : "الحفظ التلقائي على الخادم مفعّل";

  const guardTone = allGatesDisabled ? "text-(--t-warn)" : props.guardError ? "text-(--t-warn)" : props.gateOpen ? "text-(--t-ok)" : props.guardBusy ? "text-muted-foreground" : "text-(--t-block)";
  const guardLabel = allGatesDisabled
    ? "فحوصات النشر الآلية معطّلة"
    : props.guardBusy
      ? rightsOnly ? "يفحص حقوق الصورة…" : "يفحص الحارس…"
      : props.guardError
        ? "تعذر فحص الحارس"
        : props.gateOpen
          ? rightsOnly ? "حقوق الصورة سليمة" : "جاهزة للاعتماد"
          : `${props.blocking} مخالفة قاطعة`;
  const gateHint = props.guardError ? "تعذر الاتصال بالحارس — أعد الفحص قبل الاعتماد" : "البوابة مغلقة حتى يكتمل الحارس بلا مخالفة قاطعة";

  return (
    <Card className="gap-0 bg-(--t-navy-bg) py-0 shadow-md">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="text-[11px] text-muted-foreground">{props.isNew ? "مادة جديدة" : "تحرير المادة"}</span>
        <StatusPill status={props.status} label={STATUS_LABELS[props.status] ?? props.status} />
        <span data-tour="save-status" role="status" aria-live="polite" className={cn("text-[11px]", autosave.state === "error" ? "text-destructive" : "text-muted-foreground")}>
          {saveStatus}
        </span>
        <span title={allGatesDisabled ? "فحص السياسة التحريرية واشتراط توثيق حقوق الصور معطّلان من إعدادات النظام. النشر يظل متاحًا لمن يملك الصلاحية." : undefined} className={cn("inline-flex items-center gap-1.5 border-s ps-2 text-xs", guardTone)}>
          <ShieldCheckIcon className="size-3.5" />
          {guardLabel}
          {props.guardError && !allGatesDisabled ? (
            <Button size="xs" variant="outline" onClick={props.onRetryGuard} disabled={props.guardBusy}>
              <RefreshCwIcon data-icon="inline-start" />
              أعد الفحص
            </Button>
          ) : null}
        </span>
        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          <StoryTimeline id={props.id || null} />
          {props.historyHref ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={props.historyHref}>
                <HistoryIcon data-icon="inline-start" />
                <span className="hidden sm:inline">سجل النسخ</span>
              </Link>
            </Button>
          ) : null}
          <ArticlePreview getDraft={props.getPreview} />
          {props.publicHref ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={props.publicHref} target="_blank" rel="noreferrer">
                <ExternalLinkIcon data-icon="inline-start" />
                <span className="hidden sm:inline">عرض على الموقع</span>
              </Link>
            </Button>
          ) : null}
          {props.canApprove && props.status === "published" ? (
            <Button size="sm" variant="secondary" onClick={props.onReturnToDraft} disabled={props.busy || props.workflowBusy} title="حفظ التعديلات وإخفاء المادة عن الموقع حتى نشرها مجددًا">
              <FilePenLineIcon data-icon="inline-start" />
              تحويل إلى مسودة
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={props.onSave} disabled={props.busy || props.workflowBusy || (props.status === "published" && props.canApprove && !props.gateOpen)}>
            <SaveIcon data-icon="inline-start" />
            {props.busy ? "يحفظ…" : props.status === "published" ? props.canApprove ? "تحديث المادة" : "حفظ مسودة التعديل" : "حفظ المسودة"}
          </Button>
          {props.canSubmit && props.status !== "published" && props.status !== "archived" ? (
            <Button size="sm" variant="secondary" onClick={props.onSubmit} disabled={!props.gateOpen || props.busy || props.workflowBusy} title={props.gateOpen ? undefined : gateHint}>
              <SendIcon data-icon="inline-start" className="rtl:-scale-x-100" />
              إرسال للاعتماد
            </Button>
          ) : null}
          {props.canApprove && props.status !== "published" && props.status !== "archived" ? (
            <Button size="sm" className="font-display font-bold" onClick={props.onPublish} disabled={!props.gateOpen || props.busy || props.workflowBusy} title={props.gateOpen ? undefined : props.guardError ? gateHint : "النشر يعلّق حتى تُحل المخالفات القاطعة"}>
              اعتماد ونشر
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
