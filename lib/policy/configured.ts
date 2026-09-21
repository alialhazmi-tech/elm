/** تطبيق مفاتيح الحوكمة على تقرير الحارس مع إبقاء بوابة حقوق الصور مستقلة. */

import { runPolicyGuard } from "./engine.ts";
import type { Draft, Finding, GuardContext, GuardReport, Severity } from "./types.ts";

export interface GuardControls {
  editorialGuard: boolean;
  requireImageRights: boolean;
}

function reportFrom(findings: Finding[], raw: GuardReport, rulesEvaluated: number): GuardReport {
  const counts: Record<Severity, number> = { blocking: 0, warning: 0, suggestion: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  const blockingRuleIds = [
    ...new Set(findings.filter((finding) => finding.severity === "blocking").map((finding) => finding.ruleId)),
  ];

  return {
    ok: counts.blocking === 0,
    canRequestApproval: counts.blocking === 0,
    findings,
    counts,
    rulesEvaluated,
    audit: { ...raw.audit, blockingRuleIds },
  };
}

export function runConfiguredPolicyGuard(
  draft: Draft,
  controls: GuardControls,
  context: GuardContext = {},
): GuardReport {
  const raw = runPolicyGuard(draft, context);
  const findings = raw.findings.filter((finding) => {
    if (finding.kind === "image-rights") return controls.requireImageRights;
    return controls.editorialGuard;
  });
  const rulesEvaluated = controls.editorialGuard ? raw.rulesEvaluated : controls.requireImageRights ? 1 : 0;
  return reportFrom(findings, raw, rulesEvaluated);
}
