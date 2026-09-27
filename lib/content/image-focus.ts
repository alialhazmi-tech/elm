/**
 * نقطة تركيز صورة المادة — "س% ص%" تُمرَّر كما هي إلى object-position.
 *
 * لماذا النسبة مباشرة لا حساب الإزاحة: مع object-position ‏p% تقع النقطة p
 * داخل الجزء الظاهر دائمًا أيًّا كانت نسبة الإطار (طولي في الصدارة أو عرضي
 * في البطاقات)، فقيمة واحدة تخدم كل الإطارات دون معرفة مقاساتها.
 */

import type { CSSProperties } from "react";

const FOCUS = /^(\d{1,3})% (\d{1,3})%$/;

export type ImageFocusPoint = { x: number; y: number };

/** وجه مكتشف بإحداثيات بكسل الصورة الأصلية ودرجة ثقة بين 0 و1. */
export type DetectedFace = { originX: number; originY: number; width: number; height: number; score: number };

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

export function formatImageFocus(point: ImageFocusPoint): string {
  return `${clamp(point.x)}% ${clamp(point.y)}%`;
}

/** أي مدخل غير الصيغة القياسية يسقط إلى null (= المنتصف) — القاعدة والعميل ليسا مصدر ثقة. */
export function normalizeImageFocus(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = FOCUS.exec(value.trim());
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  if (x > 100 || y > 100) return null;
  // المنتصف هو السلوك الافتراضي؛ لا داعي لتخزينه.
  return x === 50 && y === 50 ? null : `${x}% ${y}%`;
}

export function parseImageFocus(value: unknown): ImageFocusPoint | null {
  const focus = normalizeImageFocus(value);
  if (!focus) return null;
  const [x, y] = focus.split(" ").map((part) => Number.parseInt(part, 10));
  return { x, y };
}

export function imageFocusStyle(value: unknown): CSSProperties | undefined {
  const focus = normalizeImageFocus(value);
  return focus ? { objectPosition: focus } : undefined;
}

/** أقل ثقة يُعتد بها — ما دونها في عينة الأرشيف كان ظلالًا وأنماطًا لا وجوهًا. */
const MIN_SCORE = 0.6;
/** وجه أصغر من نصف أكبر وجه خلفية لا موضوع. */
const BACKGROUND_RATIO = 0.5;
/**
 * أقصى امتداد أفقي لمجموعة الوجوه (نسبة من العرض) يتسع له إطار الصدارة الطولي؛
 * صورة 16:9 في إطار 416×655 يظهر منها نحو 36% فقط.
 */
const GROUP_SPAN = 0.3;

/**
 * نقطة التركيز من الوجوه: مركز المجموعة إن اتسع لها الإطار الضيق، وإلا الوجه
 * الأكبر (وجهان متباعدان يضيع كلاهما إذا توسطنا بينهما). بلا وجوه موثوقة → null.
 */
export function imageFocusFromFaces(width: number, height: number, faces: readonly DetectedFace[]): string | null {
  if (!(width > 0 && height > 0)) return null;
  const confident = faces.filter((face) => face.score >= MIN_SCORE && face.width > 0 && face.height > 0);
  if (!confident.length) return null;
  const largest = confident.reduce((best, face) => (face.width * face.height > best.width * best.height ? face : best));
  const subjects = confident.filter((face) => face.width >= largest.width * BACKGROUND_RATIO);
  const left = Math.min(...subjects.map((face) => face.originX));
  const right = Math.max(...subjects.map((face) => face.originX + face.width));
  const group = (right - left) / width <= GROUP_SPAN ? subjects : [largest];
  const x0 = Math.min(...group.map((face) => face.originX));
  const x1 = Math.max(...group.map((face) => face.originX + face.width));
  const y0 = Math.min(...group.map((face) => face.originY));
  const y1 = Math.max(...group.map((face) => face.originY + face.height));
  return normalizeImageFocus(formatImageFocus({ x: ((x0 + x1) / 2 / width) * 100, y: ((y0 + y1) / 2 / height) * 100 }));
}

/** الإنفوجرافيك لوحة نصية: نقل القص إلى وجه فيها يقطع عنوانها، فيبقى على المنتصف. */
export function allowsAutoImageFocus(format: string | null | undefined, section?: string | null): boolean {
  return !["infographic", "infographics", "jakalelm"].includes(format ?? "") && section !== "infographics";
}
