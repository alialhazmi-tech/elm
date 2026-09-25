import { stripHtmlToText } from "../content/html.ts";

/** النصوص التي تصل إلى head لا ينبغي أن تحمل HTML أو فراغات متكررة. */
export function cleanMetadataText(value: unknown): string {
  if (typeof value !== "string") return "";
  return stripHtmlToText(value).replace(/\s+/gu, " ").trim();
}

/** Next's root template supplies the site name; remove only trailing brand suffixes. */
function stripTrailingBrandSuffix(value: string): string {
  return value.replace(/(?:\s*\|\s*العلم)+\s*$/u, "").trim();
}

/**
 * عنوان المحرر يُحترم كما هو بعد تنظيف الفراغات؛ لا نضيف معرّفًا أو طولًا
 * اصطناعيًا كي لا نغيّر المعنى الذي اختاره المحرر.
 */
export function cleanMetadataTitle(value: unknown, fallback = ""): string {
  return stripTrailingBrandSuffix(cleanMetadataText(value)) || stripTrailingBrandSuffix(cleanMetadataText(fallback));
}

/** سياق صفحة الأرشيف يمنع أن تتشارك الصفحات الوصف نفسه. */
export function archiveMetaDescription(description: unknown, page: number): string {
  const base = cleanMetadataText(description);
  return page > 1 && base ? `${base} — الصفحة ${page}` : base;
}

const GENERIC_CONTEXT = /^(?:اقرأ المزيد|المزيد من التفاصيل|تابع التفاصيل|التفاصيل في متن المادة|لا توجد معلومات إضافية)[.!…؟،؛\s]*$/u;

function isUsefulContext(value: string, title: string): boolean {
  if (!value || value === title || GENERIC_CONTEXT.test(value)) return false;
  return value.replace(/[^\p{L}\p{N}]/gu, "").length >= 12;
}

function firstBodyContext(body: unknown): string {
  const text = cleanMetadataText(body);
  if (!text) return "";
  const sentence = text.match(/^.*?(?:[.!؟؛]|…)(?:\s|$)/u)?.[0]?.trim();
  return sentence || text.split(/[\n.!؟؛]+/u)[0]?.trim() || text;
}

function limitGeneratedDescription(value: string, max = 200): string {
  const characters = Array.from(value);
  if (characters.length <= max) return value;
  const clipped = characters.slice(0, max).join("").replace(/\s+\S*$/u, "").trim();
  return `${clipped || characters.slice(0, max).join("").trim()}…`;
}

export type ArticleMetaDescriptionInput = {
  title: string;
  seoDescription?: string | null;
  excerpt?: string | null;
  body?: string | null;
};

/**
 * وصف المادة: override تحريري أولًا، ثم excerpt أو مقدمة المتن. عند غياب
 * override نضمّن العنوان مع السياق حتى لا تتحول نبذة عامة مشتركة إلى وصف
 * متطابق لمواد مختلفة. لا نستخدم المعرّف ولا نفرض طولًا ثابتًا.
 */
export function articleMetaDescription(input: ArticleMetaDescriptionInput): string {
  const title = cleanMetadataTitle(input.title);
  const override = cleanMetadataText(input.seoDescription);
  if (override) return override;

  const excerpt = cleanMetadataText(input.excerpt);
  const body = firstBodyContext(input.body);
  const context = isUsefulContext(excerpt, title)
    ? excerpt
    : isUsefulContext(body, title)
      ? body
      : excerpt || body;

  if (!context || context === title) return limitGeneratedDescription(title);
  if (context.includes(title)) return limitGeneratedDescription(context);
  return limitGeneratedDescription(`${title} — ${context}`);
}
