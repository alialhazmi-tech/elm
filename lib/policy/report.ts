/** ملخص المخالفات القاطعة للعرض في المحرر — المعرّف وحده لا يخبر المحرر بما يفعل. */

import type { GuardReport } from "./types";

export interface BlockingFinding {
  ruleId: string;
  message: string;
  excerpt?: string;
}

export const blockingFindings = (report: GuardReport): BlockingFinding[] =>
  report.findings
    .filter((finding) => finding.severity === "blocking")
    .map(({ ruleId, message, excerpt }) => ({ ruleId, message, excerpt }));
