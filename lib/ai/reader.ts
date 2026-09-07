/**
 * أدوات القارئ داخل المادة — Haiku 4.5 فقط.
 * تقترح فهمًا للمادة المنشورة ولا تنشر ولا تخزّن نص المحادثة في ملف التخصيص.
 */

import { textClient as client } from "./text-client.ts";

import { runPolicyGuard } from "@/lib/policy";
import { loadAiSettings } from "@/lib/ai/settings";
import { budgetGate, costCents, logUsage } from "@/lib/ai/usage";
import { seedContentProvider } from "@/lib/content/provider";
import { stripHtmlToText } from "@/lib/content/html";
import { parseReaderSummary, readerSummaryInstructions } from "./summary-editorial";

export type ReaderTool = "summary" | "simplify" | "discuss";



function plainBody(title: string, body: string): string {
  return `العنوان للسياق: ${title}\n\nالمتن الكامل:\n${body}`;
}

function promptFor(tool: ReaderTool, article: string, question?: string): string {
  if (tool === "summary") {
    return `${readerSummaryInstructions}\n\n${article}`;
  }
  if (tool === "simplify") {
    return `أعد صياغة هذه المادة بلغة أبسط للقارئ غير المتخصص، مع حفظ كل الحقائق والأرقام والأسماء كما هي. لا تضف معلومة.\n\n${article}`;
  }
  return `أجب عن سؤال القارئ من نص المادة فقط. إن لم يكن الجواب في النص فقل ذلك صراحة. لا تضف معلومة خارجية.\n\nالمادة:\n${article}\n\nسؤال القارئ:\n${(question ?? "").slice(0, 400)}`;
}

export async function runReaderTool(
  tool: ReaderTool,
  storyId: string,
  question?: string,
): Promise<{ text: string; points?: string[] } | { error: string; status: number }> {
  const anthropic = client();
  if (!anthropic) {
    return { error: "خدمة الذكاء غير مهيأة في هذه البيئة.", status: 503 };
  }

  const story = await seedContentProvider.getStory(storyId);
  if (!story) return { error: "المادة غير متاحة.", status: 404 };
  const body = stripHtmlToText(story.body ?? "").replace(/\s+/gu, " ").trim();
  if (!body) return { error: "متن المادة غير متاح لإعداد خلاصة دقيقة.", status: 422 };
  if (body.length > 40_000) return { error: "المادة أطول من الحد المتاح للتحليل الكامل حاليًا.", status: 422 };

  const settings = await loadAiSettings();
  const gate = await budgetGate(settings.caps, 20);
  if (!gate.ok) return { error: gate.reason ?? "بلغ استهلاك الذكاء سقفه.", status: 429 };

  const article = plainBody(story.title, body);
  const response = await anthropic.messages.create({
    model: settings.models.light,
    max_tokens: 800,
    system:
      "أنت مساعد قراءة في منصة العلم. تشرح المادة المنشورة للقارئ ولا تنشر ولا تعدّل الأصل. التزم الدستور: بلا تهويل، الأرقام كما وردت، لا معلومة جديدة.",
    messages: [{ role: "user", content: promptFor(tool, article, question) }],
  });

  const raw = (response.content.find((block) => block.type === "text")?.text ?? "").trim();
  await logUsage({
      reservationId: gate.reservationId,
    tool: `reader_${tool}`,
    model: settings.models.light,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    costCents: costCents(settings.models.light, response.usage.input_tokens, response.usage.output_tokens),
    actor: "member",
  });

  if (response.stop_reason === "max_tokens") return { error: "لم تكتمل الخلاصة. أعد المحاولة.", status: 502 };
  if (!raw) return { error: "تعذر توليد النص. حاول مرة أخرى.", status: 502 };
  const points = tool === "summary" ? parseReaderSummary(raw) : undefined;
  if (points === null) return { error: "تعذر إعداد الملخص في ثلاث نقاط واضحة. أعد المحاولة.", status: 502 };
  const text = points ? points.map(point => `• ${point}`).join("\n") : raw;
  const guard = settings.governance.editorialGuard ? runPolicyGuard({ body: text }) : null;
  const blocked = guard?.findings.some(
    (finding) => finding.severity === "blocking" && finding.ruleId !== "BODY-WORD-RANGE",
  );
  if (blocked) {
    return { error: "تعذر عرض المخرج لأنه لم يجتز سياسة التحرير.", status: 422 };
  }
  return points ? { text, points } : { text };
}
