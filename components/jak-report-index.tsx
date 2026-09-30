import Image from "next/image";
import Link from "next/link";
import type { JakCodeReport } from "@/lib/jak-report-types";

export function JakReportIndex({ reports, preview = false }: { reports: JakCodeReport[]; preview?: boolean }) {
  const visible = reports.filter((report) => report.showOnHomepage);
  return <>
    <section className="hub-hero" style={{ margin: "0 0 24px", "--sc": "#12284b" } as React.CSSProperties}>
      <div className="hub-hero-copy">
        <p className="eyebrow">جاك العلم</p>
        <h1>ملفات كبرى تشكّل العالم</h1>
        <p className="hub-tagline">تقارير بصرية تفاعلية تضع الأحداث في سياقها.</p>
      </div>
      <p className="hub-count">{visible.length} تقارير{preview ? " · معاينة خاصة" : ""}</p>
    </section>
    {visible.length ? <div className="grid-3 sx-grid" style={{ marginTop: 0 }}>
      {visible.map((report) => {
        const href = preview ? `/tahrir/jak-reports/${report.id}/preview` : `/jak/${report.id}/${encodeURIComponent(report.slug)}`;
        return <article className="m-card" key={report.id}>
          {report.image && <Link className="m-media" href={href} tabIndex={-1} aria-hidden="true">
            <Image unoptimized className="c-img" src={report.image} width={640} height={400} alt="" />
          </Link>}
          <div className="m-body">
            <div className="m-kick"><span>جاك العلم</span>{preview && <span>تجريبي · {report.status === "published" ? "منشور" : "غير منشور"}</span>}</div>
            <h2 style={{ fontSize: "1.25rem" }}><Link href={href}>{report.title}</Link></h2>
            {report.excerpt && <p>{report.excerpt}</p>}
            <div className="m-meta"><span>تقرير تفاعلي</span></div>
          </div>
        </article>;
      })}
    </div> : <p className="empty-state">لا توجد تقارير منشورة في هذا القسم بعد.</p>}
  </>;
}
