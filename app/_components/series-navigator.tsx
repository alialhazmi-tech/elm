import Link from "next/link";

import type { Series } from "@/lib/content/types";

/**
 * مسطرة السلاسل — الجهة اليسرى من الشريط الثاني تحت الهيدر (الرئيسية).
 * صنف الرابط series-lens وحاوية series-rail-inner عقدٌ يفحصه tests/platform-contract.test.mjs.
 */
export function SeriesRail({ series, active }: { series: Series[]; active?: string }) {
  return (
    <nav className="series-rail" aria-label="سلاسل العلم">
      <div className="series-rail-inner">
        {series.map((item) => (
          <Link
            key={item.slug}
            className="series-lens"
            href={`/series/${item.slug}`}
            aria-current={item.slug === active ? "page" : undefined}
            style={{ "--sc": item.color } as React.CSSProperties}
          >
            <i aria-hidden="true" />
            {item.name}
          </Link>
        ))}
        <Link className="series-rail-all" href="/series">
          كل السلاسل <span aria-hidden="true">←</span>
        </Link>
      </div>
    </nav>
  );
}
