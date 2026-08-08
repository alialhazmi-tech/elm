import type { ContentProvider, Series, Story } from "./types";

const series: Series[] = [
  { slug: "absat", name: "أبسط", description: "شرح متدرج للمفاهيم المعقدة", color: "#1f8f75" },
  { slug: "aghrab", name: "أغرب", description: "ما لا نتوقعه في العالم", color: "#d64b65" },
  { slug: "efhamha-sah", name: "افهمها صح", description: "فصل الحقيقة عن الشائعة", color: "#f2ae30" },
  { slug: "bel-arqam", name: "بالأرقام", description: "البيانات تحكي القصة", color: "#3f7dd7" },
  { slug: "shakhsiat", name: "شخصيات", description: "سِيَر صنعت أثرًا", color: "#725bb5" },
  { slug: "limatha", name: "لماذا", description: "تفكيك الأسباب خلف الظواهر", color: "#137c8b" },
  { slug: "matha-law", name: "ماذا لو", description: "سيناريوهات واحتمالات", color: "#b65c33" },
  { slug: "bel-tarikh", name: "بالتاريخ", description: "الزمن يضع الخبر في سياقه", color: "#8b6b43" },
  { slug: "matha-baad", name: "ماذا بعد", description: "قراءة التداعيات المقبلة", color: "#27718e" },
];

const stories: Record<string, Story> = {
  memory: {
    id: "10421",
    slug: "digital-memory-for-cities",
    section: "knowledge",
    title: "لماذا نحتاج إلى ذاكرة رقمية للمدن؟",
    excerpt: "من الخرائط القديمة إلى الحساسات الحديثة: كيف نحفظ قصة المكان ونستخدمها لاتخاذ قرار أفضل؟",
    eyebrow: "وراء الخبر اليوم",
    readingMinutes: 7,
    series: "limatha",
  },
  ocean: {
    id: "10418",
    slug: "ocean-sounds",
    section: "science",
    title: "كيف يستمع العلماء إلى المحيط؟",
    excerpt: "رحلة مبسطة داخل شبكة الأصوات التي تكشف ما لا تراه الأقمار الصناعية.",
    eyebrow: "أبسط",
    readingMinutes: 5,
    series: "absat",
  },
  data: {
    id: "10413",
    slug: "data-shapes-our-cities",
    section: "data",
    title: "خمسة أرقام تعيد رسم مدننا",
    excerpt: "بطاقات بيانات تضع التحولات الحضرية في سياق واضح وقابل للمقارنة.",
    eyebrow: "بالأرقام",
    readingMinutes: 4,
    series: "bel-arqam",
  },
  satellite: {
    id: "10409",
    slug: "satellite-orbits-explained",
    section: "video",
    title: "مدارات الأقمار: دقيقة واحدة لفهم الصورة",
    excerpt: "فيديو معرفي قصير يشرح لماذا لا تسلك كل الأقمار المسار نفسه.",
    eyebrow: "فيديو",
    readingMinutes: 3,
  },
  archive: {
    id: "10405",
    slug: "the-living-archive",
    section: "podcast",
    title: "الأرشيف الحي: حين تتكلم الوثيقة",
    excerpt: "حلقة صوتية عن تحويل التاريخ من رفوف مغلقة إلى تجربة عامة قابلة للاكتشاف.",
    eyebrow: "بودكاست",
    readingMinutes: 18,
  },
  climate: {
    id: "10398",
    slug: "reading-climate-maps",
    section: "infographic",
    title: "كيف نقرأ خريطة المناخ؟",
    excerpt: "دليل بصري يشرح الألوان والطبقات قبل أن تقودنا الخريطة إلى استنتاج خاطئ.",
    eyebrow: "إنفوجرافيك",
    readingMinutes: 6,
    series: "efhamha-sah",
  },
  future: {
    id: "10391",
    slug: "what-comes-after-smart-roads",
    section: "knowledge",
    title: "ماذا بعد الطرق الذكية؟",
    excerpt: "ثلاثة آثار محتملة على التنقل والاقتصاد وتصميم الحي.",
    eyebrow: "ماذا بعد",
    readingMinutes: 6,
    series: "matha-baad",
  },
};

export const mockContentProvider: ContentProvider = {
  async getHomeCandidates() {
    return {
      hero: stories.memory,
      series,
      sections: [
        {
          key: "behindNews",
          title: "وراء الخبر",
          kicker: "السياق قبل السرعة",
          stories: [stories.memory, stories.ocean, stories.data, stories.future],
        },
        {
          key: "video",
          title: "شاهد الفكرة",
          kicker: "معرفة مرئية",
          stories: [stories.ocean, stories.satellite, stories.data],
        },
        {
          key: "podcast",
          title: "اسمع الحكاية",
          kicker: "صوت العلم",
          stories: [stories.archive, stories.future],
        },
        {
          key: "infographic",
          title: "الصورة الكاملة",
          kicker: "بيانات ورسوم",
          stories: [stories.data, stories.climate],
        },
      ],
    };
  },
};
