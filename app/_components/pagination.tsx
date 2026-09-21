import Link from "next/link";

import { pageHref } from "@/lib/content/pagination";
import { toLatinDigits } from "@/lib/format";

type Props = {
  basePath: string;
  page: number;
  pageCount: number;
  extra?: Record<string, string | undefined>;
};

/** نافذة أرقام حول الصفحة الحالية. */
function windowPages(page: number, pageCount: number): Array<number | "gap"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const set = new Set<number>([1, pageCount, page, page - 1, page + 1, page - 2, page + 2]);
  const sorted = [...set].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);

  const out: Array<number | "gap"> = [];
  for (const n of sorted) {
    const prev = out[out.length - 1];
    if (typeof prev === "number" && n - prev > 1) out.push("gap");
    out.push(n);
  }
  return out;
}

export function Pagination({ basePath, page, pageCount, extra }: Props) {
  if (pageCount <= 1) return null;

  const pages = windowPages(page, pageCount);
  const prev = page > 1 ? page - 1 : null;
  const next = page < pageCount ? page + 1 : null;

  return (
    <nav className="pager" aria-label="ترقيم الصفحات">
      {prev ? (
        <Link className="pager-nav" href={pageHref(basePath, prev, extra)} rel="prev">
          السابق
        </Link>
      ) : (
        <span className="pager-nav is-disabled">السابق</span>
      )}

      <ol className="pager-pages">
        {pages.map((entry, index) =>
          entry === "gap" ? (
            <li key={`gap-${index}`} className="pager-gap" aria-hidden="true">…</li>
          ) : (
            <li key={entry}>
              {entry === page ? (
                <span className="is-current" aria-current="page">{toLatinDigits(entry)}</span>
              ) : (
                <Link href={pageHref(basePath, entry, extra)}>{toLatinDigits(entry)}</Link>
              )}
            </li>
          ),
        )}
      </ol>

      {next ? (
        <Link className="pager-nav" href={pageHref(basePath, next, extra)} rel="next">
          التالي
        </Link>
      ) : (
        <span className="pager-nav is-disabled">التالي</span>
      )}
    </nav>
  );
}
