/** نافذة أرقام الصفحات: الأولى والأخيرة والمجاورتان للحالية؛ الفجوات تُعرض «…» في المكوّن. */
export function pageWindow(page: number, totalPages: number, radius = 1): number[] {
  const last = Math.max(1, Math.floor(totalPages));
  const current = Math.min(Math.max(1, Math.floor(page)), last);
  const numbers: number[] = [];
  for (let number = 1; number <= last; number += 1) {
    if (number === 1 || number === last || Math.abs(number - current) <= radius) numbers.push(number);
  }
  return numbers;
}

/** «من–إلى من الإجمالي» بأرقام لاتينية؛ صفر نتائج تعطي 0–0. */
export function pageRange(page: number, perPage: number, total: number): { from: number; to: number } {
  if (total <= 0) return { from: 0, to: 0 };
  const from = (Math.max(1, page) - 1) * perPage + 1;
  return { from: Math.min(from, total), to: Math.min(total, Math.max(1, page) * perPage) };
}
