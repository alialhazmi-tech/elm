import Link from "next/link";

import type { Series } from "@/lib/content/types";

/**
 * مسطرة السلاسل — شريط نحيف بعرض الصفحة تحت الهيدر مباشرة.
 * حلّت محل «بوابة السلاسل» الكحلية الكبيرة: حضور دائم بلا صراخ،
 * ولون السلسلة نقطة دقيقة لا طلاء. صنف الرابط series-lens عقدٌ
 * يفحصه tests/platform-contract.test.mjs (ثمانية روابط).
 */
export function SeriesRail({ series }: { series: Series[] }) {
  return (
    <nav className="series-rail" aria-label="سلاسل العلم">
      <div className="series-rail-inner">
        <span className="series-rail-label">سلاسل العلم</span>
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
          كل السلاسل <span aria-hidden="true">←</span>
        </Link>
      </div>
    </nav>
  );
}
