/**
 * ذكاء «جاك العلم» — من النص الخام إلى خطة شرائح منظمة.
 *
 * ثلاثة خطوط دفاع قبل أن يرى المحرر أي مقترح:
 * 1) مدقق برمجي (لا ذكاء) يرفض أي رقم غير موجود حرفيًا في المصدر.
 * 2) حارس السياسة يفحص نصوص كل شريحة.
 * 3) كل شريحة تحمل sourceContext — مرجعها النصي للمراجعة البشرية.
 * والذكاء يقترح ولا ينشر — التطبيق قرار المحرر دائمًا.
 */

// استيرادات نسبية عمدًا — الملف يدخل حزمة اختبارات node:test التي لا تعرف alias ‏@/.
import Anthropic from "@anthropic-ai/sdk";

import { runPolicyGuard } from "../policy/index.ts";
import {
  isReportPalette,
  JAK_CANVASES,
  REPORT_PALETTES,
  REPORT_TEMPLATES,
  SLIDE_TYPES,
  type JakCanvas,
  type JakSlide,
  type ReportPalette,
  type SlideData,
  type SlideType,
} from "../tahrir/jak.ts";
import type { AiSettingsData } from "./settings";

function client(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? new Anthropic({ apiKey }) : null;
}

/* ============ مدقق الأرقام ============ */

const ARABIC_DIGITS = /[٠-٩]/g;
const toLatinDigits = (text: string) =>
  text.replace(ARABIC_DIGITS, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

/** أرقام النص مطبّعة: لاتينية، بلا فواصل آلاف، النسب والكسور كما هي. */
export function extractNumbers(text: string): string[] {
  const normalized = toLatinDigits(text).replace(/(\d)[,،٬](\d{3})/g, "$1$2");
  return normalized.match(/\d+(?:\.\d+)?/g) ?? [];
}

/**
 * كل رقم في الشريحة يجب أن يوجد حرفيًا في المصدر.
 * يعيد الأرقام غير الموثقة — وأي شريحة تحملها تُستبعد من الخطة.
 */
export function unverifiedNumbers(slideText: string, source: string): string[] {
  const sourcePool = new Set(extractNumbers(source));
  return extractNumbers(slideText).filter((number) => !sourcePool.has(number));
}

const slideText = (slide: JakSlide) =>
  [
    slide.title,
    slide.body,
    slide.stat,
    slide.statLabel,
    slide.data?.quoteBy,
    slide.data?.items?.join(" "),
    slide.data?.sides?.map((side) => `${side.label} ${side.value}`).join(" "),
    slide.data?.points?.map((point) => `${point.year} ${point.title} ${point.detail}`).join(" "),
    slide.data?.blocks?.map((block) => `${block.value} ${block.label} ${block.title} ${block.body}`).join(" "),
  ]
    .filter(Boolean)
    .join(" ");

/* ============ التحقق البنيوي ============ */

export interface SlideGuard {
  ok: boolean;
  findings: Array<{ ruleId: string; severity: string; message: string }>;
}

export interface PlannedSlide extends JakSlide {
  guard: SlideGuard;
}

export interface JakPlan {
  title: string;
  excerpt: string;
  palette: ReportPalette;
  slides: PlannedSlide[];
  /** شرائح أسقطها مدقق الأرقام — تُعرض للمحرر بأسبابها ولا تدخل الخطة. */
  dropped: Array<{ title: string; reason: string }>;
}

function guardSlide(text: string, as: "title" | "fragment", enabled = true): SlideGuard {
  if (!enabled) return { ok: true, findings: [] };
  const report =
    as === "title" ? runPolicyGuard({ title: text }) : runPolicyGuard({ body: text, surface: "design" });
  const findings = report.findings
    .filter((finding) => finding.ruleId !== "BODY-WORD-RANGE")
    .map(({ ruleId, severity, message }) => ({ ruleId, severity, message }));
  return { ok: !findings.some((finding) => finding.severity === "blocking"), findings };
}

interface RawSlide {
  type?: string;
  title?: string;
  body?: string;
  stat?: string;
  statLabel?: string;
  imagePrompt?: string;
  imageStyle?: string;
  sourceContext?: string;
  quoteBy?: string;
  items?: string[];
  sides?: Array<{ label?: string; value?: string }>;
  points?: Array<{ year?: string; title?: string; detail?: string }>;
  canvas?: string;
  template?: string;
  blocks?: Array<{ title?: string; body?: string; value?: string; label?: string }>;
  focalPoint?: string;
  textSafeArea?: string;
  eyebrow?: string;
  data?: {
    quoteBy?: string;
    items?: string[];
    sides?: Array<{ label?: string; value?: string }>;
    points?: Array<{ year?: string; title?: string; detail?: string }>;
    canvas?: string;
    template?: string;
    blocks?: Array<{ title?: string; body?: string; value?: string; label?: string }>;
    focalPoint?: string;
    textSafeArea?: string;
    eyebrow?: string;
  } | null;
}

const str = (value: unknown, cap: number) =>
  (typeof value === "string" ? value : "").trim().slice(0, cap);

/** يبني شريحة نظيفة من خرج النموذج — أو null إن كان النوع مجهولًا. */
export function normalizeSlide(raw: RawSlide): JakSlide | null {
  if (!raw || !(SLIDE_TYPES as readonly string[]).includes(raw.type ?? "")) return null;
  const type = raw.type as SlideType;
  // خرج النموذج يأتي بالحقول المتخصصة في الأعلى، والمحرر المحفوظ يعيدها داخل data.
  const detail = raw.data ?? raw;

  const data: SlideData = {};
  if (detail.quoteBy) data.quoteBy = str(detail.quoteBy, 120);
  if (Array.isArray(detail.items)) {
    data.items = detail.items.map((item) => str(item, 160)).filter(Boolean).slice(0, 6);
  }
  if (Array.isArray(detail.sides)) {
    data.sides = detail.sides
      .map((side) => ({ label: str(side?.label, 60), value: str(side?.value, 40) }))
      .filter((side) => side.label && side.value)
      .slice(0, 2);
  }
  if (Array.isArray(detail.points)) {
    data.points = detail.points
      .map((point) => ({
        year: str(point?.year, 20),
        title: str(point?.title, 100),
        detail: str(point?.detail, 160),
      }))
      .filter((point) => point.title)
      .slice(0, 5);
  }
  if ((JAK_CANVASES as readonly string[]).includes(detail.canvas ?? "")) {
    data.canvas = detail.canvas as JakCanvas;
  }
  if ((REPORT_TEMPLATES as readonly string[]).includes(detail.template ?? "")) {
    data.template = detail.template as SlideData["template"];
  }
  if (Array.isArray(detail.blocks)) {
    data.blocks = detail.blocks
      .map((block) => ({
        title: str(block?.title, 70),
        body: str(block?.body, 220),
        value: str(block?.value, 24),
        label: str(block?.label, 70),
      }))
      .filter((block) => block.title || block.body || block.value)
      .slice(0, 6);
  }
  if (["left", "center", "right"].includes(detail.focalPoint ?? "")) {
    data.focalPoint = detail.focalPoint as SlideData["focalPoint"];
  }
  if (["left", "center", "right"].includes(detail.textSafeArea ?? "")) {
    data.textSafeArea = detail.textSafeArea as SlideData["textSafeArea"];
  }
  if (detail.eyebrow) data.eyebrow = str(detail.eyebrow, 50);

  return {
    id: crypto.randomUUID(),
    type,
    title: str(raw.title, 140),
    body: str(raw.body, 500),
    stat: toLatinDigits(str(raw.stat, 24)),
    statLabel: str(raw.statLabel, 160),
    image: null,
    imageStyle: ["real", "illustrative", "graphic"].includes(raw.imageStyle ?? "")
      ? (raw.imageStyle as string)
      : "real",
    imagePrompt: str(raw.imagePrompt, 400),
    sourceContext: str(raw.sourceContext, 300),
    hidden: false,
    data: Object.keys(data).length > 0 ? data : null,
  };
}

/**
 * التحقق الكامل لخطة النموذج: بنية + أرقام + حارس.
 * دالة نقية قابلة للاختبار — لا شبكة ولا قاعدة.
 */
export function validateJakPlan(
  parsed: { title?: string; excerpt?: string; palette?: string; slides?: RawSlide[] },
  source: string,
  editorialGuard = true,
): JakPlan {
  const dropped: JakPlan["dropped"] = [];
  const slides: PlannedSlide[] = [];

  for (const raw of (parsed.slides ?? []).slice(0, 14)) {
    const slide = normalizeSlide(raw);
    if (!slide) {
      dropped.push({ title: str(raw?.title, 80) || "بلا عنوان", reason: "نوع شريحة غير معروف" });
      continue;
    }

    const bad = unverifiedNumbers(slideText(slide), source);
    if (bad.length > 0) {
      dropped.push({
        title: slide.title || slide.stat || "بلا عنوان",
        reason: `أرقام غير موجودة في المصدر: ${bad.join("، ")}`,
      });
      continue;
    }

    const titleGuard = slide.title ? guardSlide(slide.title, "title", editorialGuard) : { ok: true, findings: [] };
    const contentGuard = guardSlide(slideText(slide), "fragment", editorialGuard);
    slides.push({
      ...slide,
      guard: {
        ok: titleGuard.ok && contentGuard.ok,
        findings: [...titleGuard.findings, ...contentGuard.findings],
      },
    });
  }

  if (slides.length === 0) {
    throw new Error("لم تنتج الخطة أي شريحة صالحة — أعد المحاولة أو راجع المصدر.");
  }

  // الطابع قرار على مستوى التقرير — يُختم على كل شريحة فتقرأه الواجهة من أيها
  const palette: ReportPalette = isReportPalette(parsed.palette) ? parsed.palette : "economy";
  for (const slide of slides) slide.data = { ...slide.data, palette };

  return {
    title: str(parsed.title, 140),
    excerpt: str(parsed.excerpt, 180),
    palette,
    slides,
    dropped,
  };
}

/* ============ استدعاء النموذج ============ */

const PLAN_PROMPT = (title: string, source: string, canvas: JakCanvas) =>
  [
    canvas === "landscape"
      ? "حوّل هذا التقرير إلى تقرير بصري أفقي 16:9 من صفحات متتابعة، كل صفحة فكرة واحدة."
      : "حوّل هذا التقرير إلى «جاك العلم»: قصة معرفية من شرائح عمودية متتابعة، كل شريحة فكرة واحدة.",
    "",
    "أنواع الشرائح: hero (افتتاحية واحدة أولًا)، text (فكرة مع عنصر بصري)، stat (رقم بارز)،",
    "comparison (طرفان sides)، timeline (نقاط points)، quote (اقتباس بنسبته quoteBy)،",
    "list (عناصر items)، fact (حقيقة سريعة)، summary (خلاصة items)، end (ختامية واحدة أخيرًا).",
    "",
    "قواعد صارمة:",
    "- 8 إلى 12 شريحة، وكل شريحة فكرة واحدة لا فقرة منسوخة.",
    "- عنوان كل شريحة حتى 10 كلمات، ونصها حتى جملتين.",
    "- ممنوع منعًا باتًا أي رقم أو نسبة أو سنة غير موجودة حرفيًا في المصدر — مدقق آلي سيرفض الشريحة.",
    "- كل شريحة تحمل sourceContext: الجملة الأصلية من المصدر التي بُنيت عليها.",
    "- imagePrompt بالإنجليزية: صف مشهدًا **محددًا مشتقًا من sourceContext لهذه الشريحة**",
    "  لا من موضوع التقرير العام — التفصيل الملموس الذي تتحدث عنه الشريحة (مكان، أداة،",
    "  نشاط، مشهد داخلي، تفصيلة قريبة). نوّع المدى: قريبة أو متوسطة أو واسعة أو داخلية،",
    "  ولا تجعلها كلها لقطات جوية. اختر الإضاءة والمزاج بما يخدم الفكرة لا بلوحة ثابتة.",
    "  ممنوع: نصوص أو شعارات داخل الصورة، ووجوه قريبة لأشخاص معروفين.",
    "- لكل شريحة imagePrompt — بما فيها شرائح الأرقام والمقارنة والتسلسل والخلاصة:",
    "  فصفحاتها تعرض الصورة خلفية خافتة خلف البطاقات، فليكن المشهد هادئًا قليل التفاصيل.",
    "- imageStyle: real أو illustrative أو graphic.",
    "- الأرقام لاتينية دائمًا (2026 لا ٢٠٢٦).",
    ...(canvas === "landscape"
      ? [
          "- canvas في كل صفحة landscape.",
          "- اختر template من: cover للغلاف فقط، image-text لصورة مع فقرة، stats للأرقام، grid للأفكار المتوازية.",
          "- لقوالب stats وgrid أعد blocks من 3 إلى 6 وحدات. كل وحدة: title وbody وvalue وlabel حسب الحاجة.",
          "- focalPoint موضع العنصر داخل الصورة وtextSafeArea موضع عمود النص المقابل: left أو center أو right.",
          "- eyebrow تصنيف قصير من كلمتين إلى أربع كلمات.",
          "- صفحات cover وimage-text: الصورة تملأ الصفحة والنص فوقها، فاترك ثلثًا هادئًا في جهة textSafeArea.",
        ]
      : []),
    "",
    `- palette: طابع التقرير اللوني، اختر الأنسب لموضوعه من: ${Object.entries(REPORT_PALETTES).map(([key, palette]) => `${key} (${palette.name})`).join(" · ")}.`,
    "",
    "أعد JSON واحدًا فقط:",
    '{"title":"عنوان التقرير ≤10 كلمات","excerpt":"موجز ≤25 كلمة","palette":"economy",',
    ' "slides":[{"type":"...","title":"...","body":"...","stat":"","statLabel":"",',
    '  "quoteBy":"","items":[],"sides":[{"label":"","value":""}],',
    '  "points":[{"year":"","title":"","detail":""}],"canvas":"vertical|landscape",',
    '  "template":"cover|image-text|stats|grid","eyebrow":"","blocks":[{"title":"","body":"","value":"","label":""}],',
    '  "focalPoint":"left|center|right","textSafeArea":"left|center|right",',
    '  "imagePrompt":"","imageStyle":"real","sourceContext":"..."}]}',
    "أدرج فقط الحقول ذات المعنى لكل نوع.",
    "",
    `العنوان المقترح من المحرر: ${title || "(اقترحه أنت)"}`,
    "",
    "المصدر:",
    source,
  ].join("\n");

export async function runJakPlan(
  input: { title: string; source: string; canvas?: JakCanvas },
  settings: AiSettingsData,
): Promise<{ plan: JakPlan; usage: { model: string; inputTokens: number; outputTokens: number } }> {
  const anthropic = client();
  if (!anthropic) {
    throw new Error("مفتاح Anthropic غير مضبوط — أضف ANTHROPIC_API_KEY ثم أعد التشغيل.");
  }

  const { constitution } = await import("./editorial");
  const model = settings.models.editorial;
  const response = await anthropic.messages.create({
    model,
    max_tokens: 16_384,
    system: [
      "أنت «محرر جاك العلم» — تحول التقارير إلى قصص شرائح عمودية لمنصة العلم.",
      "تقترح ولا تنشر: خطتك تُعرض على محرر بشري يقرر.",
      "",
      "الدستور التحريري الملزم نصًا:",
      constitution(),
    ].join("\n"),
    messages: [{ role: "user", content: PLAN_PROMPT(input.title, input.source, input.canvas ?? "vertical") }],
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error("مخرج النموذج انقطع قبل الاكتمال — قصّر المصدر أو أعد المحاولة.");
  }

  const raw = response.content.find((block) => block.type === "text")?.text ?? "";
  const jsonText = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  let parsed: { title?: string; excerpt?: string; slides?: RawSlide[] };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("تعذر قراءة مخرج النموذج — أعد المحاولة.");
  }

  const plan = validateJakPlan(parsed, input.source, settings.governance.editorialGuard);
  if (input.canvas === "landscape") {
    plan.slides = plan.slides.map((slide, index) => ({
      ...slide,
      data: {
        ...slide.data,
        canvas: "landscape",
        template:
          slide.data?.template ??
          (index === 0
            ? "cover"
            : slide.type === "stat" || slide.type === "comparison"
              ? "stats"
              : slide.type === "list" || slide.type === "summary" || slide.type === "timeline"
                ? "grid"
                : "image-text"),
      },
    }));
  }

  return {
    plan,
    usage: {
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

/* ============ عمليات محددة النطاق على شريحة واحدة ============ */

export const SLIDE_OPS = ["retitle", "shorten", "rebuild", "to_stat", "split"] as const;
export type SlideOp = (typeof SLIDE_OPS)[number];

const OP_PROMPTS: Record<SlideOp, string> = {
  retitle: "اقترح عنوانًا بديلًا للشريحة (≤10 كلمات) يحفظ المعنى.",
  shorten: "اختصر نص الشريحة إلى جملة واحدة قوية تحفظ الحقيقة كما هي.",
  rebuild: "أعد بناء الشريحة كاملة بصياغة أوضح وأقوى دون تغيير نوعها ولا حقائقها.",
  to_stat: "حوّل الشريحة إلى نوع stat: استخرج الرقم الأبرز من سياقها المصدري وضعه في stat مع statLabel تفسيري.",
  split: "قسّم الشريحة إلى شريحتين، كل واحدة فكرة واحدة أنقى — أعد مصفوفة slides باثنتين.",
};

export async function runSlideOp(
  op: SlideOp,
  slide: JakSlide,
  source: string,
  settings: AiSettingsData,
): Promise<{
  slides: PlannedSlide[];
  dropped: JakPlan["dropped"];
  usage: { model: string; inputTokens: number; outputTokens: number };
}> {
  const anthropic = client();
  if (!anthropic) {
    throw new Error("مفتاح Anthropic غير مضبوط — أضف ANTHROPIC_API_KEY ثم أعد التشغيل.");
  }

  const { constitution } = await import("./editorial");
  const model = settings.models.editorial;
  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: [
      "أنت «محرر جاك العلم». تعدل شريحة واحدة فقط ولا تنشر شيئًا.",
      "ممنوع أي رقم غير موجود في المصدر. الأرقام لاتينية.",
      "الدستور التحريري:",
      constitution(),
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: [
          OP_PROMPTS[op],
          "",
          `أعد JSON فقط: {"slides":[شريحة أو اثنتان بنفس مخطط الحقول: type,title,body,stat,statLabel,quoteBy,items,sides,points,imagePrompt,imageStyle,sourceContext]}`,
          "",
          "الشريحة الحالية:",
          JSON.stringify(slide, null, 1),
          "",
          "المصدر الأصلي:",
          source.slice(0, 20_000),
        ].join("\n"),
      },
    ],
  });

  const raw = response.content.find((block) => block.type === "text")?.text ?? "";
  const jsonText = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  let parsed: { slides?: RawSlide[] };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("تعذر قراءة مخرج النموذج — أعد المحاولة.");
  }

  const plan = validateJakPlan(
    { title: "x", excerpt: "", slides: parsed.slides },
    source,
    settings.governance.editorialGuard,
  );
  return {
    slides: plan.slides.slice(0, op === "split" ? 2 : 1),
    dropped: plan.dropped,
    usage: {
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
