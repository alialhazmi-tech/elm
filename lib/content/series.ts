/**
 * السلاسل — طيف «المنشور» — لكل سلسلة لونها، والقيم مطابقة لرموز CSS.
 * وحدة مستقلة باستيراد أنواع فقط ليقرأها سكربت الزرع مباشرة عبر Node.
 */

import type { Series } from "./types";

export const SERIES: Series[] = [
  { slug: "absat", name: "أبسط", description: "شرح متدرج للمعقد", color: "#12b5a0" },
  { slug: "aghrab", name: "أغرب", description: "ما لا تتوقعه", color: "#ef476f" },
  { slug: "efhamha-sah", name: "افهمها صح", description: "الحقيقة ضد الشائعة", color: "#eda313" },
  { slug: "bel-arqam", name: "بالأرقام", description: "البيانات تحكي", color: "#3d7ef7" },
  { slug: "shakhsiat", name: "شخصيات", description: "سِيَر صنعت أثرًا", color: "#8b5cf6" },
  { slug: "limatha", name: "لماذا", description: "الأسباب خلف الظواهر", color: "#14a8d6" },
  { slug: "matha-law", name: "ماذا لو", description: "سيناريوهات واحتمالات", color: "#f26a1b" },
  { slug: "bel-tarikh", name: "بالتاريخ", description: "الزمن يعطي السياق", color: "#c08a2e" },
];

/**
 * السلاسل المتقاعدة — أرشيفها حي بقرار المالك (2026-08-11): صفحاتها تعمل
 * وموادها محفوظة، لكنها خارج حزام الاستكشاف، ولها مفتاح إظهار/إخفاء في اللوحة.
 */
export const ARCHIVED_SERIES: Series[] = [
  { slug: "qalu", name: "قالوا", description: "تصريحات وُثقت لحظتها", color: "#7c8aa5", archived: true },
  { slug: "taqarir", name: "تقارير", description: "تقارير موسعة من أرشيف العلم", color: "#6b7f99", archived: true },
  { slug: "muwaththaq", name: "موثق", description: "أفلام وثائقية من إنتاج العلم", color: "#5f7391", archived: true },
  { slug: "matha-baad", name: "ماذا بعد", description: "قراءة التداعيات", color: "#2eb873", archived: true },
  { slug: "elm-mondial", name: "العلم في المونديال", description: "تغطية معرفية لمونديال 2022", color: "#8494ab", archived: true },
];

export const ALL_SERIES: Series[] = [...SERIES, ...ARCHIVED_SERIES];
