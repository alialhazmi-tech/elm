import type { JakCodeReport } from "./jak-report-types.ts";

/** The legacy importer stored WordPress date_gmt without its UTC suffix. */
export function jakPublicationTime(report: Pick<JakCodeReport, "sourcePublishedAt" | "publishedAt">): string | undefined {
  const value = report.sourcePublishedAt ?? report.publishedAt;
  if (!value) return undefined;
  const timestamp = value.replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/, "$1Z");
  return Number.isNaN(Date.parse(timestamp)) ? undefined : timestamp;
}
