import { runReaderTool, type ReaderTool } from "@/lib/ai/reader";
import { getSessionMemberId, persistStatsAndSignal, privateJson } from "@/lib/personalization";

import { consumeLimit } from "@/lib/tahrir/rate-limit";

const TOOLS: Record<string, ReaderTool> = {
  summary: "summary",
  simplify: "simplify",
  discuss: "discuss",
};

const EVENT: Record<ReaderTool, "ai_summary" | "ai_simplify" | "ai_discuss"> = {
  summary: "ai_summary",
  simplify: "ai_simplify",
  discuss: "ai_discuss",
};

export async function POST(request: Request) {
  const memberId = await getSessionMemberId();
  if (!memberId) return privateJson({ error: "يلزم تسجيل الدخول" }, 401);
  const body = (await request.json().catch(() => null)) as {
    tool?: string;
    storyId?: string;
    question?: string;
    memberId?: string;
  } | null;
  void body?.memberId;
  const tool = TOOLS[String(body?.tool ?? "")];
  const storyId = String(body?.storyId ?? "");
  if (!tool || !storyId) return privateJson({ error: "أداة أو مادة غير صالحة" }, 400);

  const question = tool === "discuss" ? String(body?.question ?? "").trim() : undefined;
  if (tool === "discuss" && (!question || question.length < 4)) {
    return privateJson({ error: "اكتب سؤالًا قصيرًا عن المادة." }, 400);
  }

  try {
    if (!await consumeLimit("reader-ai", memberId, 30, 86400)) return privateJson({ error: "وصلت إلى حد أدوات القراءة اليوم. حاول لاحقًا." }, 429);
    const result = await runReaderTool(tool, storyId, question);
    if ("error" in result) return privateJson({ error: result.error }, result.status);
    await persistStatsAndSignal(memberId, storyId, EVENT[tool], new Date().toISOString());
    return privateJson({ text: result.text });
  } catch {
    return privateJson({ error: "تعذر تشغيل الأداة الآن." }, 502);
  }
}
