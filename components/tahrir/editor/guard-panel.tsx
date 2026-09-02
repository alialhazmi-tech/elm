"use client";

import { LocateIcon, WandSparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Finding, GuardReport } from "@/lib/policy/types";
import { cn } from "@/lib/utils";

const SEVERITY_LABELS: Record<string, string> = {
  blocking: "قاطع",
  warning: "تحذير",
  suggestion: "مقترح",
};

const SEVERITY_TONE: Record<string, string> = {
  blocking: "--t-block",
  warning: "--t-warn",
  suggestion: "--t-sug",
};

export interface ArchiveEventView {
  at: string;
  actor: string;
  reason: string;
}

/** تبويب الحارس: ملخص بثلاث شدات، الملاحظات بإصلاح آلي وانتقال إلى الموضع، ثم حالة البوابة. */
export function GuardPanel({
  report,
  guardBusy,
  gateOpen,
  onFix,
  onLocate,
  status,
  archiveEvent,
}: {
  report: GuardReport | null;
  guardBusy: boolean;
  gateOpen: boolean;
  onFix: (finding: Finding) => void;
  onLocate: (finding: Finding) => void;
  status: string;
  archiveEvent: ArchiveEventView | null;
}) {
  const counts = report?.counts;
  return (
    <div className="grid">
      <div className="grid grid-cols-3 gap-1.5 p-3">
        {(
          [
            ["blocking", "قاطع", "--t-block", "--t-block-bg"],
            ["warning", "تحذير", "--t-warn", "--t-warn-bg"],
            ["suggestion", "مقترح", "--t-sug", "--t-sug-bg"],
          ] as const
        ).map(([key, label, color, bg]) => (
          <div key={key} className="rounded-md px-2 py-1.5 text-center" style={{ background: `var(${bg})`, color: `var(${color})` }}>
            <div className="font-display text-lg leading-none font-extrabold tabular-nums">{counts?.[key] ?? 0}</div>
            <div className="mt-0.5 text-[10.5px]">{label}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span
          aria-hidden
          className={cn(
            "size-2 rounded-full",
            guardBusy ? "animate-pulse bg-muted-foreground" : report && report.counts.blocking === 0 ? "bg-(--t-ok)" : "bg-(--t-block)",
          )}
        />
        {guardBusy ? "يفحص الحارس…" : report ? `${report.rulesEvaluated} قاعدة · ${report.findings.length} ملاحظات` : "اكتب ليفحص"}
      </div>

      {report?.findings.slice(0, 12).map((finding, index) => (
        <div key={`${finding.ruleId}-${index}`} className="grid grid-cols-[3px_1fr] gap-2.5 border-t px-3 py-2.5">
          <span className="rounded-full" style={{ background: `var(${SEVERITY_TONE[finding.severity] ?? "--t-sug"})` }} />
          <div className="grid gap-1">
            <div className="font-display text-[10.5px] text-muted-foreground">
              {finding.ruleId} · {SEVERITY_LABELS[finding.severity] ?? finding.severity}
            </div>
            <div className="text-[12.5px] leading-relaxed">{finding.message}</div>
            <div className="flex flex-wrap gap-1.5">
              {finding.excerpt ? (
                <Button size="xs" variant="outline" onClick={() => onLocate(finding)}>
                  <LocateIcon data-icon="inline-start" />
                  انتقل للموضع
                </Button>
              ) : null}
              {finding.autofix ? (
                <Button size="xs" variant="outline" className="text-(--t-sug)" onClick={() => onFix(finding)}>
                  <WandSparklesIcon data-icon="inline-start" />
                  أصلح آليًا
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ))}

      <div
        className={cn(
          "m-3 rounded-md px-3 py-2 text-xs leading-relaxed",
          guardBusy || !report ? "bg-muted text-muted-foreground" : gateOpen ? "bg-(--t-ok-bg) text-(--t-ok)" : "bg-(--t-block-bg) text-(--t-block)",
        )}
      >
        {guardBusy || !report ? (
          <>
            <b>جارٍ فحص المادة</b> — لا يمكن طلب الاعتماد قبل اكتمال الحارس.
          </>
        ) : gateOpen ? (
          <>
            <b>البوابة مفتوحة</b> — لا مخالفات قاطعة. الاعتماد النهائي بشري دائمًا.
          </>
        ) : (
          <>
            <b>ممنوع طلب الاعتماد</b> حتى معالجة: {report.audit.blockingRuleIds.join("، ")}
          </>
        )}
      </div>

      {status === "archived" ? (
        <div className="mx-3 mb-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <b className="text-foreground">هذه المادة مؤرشفة</b>
          {archiveEvent ? (
            <span>
              {" "}— أُرشفت{" "}
              {new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(new Date(archiveEvent.at))}
              {archiveEvent.actor ? ` بواسطة ${archiveEvent.actor}` : ""} — السبب: {archiveEvent.reason}
            </span>
          ) : (
            <span> — مخفية عن الموقع. استعدها كمسودة ثم انشرها من جديد إن لزم.</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
