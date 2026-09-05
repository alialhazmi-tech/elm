/**
 * «محرر العلم» — أدوات التحرير عبر Anthropic أو OpenRouter بواجهة Messages.
 *
 * الحوكمة كودًا، لا وعودًا:
 * 1) الدستور التحريري + نبرة العلم يُحقنان في كل استدعاء.
 * 2) مخرجاته تُفحص بحارس السياسة على الخادم حين يكون مفعّلًا من إعدادات النظام.
 * 3) مفتاح المزود المختار من أسرار التشغيل — لا سقوط صامت إلى مزود آخر.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import Anthropic from "@anthropic-ai/sdk";
import { textClient as client } from "./text-client";
import { reserveTextCents } from "./pricing";
import { missingTextKeyMessage } from "./provider-config";

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

export type Usage = { model: string; inputTokens: number; outputTokens: number };

function systemBlocks(tone: string, editorialGuard: boolean): Anthropic.TextBlockParam[] {
  return [
    {
      type: "text",
      text: [
        "أنت «محرر العلم» — مساعد تحرير داخلي لمنصة العلم الإخبارية المعرفية السعودية.",
        editorialGuard
          ? "تقترح ولا تنشر: مخرجاتك تُعرض على محرر بشري يقرر، ويفحصها حارس السياسة قبل العرض."
          : "تقترح ولا تنشر: مخرجاتك تُعرض على محرر بشري يقرر.",
        "",
        "نبرة العلم (قرار رئيس التحرير):",
        tone,
      ].join("\n"),
    },
    {
      type: "text",
      text: `الدستور التحريري الملزم نصًا:\n${constitution()}`,
      cache_control: { type: "ephemeral" },
    },
  ];
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
  metadata?: MetadataResult;
  usage: Usage;
  usages?: Usage[];
}

export type MetadataResult = Omit<FullEditResult, "title" | "body">;

export type FullEditProgressStage =
  | "accepted"
  | "body_started"
  | "pack_started"
  | "body_ready"
  | "pack_ready"
  | "guard_checking"
  | "complete";

interface EditorialRunOptions {
  signal?: AbortSignal;
  onUsage?: (usage: Usage) => void;
  onUnmeasured?: (reservedCents: number) => void;
  onFullEditProgress?: (stage: FullEditProgressStage) => void;
}

/**
 * فحص مقترح بالحارس — قواعد العنوان للعناوين، وقواعد النص للفقرات
 * (بلا قاعدة طول المتن)، والمتن الكامل بكل القواعد.
 */
function guardCheck(text: string, as: "title" | "fragment" | "body", enabled: boolean): AiSuggestion["guard"] {
  if (!enabled) return { ok: true, findings: [] };
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
    `اقترح ثلاثة عناوين لهذه المادة، كل عنوان حتى 10 كلمات، من حقائق المتن دون إضافة أو تهويل. أعد JSON فقط بالشكل {"suggestions": ["...", "...", "..."]}.\n\nالعنوان الحالي: ${title}\n\nالمتن:\n${body}`,
  excerpt: ({ title, body }) =>
    `اكتب الموجز الذكي «قبل القراءة»: خلاصة من جملة واحدة حتى 180 حرفًا و25 كلمة، تلخص جوهر المادة لا مقدمة لها، من حقائق المتن دون إضافة. أعد JSON فقط: {"suggestions": ["..."]}.\n\nالعنوان: ${title}\n\nالمتن:\n${body}`,
  improve: ({ selection, body }) =>
    `حسّن هذا المقطع صحفيًا: أزل الركاكة والحشو، واحفظ المعنى والحقائق كما هي تمامًا، ولا تضف معلومة. أعد JSON فقط: {"suggestions": ["النص المحسّن"]}.\n\nالمقطع:\n${selection || body}`,
  proofread: ({ body }) =>
    `دقق النص لغويًا وإملائيًا فقط — لا تعد صياغة ولا تغير الأسلوب، صحح الأخطاء وحدها. أعد JSON فقط: {"suggestions": ["النص المدقق كاملًا"]}.\n\nالنص:\n${body}`,
  classify: ({ title, body }) =>
    `صنّف المادة. السلاسل: absat أبسط، aghrab أغرب، efhamha-sah افهمها صح، bel-arqam بالأرقام، shakhsiat شخصيات، limatha لماذا، matha-law ماذا لو، bel-tarikh بالتاريخ — أو null إن لم تناسب أي سلسلة. الأقسام: politics, economy, world, ksa, current-events, health, technology, sciences, sport, business, art, culture, varieties, news. الأشكال: news, infographics, videos, reports, podcasts. أعد JSON فقط: {"seriesSlug": "... أو null", "section": "...", "format": "..."}.\n\nالعنوان: ${title}\n\nالمتن:\n${body}`,
  seo: ({ title, body }) =>
    `ولّد حزمة SEO لهذه المادة: عنوان بحث حتى 60 حرفًا يحمل الكلمة المفتاحية الأهم، ووصف بحث حتى 155 حرفًا يلخص القيمة بلا حشو، و5-8 كلمات مفتاحية عربية يبحث بها الناس فعلًا (بلا وسوم #). أعد JSON فقط: {"seoTitle": "...", "seoDescription": "...", "keywords": ["...", "..."]}.\n\nالعنوان: ${title}\n\nالمتن:\n${body}`,
  metadata: ({ title, body }) =>
    `ولّد ملحقات المادة فقط من حقائق المتن: موجز «قبل القراءة» جملة واحدة حتى 180 حرفًا، عنوان SEO حتى 60 حرفًا ووصف SEO حتى 155 حرفًا، و5-8 كلمات مفتاحية بلا #. اختر القسم والشكل والسلسلة الأنسب أو null إذا لم تناسبها سلسلة. لا تعد كتابة العنوان أو المتن ولا تضف معلومة. الأقسام: politics,economy,world,ksa,current-events,health,technology,sciences,sport,business,art,culture,varieties,news. الأشكال: news,infographics,videos,reports,podcasts. السلاسل: absat,aghrab,efhamha-sah,bel-arqam,shakhsiat,limatha,matha-law,bel-tarikh. أعد JSON فقط بالشكل {"excerpt":"...","seoTitle":"...","seoDescription":"...","keywords":["..."],"section":"...","format":"...","seriesSlug":null}.\n\nالعنوان الحالي: ${title}\n\nالمتن:\n${body}`,
  full_edit: ({ title, body }) =>
    `حرّر المتن بأسلوب العلم. أعد المتن المحرَّر فقط — بلا عنوان وبلا JSON وبلا تعليق وبلا Markdown. فقرات مفصولة بسطر فارغ. أزل الركاكة والحشو واحفظ كل الحقائق والأرقام والمصادر كما هي. ممنوع إضافة أي معلومة.\n\nالعنوان الحالي: ${title}\n\nالمتن:\n${body}`,
};

const FULL_EDIT_PACK_PROMPT = ({ title, body }: { title: string; body: string }) =>
  [
    "من المادة التالية ولّد الحقول المساعدة فقط. أعد JSON واحدًا:",
    '{"title":"حتى 10 كلمات بلا تهويل","excerpt":"خلاصة جملة واحدة حتى 25 كلمة","seoTitle":"حتى 60 حرفًا","seoDescription":"حتى 155 حرفًا","keywords":["5-8 كلمات"],"seriesSlug":"absat|aghrab|efhamha-sah|bel-arqam|shakhsiat|limatha|matha-law|bel-tarikh أو null","section":"politics|economy|world|ksa|current-events|health|technology|sciences|sport|business|art|culture|varieties|news","format":"news|infographics|videos|reports|podcasts"}',
    "",
    `العنوان الحالي: ${title}`,
    "",
    "المتن:",
    body,
  ].join("\n");

export type AiTool = keyof typeof TOOL_PROMPTS;

export const AI_TOOLS = Object.keys(TOOL_PROMPTS) as AiTool[];

const FULL_EDIT_BODY_LIMIT = 12_000;

function stripFences(text: string): string {
  return text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const jsonText = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  return JSON.parse(jsonText) as Record<string, unknown>;
}

interface CompletionOptions {
  model: string; maxTokens: number; tone: string; editorialGuard: boolean;
  user: string; signal?: AbortSignal; stream?: boolean;
  onUsage?: (usage: Usage) => void;
  onUnmeasured?: (reservedCents: number) => void;
}

function requestEstimate(opts: CompletionOptions): number {
  return reserveTextCents(opts.model, systemBlocks(opts.tone, opts.editorialGuard).map(block => block.text).join("\n") + "\n" + opts.user, opts.maxTokens);
}

export function editorialReservationCents(tool: AiTool, input: { title: string; body: string; selection?: string }, settings: AiSettingsData): number {
  const common = { tone: settings.tone, editorialGuard: settings.governance.editorialGuard };
  if (tool === "full_edit") {
    const clipped = { ...input, body: input.body.slice(0, FULL_EDIT_BODY_LIMIT) };
    return requestEstimate({ ...common, model: settings.models.fast, user: TOOL_PROMPTS.full_edit(clipped), maxTokens: 8192 })
      + requestEstimate({ ...common, model: settings.models.light, user: FULL_EDIT_PACK_PROMPT(clipped), maxTokens: 2048 });
  }
  return requestEstimate({ ...common, model: modelFor(tool, settings), user: TOOL_PROMPTS[tool](input), maxTokens: tool === "proofread" ? 8192 : 2048 });
}

async function complete(
  anthropic: Anthropic,
  opts: CompletionOptions,
): Promise<{ text: string; usage: Usage; stopReason: string | null }> {
  if (opts.signal?.aborted) throw new Error("أُلغي الطلب قبل إرساله إلى مزوّد الذكاء.");
  // مهلة كلية تشمل قراءة البث، لا مهلة انتظار ترويسات الاتصال فقط.
  const deadline = AbortSignal.timeout(120_000);
  const signal = opts.signal ? AbortSignal.any([opts.signal, deadline]) : deadline;
  let response: Anthropic.Message;
  try {
    const params = { model: opts.model, max_tokens: opts.maxTokens,
      system: systemBlocks(opts.tone, opts.editorialGuard),
      messages: [{ role: "user" as const, content: opts.user }] };
    response = opts.stream
      ? await anthropic.messages.stream(params, { signal }).finalMessage()
      : await anthropic.messages.create(params, { signal });
  } catch (error) {
    const status = error instanceof Anthropic.APIError ? error.status : undefined;
    // الرفض الصريح قبل التوليد لا يُحسب. انقطاع الشبكة أو البث لا يثبت عدم الاستهلاك.
    if (!status || ![400, 401, 402, 403, 404, 413, 422, 429].includes(status)) opts.onUnmeasured?.(requestEstimate(opts));
    if (deadline.aborted) throw new Error("انتهت مهلة مزوّد الذكاء بعد دقيقتين. لم يُطبّق أي تغيير؛ جرّب مجددًا أو استخدم توليد الملحقات.");
    throw error;
  }
  const rawUsage = response.usage;
  if (!rawUsage || !Number.isFinite(rawUsage.input_tokens) || !Number.isFinite(rawUsage.output_tokens)) {
    opts.onUnmeasured?.(requestEstimate(opts));
    throw new Error("وصلت نتيجة دون قياس استهلاك موثوق من مزوّد الذكاء.");
  }
  const usage = {
    model: opts.model,
    // تكلفة الكاش محسوبة بتحفظ حتى عند غياب فاتورة تفصيلية من المزوّد.
    inputTokens: rawUsage.input_tokens + (rawUsage.cache_read_input_tokens ?? 0) + Math.ceil((rawUsage.cache_creation_input_tokens ?? 0) * 1.25),
    outputTokens: rawUsage.output_tokens,
  };
  // نسجل القياس فور الوصول؛ فشل JSON أو فحص المخرجات لا يترك الحجز كاملًا.
  opts.onUsage?.(usage);
  return { text: response.content.filter(block => block.type === "text").map(block => block.text).join(""), stopReason: response.stop_reason, usage };
}

function modelFor(tool: AiTool, settings: AiSettingsData): string {
  if (tool === "classify" || tool === "metadata") return settings.models.light;
  if (tool === "full_edit") return settings.models.fast;
  return settings.models.editorial;
}

async function runFullEdit(
  anthropic: Anthropic,
  input: { title: string; body: string },
  settings: AiSettingsData,
  options: EditorialRunOptions,
): Promise<AiResult> {
  const clipped = {
    title: input.title,
    body: input.body.slice(0, FULL_EDIT_BODY_LIMIT),
  };
  const bodyModel = modelFor("full_edit", settings);
  const packModel = settings.models.light;

  options.onFullEditProgress?.("accepted");
  options.onFullEditProgress?.("body_started");
  options.onFullEditProgress?.("pack_started");

  const outcomes = await Promise.allSettled([
    complete(anthropic, {
      model: bodyModel,
      maxTokens: 8192,
      tone: settings.tone,
      editorialGuard: settings.governance.editorialGuard,
      user: TOOL_PROMPTS.full_edit(clipped),
      signal: options.signal,
      stream: true,
      onUsage: options.onUsage,
      onUnmeasured: options.onUnmeasured,
    }).then((result) => {
      options.onFullEditProgress?.("body_ready");
      return result;
    }),
    complete(anthropic, {
      model: packModel,
      maxTokens: 2048,
      tone: settings.tone,
      editorialGuard: settings.governance.editorialGuard,
      user: FULL_EDIT_PACK_PROMPT(clipped),
      signal: options.signal,
      stream: true,
      onUsage: options.onUsage,
      onUnmeasured: options.onUnmeasured,
    }).then((result) => {
      options.onFullEditProgress?.("pack_ready");
      return result;
    }),
  ]);

  const failed = outcomes.find(outcome => outcome.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  const [bodyResult, packResult] = outcomes.map(outcome => {
    if (outcome.status !== "fulfilled") throw new Error("تعذر إكمال التحرير.");
    return outcome.value;
  });

  if (packResult.stopReason === "max_tokens") throw new Error("توقّف توليد الملحقات قبل اكتمالها؛ أعد المحاولة.");
  if (bodyResult.stopReason === "max_tokens") {
    throw new Error("مخرج النموذج انقطع قبل الاكتمال — قصّر المادة أو أعد المحاولة.");
  }

  const bodyText = stripFences(bodyResult.text);
  if (!bodyText) throw new Error("مخرج التحرير الشامل ناقص — أعد المحاولة.");

  let pack: {
    title?: string;
    excerpt?: string;
    seoTitle?: string;
    seoDescription?: string;
    keywords?: string[];
    seriesSlug?: string | null;
    section?: string;
    format?: string;
  } = {};
  try {
    pack = parseJsonObject(packResult.text) as typeof pack;
  } catch {
    throw new Error("تعذر قراءة ملحقات التحرير الشامل؛ أعد المحاولة.");
  }

  if (typeof pack.title !== "string" || !pack.title.trim() || typeof pack.excerpt !== "string" || !pack.excerpt.trim()
    || typeof pack.seoTitle !== "string" || typeof pack.seoDescription !== "string" || !Array.isArray(pack.keywords)) {
    throw new Error("ملحقات التحرير الشامل ناقصة؛ أعد المحاولة.");
  }
  const title = (pack.title ?? clipped.title).trim() || clipped.title;
  const excerpt = (pack.excerpt ?? "").trim();
  const seoTitle = (pack.seoTitle ?? "").trim();
  const seoDescription = (pack.seoDescription ?? "").trim();
  const keywords = (pack.keywords ?? [])
    .filter((keyword): keyword is string => typeof keyword === "string")
    .map((keyword) => keyword.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 8);

  options.onFullEditProgress?.("guard_checking");

  const fullEdit: FullEditResult = {
    title: { text: title, guard: guardCheck(title, "title", settings.governance.editorialGuard) },
    excerpt: { text: excerpt, guard: guardCheck(excerpt, "fragment", settings.governance.editorialGuard) },
    body: { text: bodyText, guard: guardCheck(bodyText, "body", settings.governance.editorialGuard) },
    seo: {
      seoTitle,
      seoDescription,
      keywords,
      guard: guardCheck(`${seoTitle} ${seoDescription} ${keywords.join(" ")}`, "fragment", settings.governance.editorialGuard),
    },
    classify: {
      seriesSlug: pack.seriesSlug ?? null,
      section: pack.section ?? "news",
      format: pack.format ?? "news",
    },
  };

  options.onFullEditProgress?.("complete");

  return {
    suggestions: [],
    fullEdit,
    usage: {
      model: bodyModel,
      inputTokens: bodyResult.usage.inputTokens + packResult.usage.inputTokens,
      outputTokens: bodyResult.usage.outputTokens + packResult.usage.outputTokens,
    },
    usages: [bodyResult.usage, packResult.usage],
  };
}

export async function runEditorialTool(
  tool: AiTool,
  input: { title: string; body: string; selection?: string },
  settings: AiSettingsData,
  options: EditorialRunOptions = {},
): Promise<AiResult> {
  const anthropic = client();
  if (!anthropic) {
    throw new Error(missingTextKeyMessage());
  }

  if (tool === "full_edit") {
    return runFullEdit(anthropic, input, settings, options);
  }

  const model = modelFor(tool, settings);
  const { text: raw, usage, stopReason } = await complete(anthropic, {
    model,
    maxTokens: tool === "proofread" ? 8192 : 2048,
    tone: settings.tone,
    editorialGuard: settings.governance.editorialGuard,
    user: TOOL_PROMPTS[tool](input),
    signal: options.signal,
    onUsage: options.onUsage,
    onUnmeasured: options.onUnmeasured,
  });

  if (stopReason === "max_tokens") {
    throw new Error("مخرج النموذج انقطع قبل الاكتمال — قصّر المادة أو أعد المحاولة.");
  }

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
    parsed = parseJsonObject(raw) as typeof parsed;
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

  const cleanKeywords = (Array.isArray(parsed.keywords) ? parsed.keywords : [])
    .filter((keyword): keyword is string => typeof keyword === "string")
    .map((keyword) => keyword.replace(/^#/, "").trim())
    .filter(Boolean)
    .slice(0, 8);

  if (tool === "metadata") {
    const excerpt = typeof parsed.excerpt === "string" ? parsed.excerpt.trim() : "";
    const seoTitle = typeof parsed.seoTitle === "string" ? parsed.seoTitle.trim() : "";
    const seoDescription = typeof parsed.seoDescription === "string" ? parsed.seoDescription.trim() : "";
    const sections = ["politics", "economy", "world", "ksa", "current-events", "health", "technology", "sciences", "sport", "business", "art", "culture", "varieties", "news"];
    const formats = ["news", "infographics", "videos", "reports", "podcasts"];
    const series = ["absat", "aghrab", "efhamha-sah", "bel-arqam", "shakhsiat", "limatha", "matha-law", "bel-tarikh"];
    if (!excerpt || excerpt.length > 180 || !seoTitle || seoTitle.length > 60 || !seoDescription || seoDescription.length > 155
      || !cleanKeywords.length || !sections.includes(parsed.section ?? "") || !formats.includes(parsed.format ?? "")
      || (parsed.seriesSlug !== null && !series.includes(parsed.seriesSlug ?? ""))) {
      throw new Error("ملحقات المادة ناقصة أو تجاوزت الحدود المطلوبة. أعد التوليد.");
    }
    return { suggestions: [], usage, metadata: {
      excerpt: { text: excerpt, guard: guardCheck(excerpt, "fragment", settings.governance.editorialGuard) },
      seo: { seoTitle, seoDescription, keywords: [...new Set(cleanKeywords)], guard: guardCheck(`${seoTitle} ${seoDescription} ${cleanKeywords.join(" ")}`, "fragment", settings.governance.editorialGuard) },
      classify: { section: parsed.section!, format: parsed.format!, seriesSlug: parsed.seriesSlug ?? null },
    } };
  }

  if (tool === "seo") {
    const seoTitle = (parsed.seoTitle ?? "").trim();
    const seoDescription = (parsed.seoDescription ?? "").trim();
    return {
      suggestions: [],
      seo: {
        seoTitle,
        seoDescription,
        keywords: cleanKeywords,
        guard: guardCheck(`${seoTitle} ${seoDescription} ${cleanKeywords.join(" ")}`, "fragment", settings.governance.editorialGuard),
      },
      usage,
    };
  }

  const texts = (parsed.suggestions ?? []).filter(Boolean).slice(0, 3);
  return {
    suggestions: texts.map((text) => ({
      text,
      guard: guardCheck(text, tool === "headlines" ? "title" : "fragment", settings.governance.editorialGuard),
    })),
    usage,
  };
}
