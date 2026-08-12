export type PrototypeInterest = {
  id: string;
  label: string;
  description: string;
  color: string;
};

export type PrototypeStory = {
  id: string;
  title: string;
  excerpt: string;
  section: string;
  format: "مقال" | "فيديو" | "أرقام" | "شرح سريع";
  minutes: number;
  interestIds: string[];
  image: string;
  reason: string;
};

export const prototypeInterests: PrototypeInterest[] = [
  { id: "science", label: "العلوم", description: "الفضاء والطبيعة والاكتشافات", color: "#14a8d6" },
  { id: "technology", label: "التقنية", description: "الذكاء الاصطناعي والابتكار", color: "#3d7ef7" },
  { id: "health", label: "الصحة", description: "الجسد والنفس وجودة الحياة", color: "#12b5a0" },
  { id: "economy", label: "الاقتصاد", description: "الأسواق والطاقة والأعمال", color: "#eda313" },
  { id: "sport", label: "الرياضة", description: "المنافسات وصناعة الرياضة", color: "#ef476f" },
  { id: "history", label: "التاريخ", description: "قصص صنعت عالمنا", color: "#c08a2e" },
  { id: "people", label: "الشخصيات", description: "أشخاص وأفكار مؤثرة", color: "#8b5cf6" },
  { id: "culture", label: "الثقافة", description: "كتب وفنون ومجتمع", color: "#f26a1b" },
];

export const prototypeStories: PrototypeStory[] = [
  {
    id: "gravity",
    title: "هل تتوقف جاذبية الأرض في 12 أغسطس؟",
    excerpt: "نراجع الادعاء المتداول، ونفصل بين الظاهرة الفلكية والمعلومة المضللة في أربع دقائق.",
    section: "علوم",
    format: "شرح سريع",
    minutes: 4,
    interestIds: ["science", "technology"],
    image: "/prototype/membership/earth.svg",
    reason: "لأنك اخترت العلوم والتقنية، ولأن هذا الشرح رائج اليوم.",
  },
  {
    id: "robotics",
    title: "كيف تغيّر الروبوتات الشبيهة بالبشر شكل العمل؟",
    excerpt: "خمس إشارات تشرح أين وصلت الصناعة، وما الذي يمكن أن يتغير خلال السنوات المقبلة.",
    section: "تقنية",
    format: "أرقام",
    minutes: 6,
    interestIds: ["technology", "economy"],
    image: "/prototype/membership/robotics.svg",
    reason: "يجمع بين اهتمامك بالتقنية والاقتصاد، بصيغة رقمية قصيرة.",
  },
  {
    id: "cats",
    title: "علامات قد تشير إلى إصابة قطتك بالخرف",
    excerpt: "ما الذي يتغير في سلوك القطط مع العمر؟ علامات عملية ومتى تستشير الطبيب البيطري.",
    section: "صحة",
    format: "مقال",
    minutes: 5,
    interestIds: ["health", "science"],
    image: "/prototype/membership/health.svg",
    reason: "لأنك اخترت الصحة والعلوم، ولتنويع موضوعات صفحتك.",
  },
  {
    id: "energy",
    title: "الطاقة المتجددة في المملكة: ماذا تقول الأرقام؟",
    excerpt: "قراءة هادئة في نمو المشروعات، وتأثيرها المتوقع على المدن والاقتصاد.",
    section: "اقتصاد",
    format: "أرقام",
    minutes: 7,
    interestIds: ["economy", "science"],
    image: "/prototype/membership/energy.svg",
    reason: "لأن الاقتصاد من اهتماماتك، والمادة موصى بها تحريريًا.",
  },
  {
    id: "esports",
    title: "كيف صنعت الرياض حدثًا عالميًا للرياضات الإلكترونية؟",
    excerpt: "من بطولة إلى منظومة: قصة النمو والأثر الاقتصادي والحضور الجماهيري.",
    section: "رياضة",
    format: "فيديو",
    minutes: 5,
    interestIds: ["sport", "economy", "technology"],
    image: "/prototype/membership/esports.svg",
    reason: "يلتقي فيه اهتمامك بالرياضة والتقنية، وهو من اختيارات المحررين.",
  },
  {
    id: "guinness",
    title: "كيف تُقاس الأرقام القياسية وتُوثّق؟",
    excerpt: "رحلة الرقم من ادعاء شخصي إلى إنجاز موثق، وما الذي يجعل القياس معتمدًا.",
    section: "ثقافة",
    format: "شرح سريع",
    minutes: 4,
    interestIds: ["culture", "people"],
    image: "/prototype/membership/records.svg",
    reason: "اقتراح استكشافي خارج اهتماماتك المباشرة لتجنب الفقاعة.",
  },
];
