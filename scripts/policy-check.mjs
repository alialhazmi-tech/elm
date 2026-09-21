#!/usr/bin/env node
/**
 * فحص مادة تحريرية بحارس السياسة من سطر الأوامر.
 *
 *   node scripts/policy-check.mjs examples/draft-sample.json
 *   node scripts/policy-check.mjs draft.json --fix     # يطبّق التصحيحات الآلية ويطبع المسودة
 *   node scripts/policy-check.mjs draft.json --json    # مخرج JSON للأتمتة وCI
 *
 * رمز الخروج 1 عند وجود مخالفة قاطعة — ما يمنع طلب الاعتماد.
 */

import { readFile } from "node:fs/promises";
import { argv, exit, stdout } from "node:process";

import { guardWithAutofix, runPolicyGuard } from "../lib/policy/index.ts";

const SEVERITY_LABEL = {
  blocking: "قاطع",
  warning: "تحذير",
  suggestion: "تصحيح مقترح",
};

const SEVERITY_ICON = {
  blocking: "■",
  warning: "▲",
  suggestion: "○",
};

const args = argv.slice(2);
const path = args.find((arg) => !arg.startsWith("--"));
const wantsFix = args.includes("--fix");
const wantsJson = args.includes("--json");

if (!path) {
  stdout.write("الاستخدام: node scripts/policy-check.mjs <draft.json> [--fix] [--json]\n");
  exit(2);
}

const draft = JSON.parse(await readFile(path, "utf8"));
const context = draft.__context ?? {};
delete draft.__context;

const outcome = wantsFix
  ? guardWithAutofix(draft, context)
  : { draft, report: runPolicyGuard(draft, context), autofixesApplied: 0 };

const { report } = outcome;

if (wantsJson) {
  stdout.write(`${JSON.stringify({ ...report, draft: outcome.draft }, null, 2)}\n`);
  exit(report.ok ? 0 : 1);
}

const lines = [];
lines.push("");
lines.push(`حارس السياسة التحريرية — ${draft.title ?? draft.id ?? path}`);
lines.push("─".repeat(64));
lines.push(
  `قواعد مفحوصة: ${report.rulesEvaluated} · قاطع: ${report.counts.blocking} · ` +
    `تحذير: ${report.counts.warning} · مقترح: ${report.counts.suggestion}`,
);

if (wantsFix) {
  lines.push(`تصحيحات آلية مطبقة: ${outcome.autofixesApplied}`);
}

lines.push("");

if (report.findings.length === 0) {
  lines.push("لا مخالفات. المادة جاهزة لطلب الاعتماد.");
} else {
  for (const finding of report.findings) {
    lines.push(
      `${SEVERITY_ICON[finding.severity]} [${SEVERITY_LABEL[finding.severity]}] ${finding.ruleId} — ${finding.field}`,
    );
    lines.push(`   ${finding.message}`);
    if (finding.excerpt) lines.push(`   المقتطف: ${finding.excerpt}`);
    if (finding.needsHumanReview) lines.push("   يتطلب مراجعة بشرية قبل الاعتماد.");
    lines.push(`   المرجع: ${finding.policyRef}`);
    lines.push("");
  }
}

lines.push("─".repeat(64));
lines.push(
  report.canRequestApproval
    ? "الحالة: يجوز إرسال المادة إلى الاعتماد."
    : `الحالة: ممنوع طلب الاعتماد حتى معالجة: ${report.audit.blockingRuleIds.join("، ")}`,
);
lines.push("");

stdout.write(`${lines.join("\n")}\n`);

if (wantsFix && outcome.autofixesApplied > 0) {
  stdout.write(`${JSON.stringify(outcome.draft, null, 2)}\n`);
}

exit(report.ok ? 0 : 1);
