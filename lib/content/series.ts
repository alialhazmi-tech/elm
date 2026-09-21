/**
 * السلاسل — طيف «المنشور» — لكل سلسلة لونها، والقيم مطابقة لرموز CSS.
 * الطيف معدني: نفس العائلات اللونية، تشبّع وقيمة متقاربان حتى تجلس
 * جنب الكحلي والزعفران بلا صراخ. وحدة مستقلة باستيراد أنواع فقط.
 */

import type { Series } from "./types";

export const SERIES: Series[] = [
  { slug: "absat", name: "أبسط", description: "شرح متدرج للمعقد", color: "#2d9a8c" },
  { slug: "aghrab", name: "أغرب", description: "ما لا تتوقعه", color: "#c45468" },
  { slug: "efhamha-sah", name: "افهمها صح", description: "الحقيقة ضد الشائعة", color: "#c49a32" },
  { slug: "bel-arqam", name: "بالأرقام", description: "البيانات تحكي", color: "#3d6fad" },
  { slug: "shakhsiat", name: "شخصيات", description: "سِيَر صنعت أثرًا", color: "#6b5a96" },
  { slug: "limatha", name: "لماذا", description: "الأسباب خلف الظواهر", color: "#2e8aa6" },
  { slug: "matha-law", name: "ماذا لو", description: "سيناريوهات واحتمالات", color: "#c05c32" },
  { slug: "matha-baad", name: "ماذا بعد", description: "قراءة التداعيات", color: "#2eb873" },
  { slug: "bel-tarikh", name: "بالتاريخ", description: "الزمن يعطي السياق", color: "#94744a" },
];

/**
 * السلاسل المتقاعدة — أرشيفها حي بقرار المالك (2026-08-11): صفحاتها تعمل
 * وموادها محفوظة، لكنها خارج حزام الاستكشاف، ولها مفتاح إظهار/إخفاء في اللوحة.
 */
export const ARCHIVED_SERIES: Series[] = [
  { slug: "qalu", name: "قالوا", description: "تصريحات وُثقت لحظتها", color: "#7c8aa5", archived: true },
  { slug: "taqarir", name: "تقارير", description: "تقارير موسعة من أرشيف العلم", color: "#6b7f99", archived: true },
  { slug: "muwaththaq", name: "موثق", description: "أفلام وثائقية من إنتاج العلم", color: "#5f7391", archived: true },
  { slug: "elm-mondial", name: "العلم في المونديال", description: "تغطية معرفية لمونديال 2022", color: "#8494ab", archived: true },
];

export const ALL_SERIES: Series[] = [...SERIES, ...ARCHIVED_SERIES];
