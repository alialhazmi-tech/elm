import Image from "next/image";
import Link from "next/link";
import type { JakCodeReport } from "@/lib/jak-report-types";
import { formatArticleTimestamp } from "@/lib/format";
import { jakPublicationTime } from "@/lib/jak-publication";
import { jakReportHref } from "@/lib/jak-urls";

export function JakReportIndex({ reports, preview = false }: { reports: JakCodeReport[]; preview?: boolean }) {
  const visible = reports.filter((report) => report.showOnHomepage);
  return <>
    <section className="hub-hero" style={{ margin: "0 0 24px", "--sc": "#12284b" } as React.CSSProperties}>
      <div className="hub-hero-copy">
        <p className="eyebrow">ملفات كبرى تشكّل العالم</p>
        <h1>جاك العلم</h1>
        <p className="hub-tagline">تقارير بصرية تفاعلية تضع الأحداث في سياقها.</p>
      </div>
      <p className="hub-count">{visible.length} تقارير{preview ? " · معاينة خاصة" : ""}</p>
    </section>
    {visible.length ? <div className="grid-3 sx-grid jak-index-grid" style={{ marginTop: 0 }}>
      {visible.map((report, index) => {
        const href = preview ? `/tahrir/jak-reports/${report.id}/preview` : jakReportHref(report);
        const publishedAt = jakPublicationTime(report);
        const publishedTimestamp = formatArticleTimestamp(publishedAt);
        return <article className="m-card" key={report.id}>
          {report.image && <Link className="m-media" href={href} tabIndex={-1} aria-hidden="true">
            <Image className="c-img" src={report.image} width={640} height={400} alt=""
              sizes="(max-width: 940px) calc(100vw - 32px), (max-width: 1120px) 50vw, (max-width: 1280px) 33vw, 400px"
              loading={index < 3 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "auto"} />
          </Link>}
          <div className="m-body">
            {preview && <div className="m-kick"><span>تجريبي · {report.status === "published" ? "منشور" : "غير منشور"}</span></div>}
            <h2 style={{ fontSize: "1.25rem" }}><Link href={href}>{report.title}</Link></h2>
            {publishedTimestamp && <time className="m-meta" dateTime={publishedAt}>{publishedTimestamp}</time>}
          </div>
        </article>;
      })}
    </div> : <p className="empty-state">لا توجد تقارير منشورة في هذا القسم بعد.</p>}
  </>;
}
