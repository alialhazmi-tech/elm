/**
 * «محرر العلم» — أدوات التحرير الذكية فوق Claude (SDK الرسمي).
 *
 * الحوكمة كودًا، لا وعودًا:
 * 1) الدستور التحريري + نبرة العلم يُحقنان في كل استدعاء.
 * 2) كل مخرج يُفحص بحارس السياسة على الخادم قبل أن يصل الواجهة.
 * 3) المفتاح من ANTHROPIC_API_KEY حصرًا — لا سقوط صامت لأي اعتماد آخر.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import Anthropic from "@anthropic-ai/sdk";

import { runPolicyGuard } from "@/lib/policy";
import type { Finding } from "@/lib/policy/types";
import type { AiSettingsData } from "./settings";

let constitutionCache: string | null = null;

/** الدستور التحريري نصًا — يُقرأ مرة ويُحقن في كل استدعاء. */
export function constitution(): string {
  if (constitutionCache !== null) return constitutionCache;
  try {
    constitutionCache = readFileSync(
      path.join(process.cwd(), "docs", "editorial-policy.md"),
      "utf8",
    );
  } catch {
    constitutionCache = "";
  }
  return constitutionCache;
}

function client(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  // صراحةً بلا سقوط لملفات اعتماد الجهاز — مفتاح المنصة أو لا شيء.
  return apiKey ? new Anthropic({ apiKey }) : null;
}

function systemPrompt(tone: string): string {
  return [
    "أنت «محرر العلم» — مساعد تحرير داخلي لمنصة العلم الإخبارية المعرفية السعودية.",
    "تقترح ولا تنشر: مخرجاتك تُعرض على محرر بشري يقرر، ويفحصها حارس السياسة قبل العرض.",
    "",
    "نبرة العلم (قرار رئيس التحرير):",
    tone,
    "",
    "الدستور التحريري الملزم نصًا:",
    constitution(),
  ].join("\n");
}

export interface AiSuggestion {
  text: string;
  guard: { ok: boolean; findings: Array<Pick<Finding, "ruleId" | "severity" | "message">> };
}

export interface SeoResult {
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  guard: AiSuggestion["guard"];
}

/** «التحرير الشامل»: كل حقل مقترح بفحص حارس مستقل — التطبيق قرار بشري بنقرة. */
export interface FullEditResult {
  title: AiSuggestion;
  excerpt: AiSuggestion;
  body: AiSuggestion;
  seo: SeoResult;
  classify: { seriesSlug: string | null; section: string; format: string };
}

export interface AiResult {
  suggestions: AiSuggestion[];
  classify?: { seriesSlug: string | null; section: string; format: string };
  seo?: SeoResult;
  fullEdit?: FullEditResult;
  usage: { model: string; inputTokens: number; outputTokens: number };
}

/**
 * فحص مقترح بالحارس — قواعد العنوان للعناوين، وقواعد النص للفقرات
 * (بلا قاعدة طول المتن)، والمتن الكامل بكل القواعد.
 */
function guardCheck(text: string, as: "title" | "fragment" | "body"): AiSuggestion["guard"] {
  const report =
    as === "title"
      ? runPolicyGuard({ title: text })
      : runPolicyGuard({ body: text });

  const findings = report.findings
    .filter((finding) => !(as === "fragment" && finding.ruleId === "BODY-WORD-RANGE"))
    .map(({ ruleId, severity, message }) => ({ ruleId, severity, message }));

  return { ok: !findings.some((finding) => finding.severity === "blocking"), findings };
}

const TOOL_PROMPTS: Record<string, (input: { title: string; body: string; selection?: string }) => string> = {
  headlines: ({ title, body }) =>
    `اقترح ثلاثة عناوين بديلة لهذه المادة. أعد JSON فقط بالشكل {"suggestions": ["...", "...", "..."]}.\n\nالعنوان الحالي: ${title}\n\nالمتن:\n${body}`,
  excerpt: ({ title, body }) =>
    `اكتب «قبل القراءة»: خلاصة من جملة واحدة (حتى 25 كلمة) تلخص جوهر المادة لا مقدمة لها. أعد JSON فقط: {"suggestions": ["..."]}.\n\nالعنوان: ${title}\n\nالمتن:\n${body}`,
  improve: ({ selection, body }) =>
    `حسّن هذا المقطع صحفيًا: أزل الركاكة والحشو، واحفظ المعنى والحقائق كما هي تمامًا، ولا تضف معلومة. أعد JSON فقط: {"suggestions": ["النص المحسّن"]}.\n\nالمقطع:\n${selection || body}`,
  proofread: ({ body }) =>
    `دقق النص لغويًا وإملائيًا فقط — لا تعد صياغة ولا تغير الأسلوب، صحح الأخطاء وحدها. أعد JSON فقط: {"suggestions": ["النص المدقق كاملًا"]}.\n\nالنص:\n${body}`,
  classify: ({ title, body }) =>
    `صنّف المادة. السلاسل: absat أبسط، aghrab أغرب، efhamha-sah افهمها صح، bel-arqam بالأرقام، shakhsiat شخصيات، limatha لماذا، matha-law ماذا لو، bel-tarikh بالتاريخ — أو null إن لم تناسب أي سلسلة. الأقسام: politics, economy, world, ksa, current-events, health, technology, sciences, sport, business, art, culture, varieties, news. الأشكال: news, infographics, videos, reports, podcasts. أعد JSON فقط: {"seriesSlug": "... أو null", "section": "...", "format": "..."}.\n\nالعنوان: ${title}\n\nالمتن:\n${body}`,
  seo: ({ title, body }) =>
    `ولّد حزمة SEO لهذه المادة: عنوان بحث حتى 60 حرفًا يحمل الكلمة المفتاحية الأهم، ووصف بحث حتى 155 حرفًا يلخص القيمة بلا حشو، و5-8 كلمات مفتاحية عربية يبحث بها الناس فعلًا (بلا وسوم #). أعد JSON فقط: {"seoTitle": "...", "seoDescription": "...", "keywords": ["...", "..."]}.\n\nالعنوان: ${title}\n\nالمتن:\n${body}`,
  full_edit: ({ title, body }) =>
    [
      "نفّذ «تحريرًا شاملًا» لهذه المادة وفق أسلوب العلم والدستور أعلاه، وأعد JSON واحدًا فقط بهذه الحقول كلها:",
      "{",
      '  "title": "عنوان حتى 10 كلمات بلا تهويل",',
      '  "excerpt": "«قبل القراءة» — خلاصة جملة واحدة حتى 25 كلمة",',
      '  "body": "المتن كاملًا بعد التحرير: فقرات مفصولة بسطرين فارغين، تحرير صحفي يزيل الركاكة والحشو ويحفظ كل الحقائق والأرقام والمصادر كما هي — ممنوع إضافة أي معلومة",',
      '  "seoTitle": "عنوان بحث حتى 60 حرفًا",',
      '  "seoDescription": "وصف بحث حتى 155 حرفًا",',
      '  "keywords": ["5-8 كلمات مفتاحية عربية"],',
      '  "seriesSlug": "absat|aghrab|efhamha-sah|bel-arqam|shakhsiat|limatha|matha-law|bel-tarikh أو null",',
      '  "section": "politics|economy|world|ksa|current-events|health|technology|sciences|sport|business|art|culture|varieties|news",',
      '  "format": "news|infographics|videos|reports|podcasts"',
      "}",
      "",
      `العنوان الحالي: ${title}`,
      "",
      "المتن الحالي:",
      body,
    ].join("\n"),
};

export type AiTool = keyof typeof TOOL_PROMPTS;

export const AI_TOOLS = Object.keys(TOOL_PROMPTS) as AiTool[];

export async function runEditorialTool(
  tool: AiTool,
  input: { title: string; body: string; selection?: string },
  settings: AiSettingsData,
): Promise<AiResult> {
  const anthropic = client();
  if (!anthropic) {
    throw new Error("مفتاح Anthropic غير مضبوط — أضف ANTHROPIC_API_KEY ثم أعد التشغيل.");
  }

  const model = tool === "classify" ? settings.models.light : settings.models.editorial;
  const response = await anthropic.messages.create({
    model,
    max_tokens: tool === "full_edit" ? 16_384 : tool === "proofread" ? 8192 : 2048,
    system: systemPrompt(settings.tone),
    messages: [{ role: "user", content: TOOL_PROMPTS[tool](input) }],
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error("مخرج النموذج انقطع قبل الاكتمال — قصّر المادة أو أعد المحاولة.");
  }

  const usage = {
    model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };

  const raw = response.content.find((block) => block.type === "text")?.text ?? "";
  const jsonText = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  let parsed: {
    suggestions?: string[];
    seriesSlug?: string | null;
    section?: string;
    format?: string;
    title?: string;
    excerpt?: string;
    body?: string;
    seoTitle?: string;
    seoDescription?: string;
    keywords?: string[];
  };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("تعذر قراءة مخرج النموذج — أعد المحاولة.");
  }

  if (tool === "classify") {
    return {
      suggestions: [],
      classify: {
        seriesSlug: parsed.seriesSlug ?? null,
        section: parsed.section ?? "news",
        format: parsed.format ?? "news",
      },
      usage,
    };
  }

  const cleanKeywords = (parsed.keywords ?? [])
    .filter((keyword): keyword is string => typeof keyword === "string")
    .map((keyword) => keyword.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 8);

  if (tool === "seo") {
    const seoTitle = (parsed.seoTitle ?? "").trim();
    const seoDescription = (parsed.seoDescription ?? "").trim();
    return {
      suggestions: [],
      seo: {
        seoTitle,
        seoDescription,
        keywords: cleanKeywords,
        guard: guardCheck(`${seoTitle} ${seoDescription} ${cleanKeywords.join(" ")}`, "fragment"),
      },
      usage,
    };
  }

  if (tool === "full_edit") {
    const title = (parsed.title ?? "").trim();
    const excerpt = (parsed.excerpt ?? "").trim();
    const bodyText = (parsed.body ?? "").trim();
    const seoTitle = (parsed.seoTitle ?? "").trim();
    const seoDescription = (parsed.seoDescription ?? "").trim();
    if (!title || !bodyText) throw new Error("مخرج التحرير الشامل ناقص — أعد المحاولة.");
    return {
      suggestions: [],
      fullEdit: {
        title: { text: title, guard: guardCheck(title, "title") },
        excerpt: { text: excerpt, guard: guardCheck(excerpt, "fragment") },
        body: { text: bodyText, guard: guardCheck(bodyText, "body") },
        seo: {
          seoTitle,
          seoDescription,
          keywords: cleanKeywords,
          guard: guardCheck(`${seoTitle} ${seoDescription} ${cleanKeywords.join(" ")}`, "fragment"),
        },
        classify: {
          seriesSlug: parsed.seriesSlug ?? null,
          section: parsed.section ?? "news",
          format: parsed.format ?? "news",
        },
      },
      usage,
    };
  }

  const texts = (parsed.suggestions ?? []).filter(Boolean).slice(0, 3);
  return {
    suggestions: texts.map((text) => ({
      text,
      guard: guardCheck(text, tool === "headlines" ? "title" : "fragment"),
    })),
    usage,
  };
}
