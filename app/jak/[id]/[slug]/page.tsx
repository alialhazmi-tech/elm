import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/app/_components/site-chrome";
import { getJakReport } from "@/lib/tahrir/jak-reports";
import { JakCodeFrame } from "@/components/jak-code-frame";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const report = await getJakReport((await params).id);
  if (!report || report.status !== "published") return { title: "التقرير غير موجود", robots: { index: false, follow: false } };
  const url = `/jak/${report.id}/${encodeURIComponent(report.slug)}`;
  return { title: report.title, description: report.excerpt, alternates: { canonical: url }, openGraph: { title: report.title, description: report.excerpt, url, type: "article", ...(report.image ? { images: [report.image] } : {}) } };
}

export default async function JakReportPage({ params }: Props) {
  const { id, slug } = await params;
  const report = await getJakReport(id);
  if (!report || report.status !== "published") notFound();
  if (slug !== report.slug) permanentRedirect(`/jak/${report.id}/${encodeURIComponent(report.slug)}`);
  return <>
    <SiteHeader active="/jak" />
    <main id="main-content">
      <div className="wrap" style={{ paddingBlock: 12 }}><Link href="/jak">جاك العلم</Link><h1 style={{ fontSize: "1.1rem", marginBlock: 6 }}>{report.title}</h1></div>
      <JakCodeFrame id={report.id} title={report.title} />
    </main>
    <SiteFooter />
  </>;
}
