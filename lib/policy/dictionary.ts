/**
 * قواميس السياسة التحريرية — كل مدخل مشتق حرفيًا من docs/editorial-policy.md.
 * لا تُضاف مفردة هنا دون بند مقابل في الوثيقة واختبار في tests/policy-guard.test.mjs
 */

/** بند 1 — المقامان الرسميان. */
export const KING_FORBIDDEN_TERMS = ["العاهل السعودي", "عاهل السعودية"] as const;

export const CROWN_PRINCE_FORBIDDEN_TERMS = [
  "ولي العهد السعودي",
  "مبس",
  "MBS",
] as const;

export const KING_FULL_NAME = "خادم الحرمين الشريفين الملك سلمان بن عبدالعزيز آل سعود";
export const KING_SHORT_NAMES = ["الملك سلمان", "خادم الحرمين الشريفين"] as const;

export const CROWN_PRINCE_FULL_NAME = "الأمير محمد بن سلمان بن عبدالعزيز آل سعود";
export const CROWN_PRINCE_SHORT_NAMES = ["الأمير محمد بن سلمان", "ولي العهد"] as const;

export const DEFENCE_PORTFOLIO = "وزير الدفاع";

/** بند 2 — اسم الدولة ومؤسساتها. */
export const STATE_FORBIDDEN_NAMES = ["المملكة السعودية", "الجزيرة العربية"] as const;

/**
 * «وزير الخارجية السعودي» و«وزارة الطاقة السعودية» — صياغة غير محلية.
 * الأنماط تعمل على النص بعد التطبيع (ة ← ه)، ولا تستخدم \b لأنها لا تنطبق على الحروف العربية.
 */
export const NON_LOCAL_MINISTER_PATTERN = /(?:وزير|وزيره)\s+(?:\S+\s+){0,3}?السعودي(?!\p{L})/u;
export const NON_LOCAL_MINISTRY_PATTERN = /وزاره\s+(?:\S+\s+){0,3}?السعوديه(?!\p{L})/u;

/** بند 3 — صفات المسؤولين. */
export const FORBIDDEN_HONORIFICS = ["سعادة", "معالي", "بيه", "البيه"] as const;
export const SOFT_HONORIFICS = ["سمو", "فخامة", "دولة رئيس"] as const;

export const ACADEMIC_TITLES: ReadonlyArray<{ term: string; short: string }> = [
  { term: "أستاذ دكتور", short: "أ.د." },
  { term: "الأستاذ الدكتور", short: "أ.د." },
  { term: "دكتور", short: "د." },
  { term: "الدكتور", short: "د." },
  { term: "مهندس", short: "م." },
  { term: "المهندس", short: "م." },
];

/** بند 4 — محاذير الموضوعات. */
export const ISRAEL_TERMS = ["إسرائيل", "اسرائيل", "إسرائيلي", "تل أبيب", "الإسرائيلية"] as const;
export const NATIONALIST_OCCASIONS = [
  "اليوم الوطني الكويتي",
  "حرب أكتوبر",
  "ثورة يوليو",
  "الثورة الإسلامية",
] as const;

/** بند 5 — العناوين. */
export const HEADLINE_MAX_WORDS = 10;

export const CLICKBAIT_TERMS = [
  "حقائق صادمة",
  "حقيقة صادمة",
  "سر خطير",
  "لن تصدق",
  "لأول مرة في التاريخ",
  "صادم",
] as const;

/** مبالغة محتملة تحتمل الاستخدام المشروع في المواد المعرفية — تحذير لا منع. */
export const CLICKBAIT_SOFT_TERMS = ["أسرار", "مذهل", "لا يصدق"] as const;

export const KNOW_DERIVATIVES = ["اعرف أكثر", "تعرف على", "تعرّف على", "اعرف"] as const;

export const VIOLENCE_TERMS = ["جريمة", "ذبح", "مذبحة", "نحر", "تقطيع أوصال"] as const;

/** بند 6 — المتن. */
export const BODY_MIN_WORDS = 300;
export const BODY_MAX_WORDS = 2000;

/** بند 7 — التنسيق. */
export const UNIT_ABBREVIATIONS: ReadonlyArray<{ term: string; short: string }> = [
  { term: "كيلومترات", short: "كلم" },
  { term: "كيلومتر", short: "كلم" },
  { term: "كيلوغرامات", short: "كلغم" },
  { term: "كيلوغرام", short: "كلغم" },
  { term: "ملليمترات", short: "ملم" },
  { term: "ملليمتر", short: "ملم" },
];

export const PLATFORM_NAMES: ReadonlyArray<{ term: string; latin: string }> = [
  { term: "فيسبوك", latin: "Facebook" },
  { term: "فيس بوك", latin: "Facebook" },
  { term: "تويتر", latin: "X" },
  { term: "إنستغرام", latin: "Instagram" },
  { term: "انستغرام", latin: "Instagram" },
  { term: "سناب شات", latin: "Snapchat" },
  { term: "لينكدإن", latin: "LinkedIn" },
  { term: "يوتيوب", latin: "YouTube" },
  { term: "تيك توك", latin: "TikTok" },
];

/** بند 8 — المصادر المعتمدة. */
export const OFFICIAL_LOCAL_HOSTS = [
  "spa.gov.sa",
  "my.gov.sa",
  "stats.gov.sa",
  "alekhbariya.net",
  "alarabiya.net",
  "sabq.org",
  "okaz.com.sa",
  "rotana.net",
  "mbc.net",
  "gccstat.org",
] as const;

export const APPROVED_KNOWLEDGE_HOSTS = [
  "un.org",
  "worldbank.org",
  "weforum.org",
  "unesco.org",
  "unicef.org",
  "bloomberg.com",
  "forbes.com",
  "hbr.org",
  "visualcapitalist.com",
  "vividmaps.com",
  "listverse.com",
  "psychologytoday.com",
  "verywellmind.com",
  "ourworldindata.org",
  "statista.com",
] as const;

export const APPROVED_WIRE_HOSTS = [
  "bbc.com",
  "bbc.co.uk",
  "reuters.com",
  "afp.com",
  "cnn.com",
  "cnbc.com",
] as const;

/** بند 9 — العاجل. */
export const BREAKING_DAILY_LIMIT = 5;
export const BREAKING_SOURCE_HOSTS = ["spa.gov.sa", "alekhbariya.net", "alarabiya.net"] as const;

/** بند 10 — الإنفوجرافيك والفيديوجرافيك. */
export const INFOGRAPHIC_LIMITS = {
  introMaxWords: 12,
  pointMaxWords: 8,
  minPoints: 6,
  maxPoints: 8,
} as const;

export const VIDEOGRAPHIC_LIMITS = {
  minScenes: 6,
  maxScenes: 11,
  sceneMinWords: 8,
  sceneMaxWords: 10,
} as const;

/** بند 11 — النص المصاحب. */
export const SOCIAL_LIMITS = {
  twitter: { maxWords: 20, maxHashtags: 0 },
  facebook: { maxWords: 10, maxHashtags: 2 },
  instagram: { maxWords: 10, maxHashtags: 6 },
} as const;

/** بند 12 — أعلام الوسائط التي يرفعها فحص الرؤية أو المحرر. */
export const BLOCKING_MEDIA_FLAGS = [
  "gore",
  "competitor-logo",
  "zionist-flag",
  "religious-values",
] as const;

export const WARNING_MEDIA_FLAGS = ["personal-handle", "social-watermark"] as const;
