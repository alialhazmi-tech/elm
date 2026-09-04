/**
 * أدوات القارئ داخل المادة — Haiku 4.5 فقط.
 * تقترح فهمًا للمادة المنشورة ولا تنشر ولا تخزّن نص المحادثة في ملف التخصيص.
 */

import Anthropic from "@anthropic-ai/sdk";

import { runPolicyGuard } from "@/lib/policy";
import { loadAiSettings } from "@/lib/ai/settings";
import { budgetGate, costCents, logUsage } from "@/lib/ai/usage";
import { seedContentProvider } from "@/lib/content/provider";

export type ReaderTool = "summary" | "simplify" | "discuss";

function client(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? new Anthropic({ apiKey }) : null;
}

function plainBody(title: string, excerpt: string, body?: string): string {
  const raw = `${title}\n${excerpt}\n${body ?? ""}`;
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 6000);
}

function promptFor(tool: ReaderTool, article: string, question?: string): string {
  if (tool === "summary") {
    return `لخّص هذه المادة المنشورة في 4 إلى 6 جمل عربية واضحة. لا تضف معلومة غير موجودة في النص، ولا تُصدر حكمًا، ولا تدعُ إلى إجراء.\n\n${article}`;
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
): Promise<{ text: string } | { error: string; status: number }> {
  const anthropic = client();
  if (!anthropic) {
    return { error: "خدمة الذكاء غير مهيأة في هذه البيئة.", status: 503 };
  }

  const story = await seedContentProvider.getStory(storyId);
  if (!story) return { error: "المادة غير متاحة.", status: 404 };

  const settings = await loadAiSettings();
  const gate = await budgetGate(settings.caps);
  if (!gate.ok) return { error: gate.reason ?? "بلغ استهلاك الذكاء سقفه.", status: 429 };

  const article = plainBody(story.title, story.excerpt, story.body);
  const response = await anthropic.messages.create({
    model: settings.models.light,
    max_tokens: 800,
    system:
      "أنت مساعد قراءة في منصة العلم. تشرح المادة المنشورة للقارئ ولا تنشر ولا تعدّل الأصل. التزم الدستور: بلا تهويل، الأرقام كما وردت، لا معلومة جديدة.",
    messages: [{ role: "user", content: promptFor(tool, article, question) }],
  });

  const text = (response.content.find((block) => block.type === "text")?.text ?? "").trim();
  await logUsage({
    tool: `reader_${tool}`,
    model: settings.models.light,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    costCents: costCents(settings.models.light, response.usage.input_tokens, response.usage.output_tokens),
    actor: "member",
  });

  if (!text) return { error: "تعذر توليد النص. حاول مرة أخرى.", status: 502 };
  const guard = settings.governance.editorialGuard ? runPolicyGuard({ body: text }) : null;
  const blocked = guard?.findings.some(
    (finding) => finding.severity === "blocking" && finding.ruleId !== "BODY-WORD-RANGE",
  );
  if (blocked) {
    return { error: "تعذر عرض المخرج لأنه لم يجتز سياسة التحرير.", status: 422 };
  }
  return { text };
}
