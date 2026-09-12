import { normalizeArabic, toLatinDigits } from "../policy/normalize.ts";

/** نفس تطبيع دالة SQL؛ لا نغيّر المحتوى المحفوظ أو نحذف كلمات من الاستعلام. */
export function normalizeSearchText(value: string): string {
  return normalizeArabic(toLatinDigits(value
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:#\d+|#x[\da-f]+|[a-z]+);/gi, " ")
  )).toLowerCase();
}
