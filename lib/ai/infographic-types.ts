/**
 * مخطط وأنواع «الإنفوجرافيك التفاعلي» — المعنى والهيكل والحركة.
 */

export const INFOGRAPHIC_THEMES = [
  "ocean-cyber",
  "desert-gold",
  "cyber-emerald",
  "midnight-tech",
  "royal-sapphire",
  "crimson-energy",
] as const;

export type InfographicThemeId = (typeof INFOGRAPHIC_THEMES)[number];

export interface ThemeConfig {
  id: InfographicThemeId;
  name: string;
  category: string;
  bgGradient: string;
  cardBg: string;
  cardBorder: string;
  glowColor: string;
  accentColor: string;
  textColor: string;
  subtextColor: string;
  particleType: "bubbles" | "dust" | "stars" | "grid";
}

export const THEME_CONFIGS: Record<InfographicThemeId, ThemeConfig> = {
  "ocean-cyber": {
    id: "ocean-cyber",
    name: "المدّ الأزرق المحيطي",
    category: "البحار، الموانئ، والموارد المائية",
    bgGradient: "linear-gradient(180deg, #021224 0%, #03213a 25%, #02182c 50%, #010d18 80%, #032338 100%)",
    cardBg: "rgba(3, 33, 58, 0.45)",
    cardBorder: "rgba(6, 182, 212, 0.25)",
    glowColor: "rgba(6, 182, 212, 0.4)",
    accentColor: "#22d3ee",
    textColor: "#f0fdfa",
    subtextColor: "#94a3b8",
    particleType: "bubbles",
  },
  "desert-gold": {
    id: "desert-gold",
    name: "الذهب والرمال الملكية",
    category: "الاقتصاد الوطني، التعدين، ورؤية 2030",
    bgGradient: "linear-gradient(180deg, #181106 0%, #2b1d09 25%, #1f1406 50%, #100a03 80%, #291b08 100%)",
    cardBg: "rgba(43, 29, 9, 0.45)",
    cardBorder: "rgba(245, 185, 46, 0.25)",
    glowColor: "rgba(245, 185, 46, 0.4)",
    accentColor: "#f5b92e",
    textColor: "#fffbeb",
    subtextColor: "#d1c4aa",
    particleType: "dust",
  },
  "cyber-emerald": {
    id: "cyber-emerald",
    name: "الزمرد والأخضر المستدام",
    category: "السعودية الخضراء، الطاقة المتجددة، والبيئة",
    bgGradient: "linear-gradient(180deg, #03170e 0%, #072a1a 25%, #051d12 50%, #020d08 80%, #082d1c 100%)",
    cardBg: "rgba(7, 42, 26, 0.45)",
    cardBorder: "rgba(52, 211, 153, 0.25)",
    glowColor: "rgba(52, 211, 153, 0.4)",
    accentColor: "#34d399",
    textColor: "#f0fdf4",
    subtextColor: "#9ca3af",
    particleType: "dust",
  },
  "midnight-tech": {
    id: "midnight-tech",
    name: "التقنية والذكاء الاصطناعي",
    category: "الحوسبة، الذكاء الاصطناعي، والأمن السيبراني",
    bgGradient: "linear-gradient(180deg, #0d091f 0%, #1b1240 25%, #130d2e 50%, #080514 80%, #1c1343 100%)",
    cardBg: "rgba(27, 18, 64, 0.45)",
    cardBorder: "rgba(168, 85, 247, 0.25)",
    glowColor: "rgba(168, 85, 247, 0.4)",
    accentColor: "#a855f7",
    textColor: "#faf5ff",
    subtextColor: "#a1a1aa",
    particleType: "grid",
  },
  "royal-sapphire": {
    id: "royal-sapphire",
    name: "الياقوت الأزرق الاستراتيجي",
    category: "الشؤون الإدارية، التحول المؤسسي، والصناعة",
    bgGradient: "linear-gradient(180deg, #091326 0%, #112347 25%, #0d1a36 50%, #050b18 80%, #132750 100%)",
    cardBg: "rgba(17, 35, 71, 0.45)",
    cardBorder: "rgba(96, 165, 250, 0.25)",
    glowColor: "rgba(96, 165, 250, 0.4)",
    accentColor: "#60a5fa",
    textColor: "#eff6ff",
    subtextColor: "#94a3b8",
    particleType: "stars",
  },
  "crimson-energy": {
    id: "crimson-energy",
    name: "الطاقة والابتكار القرمزي",
    category: "النفط والغاز، البتروكيماويات، واللوجستيات",
    bgGradient: "linear-gradient(180deg, #1f0a0a 0%, #3a1212 25%, #290d0d 50%, #140505 80%, #381212 100%)",
    cardBg: "rgba(58, 18, 18, 0.45)",
    cardBorder: "rgba(248, 113, 113, 0.25)",
    glowColor: "rgba(248, 113, 113, 0.4)",
    accentColor: "#f87171",
    textColor: "#fef2f2",
    subtextColor: "#cbd5e1",
    particleType: "dust",
  },
};

/** مؤشر إحصائي رقمي قابل للحركة والتفاعل */
export interface InfographicStat {
  id: string;
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  sublabel?: string;
  trend?: string; // e.g. "+19%" or "نمو قياسي"
  isPositive?: boolean;
}

/** عنصر عائم ثلاثي الأبعاد معزول بتفاصيل تفاعلية */
export interface InfographicShowcaseItem {
  id: string;
  name: string;
  category: string;
  statValue: number;
  statSuffix: string;
  description: string;
  imageUrl?: string;
  imagePrompt: string;
  floatSpeedSeconds?: number;
  tags?: string[];
}

/** بطاقة عمليات أو بنية تحتية شبكية */
export interface InfographicOperationBlock {
  id: string;
  title: string;
  value: string;
  label: string;
  description?: string;
  badge?: string;
}

/** مستهدف رؤية أو مقارنة زمنية */
export interface InfographicVisionTarget {
  id: string;
  label: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  growthMultiplier?: string; // e.g. "4 أضعاف" أو "+400%"
}

/** المخطط الشامل للإنفوجرافيك التفاعلي */
export interface InfographicData {
  id: string;
  title: string;
  eyebrow: string; // e.g. "رؤية المملكة 2030 · الثروة السمكية"
  kicker: string;
  subtitle: string;
  introText: string;
  themeId: InfographicThemeId;
  
  // المشهد الافتتاحي والبانوراما
  hero: {
    badge: string;
    mapHighlight?: string;
    bgPrompt: string;
    bgImageUrl?: string;
  };

  // القسم الأول: صيد وحصاد وفير (Macro Stats)
  macroSection: {
    title: string;
    stats: InfographicStat[];
    bannerImageUrl?: string;
    bannerPrompt?: string;
  };

  // القسم الثاني: التنوع والكائنات الحية (Showcase / 3D Floating Assets)
  showcaseSection: {
    title: string;
    subtitle: string;
    items: InfographicShowcaseItem[];
  };

  // القسم الثالث: العمليات والبنية التحتية (Grid Operations)
  operationsSection: {
    title: string;
    subtitle?: string;
    blocks: InfographicOperationBlock[];
  };

  // القسم الرابع: الأثر الاقتصادي والاستثماري
  impactSection: {
    title: string;
    metrics: InfographicStat[];
    footerNote?: string;
  };

  // القسم الخامس: مستهدفات الرؤية 2030 (Future Vision)
  visionSection: {
    title: string;
    targetYear: number;
    subtitle: string;
    targets: InfographicVisionTarget[];
    closingStatement: string;
  };

  sourceContext?: string;
  generatedAt: string;
}
