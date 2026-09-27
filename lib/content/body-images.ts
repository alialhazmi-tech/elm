/**
 * صور المتن في صفحة المادة: مقاسات مُصغّرة من مسار التحويل بدل الأصل (حتى 8MB)،
 * ورابط إلى الأصل ليُكبَّر الإنفوجرافيك ويُقرأ نصه. المدخل HTML منقّى — المصدر فيه
 * مطابق لـ BODY_IMAGE_SRC سلفًا، فلا نمرر هنا إلا ما صنعه المنقّي.
 */

import { imageVariantUrl } from "../image-source.ts";

const BODY_WIDTHS = [640, 1080, 1600];
const SIZES = "(max-width: 760px) calc(100vw - 32px), 720px";
const IMG = /<img src="(\/uploads\/[0-9a-f-]{36}\.(?:png|jpg|webp))"([^>]*)>/gi;

const attr = (value: string) => value.replace(/&/g, "&amp;");

export function responsiveBodyImages(html: string): string {
  return html.replace(IMG, (_match, src: string, rest: string) => {
    const srcset = BODY_WIDTHS.map((width) => `${attr(imageVariantUrl(src, width))} ${width}w`).join(", ");
    const image = `<img src="${attr(imageVariantUrl(src, 1080))}" srcset="${srcset}" sizes="${SIZES}"${rest}>`;
    // الرابط يأخذ اسمه من النص البديل؛ الصورة بلا وصف تحتاج اسمًا صريحًا للقارئ الصوتي.
    const label = /\salt=""/.test(rest) ? ' aria-label="فتح الصورة بدقتها الكاملة"' : "";
    return `<a class="article-figure-link" href="${src}" target="_blank" rel="noopener" title="فتح الصورة بدقتها الكاملة"${label}>${image}</a>`;
  });
}
