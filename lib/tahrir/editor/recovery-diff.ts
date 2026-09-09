/** ما الذي يختلف بين النسخة المحلية المستعادة ونسخة الخادم — أعداد فقط، بلا عرض نصوص. */

import { stripHtmlToText } from "../../content/html.ts";

export interface RecoveryFields {
  title: string;
  excerpt: string;
  body: string;
}

export interface RecoveryDiff {
  titleChanged: boolean;
  excerptChanged: boolean;
  /** فرق عدد كلمات المتن: موجب حين تزيد النسخة المحلية. */
  bodyWordDelta: number;
  /** لا فرق يذكر في الحقول الثلاثة. */
  same: boolean;
}

const words = (html: string) => stripHtmlToText(html).split(/\s+/u).filter(Boolean).length;
const norm = (text: string) => text.replace(/\s+/g, " ").trim();

export function describeRecoveryDiff(server: RecoveryFields, local: RecoveryFields): RecoveryDiff {
  const titleChanged = norm(server.title) !== norm(local.title);
  const excerptChanged = norm(server.excerpt) !== norm(local.excerpt);
  const bodyWordDelta = words(local.body) - words(server.body);
  const bodyChanged = bodyWordDelta !== 0 || norm(stripHtmlToText(server.body)) !== norm(stripHtmlToText(local.body));
  return { titleChanged, excerptChanged, bodyWordDelta, same: !titleChanged && !excerptChanged && !bodyChanged };
}

/** جملة عربية موجزة للتنبيه: «العنوان مختلف · الموجز مطابق · المتن +12 كلمة». */
export function recoveryDiffLabel(diff: RecoveryDiff): string {
  const delta = diff.bodyWordDelta === 0 ? "المتن بنفس عدد الكلمات" : diff.bodyWordDelta > 0 ? `المتن +${diff.bodyWordDelta} كلمة` : `المتن −${Math.abs(diff.bodyWordDelta)} كلمة`;
  return [diff.titleChanged ? "العنوان مختلف" : "العنوان مطابق", diff.excerptChanged ? "الموجز مختلف" : "الموجز مطابق", delta].join(" · ");
}
