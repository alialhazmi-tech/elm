import Link from "next/link";

import { toLatinDigits } from "@/lib/format";
import type { Series } from "@/lib/content/types";

export function SeriesNavigator({ series }: { series: Series[] }) {
  return (
    <section className="series-gateway" aria-labelledby="series-gateway-title">
      <div className="series-gateway-head">
        <div>
          <span className="series-gateway-kicker">مسارات العلم</span>
          <h2 id="series-gateway-title">اختر طريقتك في الفهم</h2>
          <p>الخبر نقطة البداية. كل سلسلة تمنحك زاوية مختلفة للوصول إلى الصورة الكاملة.</p>
        </div>
        <Link className="series-gateway-all" href="/series">
          استكشف السلاسل الثماني <span aria-hidden="true">←</span>
        </Link>
      </div>

      <nav className="series-lenses" aria-label="استكشف سلاسل العلم">
        {series.map((item, index) => (
          <Link
            key={item.slug}
            className="series-lens"
            href={`/series/${item.slug}`}
            style={{ "--sc": item.color } as React.CSSProperties}
          >
            <span className="series-lens-no latin-number" dir="ltr" lang="en" aria-hidden="true">
              {toLatinDigits(String(index + 1).padStart(2, "0"))}
            </span>
            <span className="series-lens-copy">
              <b>{item.name}</b>
              <span>{item.description}</span>
            </span>
            <span className="series-lens-arrow" aria-hidden="true">←</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}
