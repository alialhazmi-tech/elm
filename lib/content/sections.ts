/**
 * نظام الأقسام والتصنيفات في منصة العلم.
 * يحدد الأقسام الموضوعية المعتمدة، أوصافها للـ SEO، وأولوياتها في شريط التنقل.
 */

export type SectionDefinition = {
  slug: string;
  name: string;
  shortName?: string;
  description: string;
  seoDescription: string;
  color?: string;
  /** أولوية الظهور في شريط التنقل الرئيسي: 1 = رئيسي، 2 = ثانوي في القائمة، 3 = أرشيف/تنسيقي */
  navPriority: 1 | 2 | 3;
};

export const SECTIONS: SectionDefinition[] = [
  {
    slug: "politics",
    name: "سياسة وسياق",
    shortName: "سياسة",
    description: "تغطية الشأن السياسي والتحولات والقرارات المحلية والدولية.",
    seoDescription: "أحدث التحليلات والتغطيات المعرفية للشأن السياسي المحلي والدولي عبر منصة العلم.",
    color: "#2f7d66",
    navPriority: 1,
  },
  {
    slug: "economy",
    name: "اقتصاد واستثمار",
    shortName: "اقتصاد",
    description: "أسواق، طاقة، مشروعات كبرى، وفرص الاستثمار في ضوء رؤية 2030.",
    seoDescription: "قراءة اقتصادية متخصصة في الأسواق والطاقة والاستثمار المحلي والدولي.",
    color: "#d99a18",
    navPriority: 1,
  },
  {
    slug: "technology",
    name: "تقنية وذكاء اصطناعي",
    shortName: "تقنية",
    description: "التحول الرقمي، الذكاء الاصطناعي، الأمن السيبراني، وابتكارات المستقبل.",
    seoDescription: "تغطية التطورات التقنية والذكاء الاصطناعي والتحول الرقمي والأمن السيبراني.",
    color: "#3d6fad",
    navPriority: 1,
  },
  {
    slug: "sciences",
    name: "علوم ومعرفة",
    shortName: "علوم",
    description: "اكتشافات الفضاء، البيئة، الطبيعة، والأبحاث العلمية المتقدمة.",
    seoDescription: "استكشاف أحدث الاكتشافات العلمية والفلكية والبيئية بلغة بسيطة وموثقة.",
    color: "#2e8aa6",
    navPriority: 1,
  },
  {
    slug: "health",
    name: "صحة وجودة حياة",
    shortName: "صحة",
    description: "الطب الوقائي، الصحة العامة، التغذية، وأسلوب الحياة المتوازن.",
    seoDescription: "دليلك المعرفي الموثوق للصحة العامة والطب الحديث وجودة الحياة.",
    color: "#12a88f",
    navPriority: 1,
  },
  {
    slug: "sport",
    name: "رياضة وصناعة",
    shortName: "رياضة",
    description: "الرياضة السعودية، المنافسات الكبرى، واستثمارات الرياضة العالمية.",
    seoDescription: "تغطية وتحليل الشأن الرياضي وصناعة الرياضة في المملكة والعالم.",
    color: "#c45468",
    navPriority: 1,
  },
  {
    slug: "culture",
    name: "ثقافة وفكر",
    shortName: "ثقافة",
    description: "الفنون، الأدب، التراث الوطني، والسير والشخصيات الملهمة.",
    seoDescription: "فضاء للثقافة والفنون والتراث الإنساني والسير التاريخية والفكرية.",
    color: "#e56b2f",
    navPriority: 2,
  },
  {
    slug: "world",
    name: "عالم وجيوسياسة",
    shortName: "عالم",
    description: "قراءة متزنة للتحولات الدولية والسياسة العالمية وسلاسل الإمداد.",
    seoDescription: "تحليلات الشأن الجيوسياسي والدولي بتوازن وموضوعية.",
    color: "#526da8",
    navPriority: 2,
  },
  {
    slug: "business",
    name: "أعمال وريادة",
    shortName: "أعمال",
    description: "الشركات الناشئة، نماذج الأعمال، والقيادة المؤسسية.",
    seoDescription: "رؤى في ريادة الأعمال وإدارة الشركات والابتكار المؤسسي.",
    color: "#6b5a96",
    navPriority: 2,
  },
  {
    slug: "varieties",
    name: "منوعات وظواهر",
    shortName: "منوعات",
    description: "قصص خفيفة، ظواهر مجتمعية، ومعارف عامة تلهم الفضول.",
    seoDescription: "منوعات وقصص من العالم ترضي فضول المعرفة وتثري القارئ.",
    color: "#9b5e8f",
    navPriority: 2,
  },
  {
    slug: "current-events",
    name: "أحداث جارية",
    shortName: "أحداث",
    description: "متابعة سريعة للأحداث الجارية والتطورات المستجدة.",
    seoDescription: "تغطية الأحداث الجارية وسياقها الزمني والموضوعي.",
    color: "#6b7f99",
    navPriority: 3,
  },
  {
    slug: "ksa",
    name: "السعودية",
    shortName: "السعودية",
    description: "نبض المملكة والمشروعات الوطنية الكبرى.",
    seoDescription: "أخبار ومشروعات ومبادرات المملكة العربية السعودية.",
    color: "#2f7d66",
    navPriority: 3,
  },
  {
    slug: "art",
    name: "فنون وإبداع",
    shortName: "فن",
    description: "الفنون البصرية، التصميم، المعارض، والتجارب الإبداعية.",
    seoDescription: "إضاءات على الفنون والتصميم والإبداع البصري.",
    color: "#94744a",
    navPriority: 3,
  },
  {
    slug: "infographics",
    name: "إنفوجرافيك وبيانات",
    shortName: "إنفوجرافيك",
    description: "تبسيط البيانات والأرقام المعقدة في رسوم تفاعلية أنيقة.",
    seoDescription: "إنفوجرافيك ورسوم بيانية تفاعلية تلخص المعرفة في أرقام وصور.",
    color: "#3d6fad",
    navPriority: 2,
  },
  {
    slug: "videos",
    name: "مرئي ووثائقي",
    shortName: "مرئي",
    description: "فيديوهات معرفية، شروحات قصيرة، وتغطيات بصرية.",
    seoDescription: "محتوى مرئي عالي الجودة يقدم المعرفة بسلاسة وإيجاز.",
    color: "#c45468",
    navPriority: 2,
  },
];

export const SECTIONS_MAP = new Map<string, SectionDefinition>(
  SECTIONS.map((sec) => [sec.slug, sec])
);

/** قاموس أسماء الأقسام للتوافق السريع */
export const SECTION_NAMES: Record<string, string> = Object.fromEntries(
  SECTIONS.map((sec) => [sec.slug, sec.shortName || sec.name])
);

/** الأقسام الرئيسية للظهور في شريط الهيدر */
export const PRIMARY_NAV_SECTIONS = SECTIONS.filter((s) => s.navPriority === 1);

/** الأقسام الثانوية لقائمة «المزيد» والفوتر */
export const SECONDARY_NAV_SECTIONS = SECTIONS.filter((s) => s.navPriority === 2);

/** جلب بيانات قسم بالمعرف */
export function getSection(slug: string): SectionDefinition | undefined {
  return SECTIONS_MAP.get(slug);
}

/** جلب الاسم العربي للقسم مع السقوط الآمن */
export function getSectionName(slug: string): string {
  return SECTIONS_MAP.get(slug)?.shortName || SECTIONS_MAP.get(slug)?.name || SECTION_NAMES[slug] || slug;
}

/** جلب وصف القسم للـ SEO */
export function getSectionDescription(slug: string): string {
  return (
    SECTIONS_MAP.get(slug)?.seoDescription ||
    SECTIONS_MAP.get(slug)?.description ||
    `أحدث مواد قسم ${getSectionName(slug)} في العلم.`
  );
}
