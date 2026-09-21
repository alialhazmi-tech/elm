export type MemberInterest = {
  id: string;
  label: string;
  description: string;
  color: string;
  contentKeys: string[];
  position: number;
};

export const MEMBER_INTERESTS: MemberInterest[] = [
  { id: "saudi", label: "السعودية", description: "المجتمع والتحولات والمشروعات", color: "#2f7d66", contentKeys: ["politics", "محليات", "السعودية", "المملكة"], position: 1 },
  { id: "world", label: "العالم", description: "سياسة دولية وتحولات عالمية", color: "#526da8", contentKeys: ["current-events", "العالم", "دولي"], position: 2 },
  { id: "economy", label: "الاقتصاد", description: "أسواق وطاقة واستثمار وعقار", color: "#d99a18", contentKeys: ["economy", "اقتصاد", "استثمار", "طاقة", "أسواق"], position: 3 },
  { id: "technology", label: "التقنية", description: "أجهزة وتطبيقات وأمن سيبراني", color: "#3d7ef7", contentKeys: ["technology", "تقنية", "رقمي", "أمن سيبراني"], position: 4 },
  { id: "ai", label: "الذكاء الاصطناعي", description: "النماذج والتطبيقات ومستقبل العمل", color: "#7057d9", contentKeys: ["ذكاء اصطناعي", "الذكاء الاصطناعي", "روبوت", "خوارزم"], position: 5 },
  { id: "health", label: "الصحة", description: "الجسد والنفس وجودة الحياة", color: "#12a88f", contentKeys: ["health", "صحة", "طبي", "نفسي"], position: 6 },
  { id: "science", label: "العلوم", description: "الفضاء والطبيعة والاكتشافات", color: "#14a8d6", contentKeys: ["science", "علوم", "فضاء", "اكتشاف"], position: 7 },
  { id: "culture", label: "الثقافة", description: "كتب وفنون وأفكار ومجتمع", color: "#e56b2f", contentKeys: ["culture", "ثقافة", "كتاب", "فن"], position: 8 },
  { id: "society", label: "المجتمع", description: "حياة الناس والظواهر الاجتماعية", color: "#9b5e8f", contentKeys: ["society", "مجتمع", "اجتماعي"], position: 9 },
  { id: "environment", label: "البيئة", description: "مناخ واستدامة وطبيعة", color: "#4b9866", contentKeys: ["environment", "بيئة", "مناخ", "استدامة"], position: 10 },
  { id: "travel", label: "السفر", description: "وجهات وتجارب ومدن", color: "#20899a", contentKeys: ["travel", "سفر", "سياحة", "وجهة"], position: 11 },
  { id: "sport", label: "الرياضة", description: "منافسات وأندية وصناعة الرياضة", color: "#ef476f", contentKeys: ["sport", "رياضة", "نادي", "دوري"], position: 12 },
];

export const MEMBER_INTEREST_IDS = new Set(MEMBER_INTERESTS.map((interest) => interest.id));
