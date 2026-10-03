import type { JakCodeReport } from "./jak-report-types.ts";

type JakReportUrl = Pick<JakCodeReport, "id" | "slug"> & { publicNumber?: number | null };

/** المعرّف الظاهر في الرابط العام؛ UUID هو fallback للـfixtures القديمة فقط. */
export function publicJakReportId(report: Pick<JakReportUrl, "id" | "publicNumber">): string {
  return Number.isSafeInteger(report.publicNumber) && (report.publicNumber as number) > 0
    ? String(report.publicNumber)
    : report.id;
}

/** الرابط القانوني الكامل لتقرير جاك. */
export function jakReportHref(report: JakReportUrl): string {
  return `/jak/${publicJakReportId(report)}/${encodeURIComponent(report.slug)}`;
}

/** رابط المشاركة القصير الذي يحوّل إلى الرابط القانوني الكامل. */
export function shortJakReportHref(report: Pick<JakCodeReport, "id"> & { publicNumber?: number | null }): string {
  return `/jak/${publicJakReportId(report)}`;
}
