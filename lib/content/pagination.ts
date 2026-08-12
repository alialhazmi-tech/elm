/** حجم صفحة القوائم العامة (أقسام / سلاسل). */
export const LIST_PAGE_SIZE = 18;

export type PageSlice<T> = {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
};

/** يحوّل قيمة ?p= إلى رقم صفحة صالح (≥1). */
export function parsePage(raw: string | undefined | null): number {
  const n = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

/** يقطع المصفوفة لصفحة واحدة ويضبط رقم الصفحة إن تجاوز العدد. */
export function paginate<T>(
  items: T[],
  rawPage: string | undefined | null,
  pageSize: number = LIST_PAGE_SIZE,
): PageSlice<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const page = Math.min(parsePage(rawPage), pageCount);
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);

  return {
    items: slice,
    page,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
  };
}

/** يبني رابط صفحة مع الحفاظ على بقية معاملات البحث. */
export function pageHref(basePath: string, page: number, extra?: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) params.set(key, value);
    }
  }
  if (page > 1) params.set("p", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
