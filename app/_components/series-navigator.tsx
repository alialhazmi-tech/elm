import Link from "next/link";

import type { Series } from "@/lib/content/types";

/** فاصل رمادي هادئ يظهر تحت الهيدر وقبل التذييل. */
export function SeriesSpectrum({ className }: { className?: string }) {
  return <div className={className ? `series-spectrum ${className}` : "series-spectrum"} aria-hidden="true" />;
}

/**
 * مسطرة السلاسل — شريط نحيف بعرض الصفحة تحت الهيدر، شقيق له لا ابن.
 * تلتصق وحدها عند التمرير فيختفي الهيدر ويبقى صف السلاسل.
 * على الجوال تتحوّل إلى رقائق ملوّنة قابلة للتمرير ولا تختفي أبدًا.
 * صنف الرابط series-lens عقدٌ يفحصه tests/platform-contract.test.mjs.
 */
export function SeriesRail({ series }: { series: Series[] }) {
  return (
    <nav className="series-rail" aria-label="سلاسل العلم">
      <SeriesSpectrum />
      <div className="series-rail-inner">
        <span className="series-rail-label">السلاسل</span>
        {series.map((item) => (
          <Link
            key={item.slug}
            className="series-lens"
            href={`/series/${item.slug}`}
            style={{ "--sc": item.color } as React.CSSProperties}
          >
            <i aria-hidden="true" />
            {item.name}
          </Link>
        ))}
        <Link className="series-rail-all" href="/series">
          كل السلاسل
        </Link>
      </div>
    </nav>
  );
}
