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
  { slug: "matha-baad", name: "ماذا بعد", description: "قراءة التداعيات", color: "#2eb873" },
];
