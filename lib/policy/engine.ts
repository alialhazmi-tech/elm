/**
 * محرك حارس السياسة: يشغّل القواعد، يرتّب المخالفات، ويطبّق الإصلاحات الآلية.
 * الحارس يفحص ولا ينشر — بوابة الاعتماد بشرية دائمًا.
 */

import type { Draft, Finding, GuardContext, GuardReport, Rule, Severity } from "./types.ts";
import { allRules } from "./rules/index.ts";

const SEVERITY_ORDER: Record<Severity, number> = {
  blocking: 0,
  warning: 1,
  suggestion: 2,
};

export function runPolicyGuard(
  draft: Draft,
  context: GuardContext = {},
  rules: Rule[] = allRules,
): GuardReport {
  const findings: Finding[] = [];

  for (const rule of rules) {
    findings.push(...rule.run(draft, context));
  }

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const counts: Record<Severity, number> = { blocking: 0, warning: 0, suggestion: 0 };
  for (const finding of findings) {
    counts[finding.severity] += 1;
  }

  const blockingRuleIds = [
    ...new Set(findings.filter((finding) => finding.severity === "blocking").map((f) => f.ruleId)),
  ];

  return {
    ok: counts.blocking === 0,
    canRequestApproval: counts.blocking === 0,
    findings,
    counts,
    rulesEvaluated: rules.length,
    audit: {
      actorId: context.actorId,
      draftId: draft.id,
      blockingRuleIds,
    },
  };
}

const POINT_FIELD = /^infographic\.points\[(\d+)\]$/;
const SCENE_FIELD = /^videographic\.scenes\[(\d+)\]$/;
const SOCIAL_FIELD = /^social\[(\d+)\]\.text$/;

function replaceAll(value: string, from: string, to: string): string {
  return value.split(from).join(to);
}

/** يطبّق إصلاحًا آليًا واحدًا على نسخة جديدة من المسودة. */
function applyOne(draft: Draft, field: string, from: string, to: string): Draft {
  const next: Draft = { ...draft };

  if (field === "title" && next.title) {
    next.title = replaceAll(next.title, from, to);
    return next;
  }

  if (field === "body" && next.body) {
    next.body = replaceAll(next.body, from, to);
    return next;
  }

  if (field === "infographic.intro" && next.infographic?.intro) {
    next.infographic = { ...next.infographic, intro: replaceAll(next.infographic.intro, from, to) };
    return next;
  }

  const pointMatch = POINT_FIELD.exec(field);
  if (pointMatch && next.infographic) {
    const index = Number(pointMatch[1]);
    const points = [...next.infographic.points];
    if (points[index] !== undefined) {
      points[index] = replaceAll(points[index], from, to);
      next.infographic = { ...next.infographic, points };
    }
    return next;
  }

  if (next.videographic && (field === "videographic.intro" || field === "videographic.outro")) {
    const key = field === "videographic.intro" ? "intro" : "outro";
    const current = next.videographic[key];
    if (current) {
      next.videographic = { ...next.videographic, [key]: replaceAll(current, from, to) };
    }
    return next;
  }

  const sceneMatch = SCENE_FIELD.exec(field);
  if (sceneMatch && next.videographic) {
    const index = Number(sceneMatch[1]);
    const scenes = [...next.videographic.scenes];
    if (scenes[index] !== undefined) {
      scenes[index] = replaceAll(scenes[index], from, to);
      next.videographic = { ...next.videographic, scenes };
    }
    return next;
  }

  const socialMatch = SOCIAL_FIELD.exec(field);
  if (socialMatch && next.social) {
    const index = Number(socialMatch[1]);
    const social = [...next.social];
    const caption = social[index];
    if (caption) {
      social[index] = { ...caption, text: replaceAll(caption.text, from, to) };
      next.social = social;
    }
    return next;
  }

  return next;
}

export interface AutofixResult {
  draft: Draft;
  applied: number;
  appliedRuleIds: string[];
}

/** يطبّق كل الإصلاحات الآلية المقترحة ويعيد مسودة جديدة دون المساس بالأصل. */
export function applyAutofixes(draft: Draft, findings: Finding[]): AutofixResult {
  let next = draft;
  const appliedRuleIds: string[] = [];

  for (const finding of findings) {
    if (!finding.autofix) continue;
    const { field, from, to } = finding.autofix;
    next = applyOne(next, field, from, to);
    appliedRuleIds.push(finding.ruleId);
  }

  return {
    draft: next,
    applied: appliedRuleIds.length,
    appliedRuleIds: [...new Set(appliedRuleIds)],
  };
}

/** يفحص، يصلح آليًا، ثم يعيد الفحص — الحالة التي تُعرض للمحرر. */
export function guardWithAutofix(draft: Draft, context: GuardContext = {}) {
  const initial = runPolicyGuard(draft, context);
  const fixed = applyAutofixes(draft, initial.findings);
  const report = fixed.applied > 0 ? runPolicyGuard(fixed.draft, context) : initial;

  return { draft: fixed.draft, report, autofixesApplied: fixed.applied };
}
