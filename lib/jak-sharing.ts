import type { Metadata } from "next";
import type { JakCodeReport } from "./jak-report-types.ts";
import { sharingMetadata } from "./sharing.ts";
import { cleanMetadataText, cleanMetadataTitle } from "./seo/metadata.ts";
import { jakReportHref } from "./jak-urls.ts";

export const JAK_TITLE = "جاك العلم";
export const JAK_DESCRIPTION = "تقارير بصرية تفاعلية تشرح الملفات الكبرى وتضع الأحداث في سياقها.";

export function jakIndexMetadata(): Metadata {
  const sharing = sharingMetadata({ title: JAK_TITLE, description: JAK_DESCRIPTION, path: "/jak" });
  return {
    title: { absolute: JAK_TITLE },
    description: JAK_DESCRIPTION,
    alternates: { canonical: "/jak" },
    ...sharing,
    openGraph: { ...sharing.openGraph, siteName: JAK_TITLE },
  };
}

export function jakReportMetadata(report: Pick<JakCodeReport, "id" | "publicNumber" | "slug" | "title" | "excerpt" | "image" | "publishedAt" | "sourcePublishedAt">): Metadata {
  const title = `${cleanMetadataTitle(report.title)} | ${JAK_TITLE}`;
  const description = cleanMetadataText(report.excerpt) || JAK_DESCRIPTION;
  const path = jakReportHref(report);
  const sharing = sharingMetadata({
    title, description, path, type: "article", format: "jakalelm",
    storyId: `jak-report-${report.id}`, image: report.image ?? undefined,
    publishedTime: report.sourcePublishedAt ?? report.publishedAt ?? undefined,
  });
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    ...sharing,
    openGraph: { ...sharing.openGraph, siteName: JAK_TITLE },
  };
}
