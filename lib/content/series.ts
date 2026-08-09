/**
 * السلاسل — الكحلي الرسمي #0E2A52 موحّدًا وفق دليل الهوية (لا طيف ألوان).
 * وحدة مستقلة باستيراد أنواع فقط ليقرأها سكربت الزرع مباشرة عبر Node.
 */

import type { Series } from "./types";

export const SERIES: Series[] = [
  { slug: "absat", name: "أبسط", description: "شرح متدرج للمعقد", color: "#0E2A52" },
  { slug: "aghrab", name: "أغرب", description: "ما لا تتوقعه", color: "#0E2A52" },
  { slug: "efhamha-sah", name: "افهمها صح", description: "الحقيقة ضد الشائعة", color: "#0E2A52" },
  { slug: "bel-arqam", name: "بالأرقام", description: "البيانات تحكي", color: "#0E2A52" },
  { slug: "shakhsiat", name: "شخصيات", description: "سِيَر صنعت أثرًا", color: "#0E2A52" },
  { slug: "limatha", name: "لماذا", description: "الأسباب خلف الظواهر", color: "#0E2A52" },
  { slug: "matha-law", name: "ماذا لو", description: "سيناريوهات واحتمالات", color: "#0E2A52" },
  { slug: "bel-tarikh", name: "بالتاريخ", description: "الزمن يعطي السياق", color: "#0E2A52" },
  { slug: "matha-baad", name: "ماذا بعد", description: "قراءة التداعيات", color: "#0E2A52" },
];
