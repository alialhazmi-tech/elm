/**
 * أنواع حارس السياسة التحريرية.
 * المصدر الملزم: docs/editorial-policy.md
 */

export type Severity = "blocking" | "warning" | "suggestion";

export type RuleCategory =
  | "royal"
  | "state"
  | "officials"
  | "restricted"
  | "headline"
  | "body"
  | "formatting"
  | "sources"
  | "breaking"
  | "graphics"
  | "social"
  | "media"
  | "advertising";

export type SocialPlatform = "twitter" | "facebook" | "instagram";

/** النصوص الخبرية تلزم بالاسم الكامل؛ التصاميم والفيديو يسمح فيها الاختصار. */
export type DraftSurface = "text" | "design";

export interface SocialCaption {
  platform: SocialPlatform;
  text: string;
  hashtags?: string[];
}

export interface MediaAsset {
  id?: string;
  url?: string;
  /** حقوق الملكية موثقة في مكتبة الوسائط. */
  rightsCleared?: boolean;
  credit?: string;
  /** أعلام يرفعها فحص الرؤية أو المحرر: gore | competitor-logo | zionist-flag | personal-handle | religious-values */
  flags?: string[];
  /** اسم الشخصية المرتبطة بالصورة، لتأكيد التطابق بشريًا. */
  personName?: string;
}

export interface InfographicDraft {
  intro?: string;
  points: string[];
}

export interface VideographicDraft {
  intro?: string;
  scenes: string[];
  outro?: string;
}

export interface Draft {
  id?: string;
  title?: string;
  body?: string;
  series?: string;
  sourceUrls?: string[];
  surface?: DraftSurface;
  /** مادة موسومة «إعلان مدفوع» — يرفع حظر صفات المسؤولين وفق الوثيقة. */
  paidPromotion?: boolean;
  breaking?: boolean;
  infographic?: InfographicDraft;
  videographic?: VideographicDraft;
  social?: SocialCaption[];
  media?: MediaAsset[];
}

export interface GuardContext {
  /** عدد المواد المصنفة «عاجل» اليوم قبل هذه المادة. */
  breakingCountToday?: number;
  /** السقف اليومي المضبوط لتصنيف «عاجل». */
  breakingDailyLimit?: number;
  /** معرف المستخدم الذي طلب الفحص — يُحفظ في سجل التدقيق. */
  actorId?: string;
}

export interface AutoFix {
  field: string;
  from: string;
  to: string;
}

export interface Finding {
  ruleId: string;
  category: RuleCategory;
  severity: Severity;
  /** الحقل المخالف: title | body | infographic.points[2] | social[0].text ... */
  field: string;
  /** رسالة عربية تشرح المخالفة وكيف تُعالج. */
  message: string;
  /** مرجع البند في docs/editorial-policy.md */
  policyRef: string;
  excerpt?: string;
  index?: number;
  autofix?: AutoFix;
  /** المخالفة تحتاج حكمًا بشريًا (أو نموذجًا لاحقًا) ولا يحسمها الفحص الحتمي. */
  needsHumanReview?: boolean;
  /** نوع دقيق يسمح بإدارة بوابة مستقلة دون تعطيل بقية قاعدة الوسائط. */
  kind?: "image-rights";
}

export interface Rule {
  id: string;
  category: RuleCategory;
  severity: Severity;
  policyRef: string;
  title: string;
  run(draft: Draft, context: GuardContext): Finding[];
}

export interface GuardReport {
  /** لا مخالفات قاطعة. */
  ok: boolean;
  /** يجوز إرسال المادة إلى الاعتماد. */
  canRequestApproval: boolean;
  findings: Finding[];
  counts: Record<Severity, number>;
  rulesEvaluated: number;
  /** بصمة سجل التدقيق: تُخزَّن مع المادة عند طلب الاعتماد. */
  audit: {
    actorId?: string;
    draftId?: string;
    blockingRuleIds: string[];
  };
}
