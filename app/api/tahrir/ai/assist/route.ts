import { NextResponse } from "next/server";

import { AI_TOOLS, runEditorialTool, type AiTool } from "@/lib/ai/editorial";
import { loadAiSettings } from "@/lib/ai/settings";
import { budgetGate, costCents, logUsage } from "@/lib/ai/usage";
import { getSession } from "@/lib/tahrir/auth";
import { audit } from "@/lib/tahrir/service";

/** مساعد التحرير — بوابة واحدة لكل الأدوات، بسقوف الخادم وحارس السياسة. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "الجلسة منتهية." }, { status: 401 });

  const input = (await request.json().catch(() => null)) as {
    tool?: string;
    title?: string;
    body?: string;
    selection?: string;
  } | null;

  const tool = input?.tool as AiTool | undefined;
  if (!tool || !AI_TOOLS.includes(tool)) {
    return NextResponse.json({ error: "أداة غير معروفة." }, { status: 400 });
  }

  const settings = await loadAiSettings();
  const toolKey = tool === "proofread" ? "proofread" : tool;
  if (!settings.tools[toolKey as keyof typeof settings.tools]) {
    return NextResponse.json({ error: "الأداة معطلة من إعدادات الذكاء." }, { status: 403 });
  }

  const gate = await budgetGate(settings.caps);
  if (!gate.ok) return NextResponse.json({ error: gate.reason }, { status: 429 });

  try {
    const result = await runEditorialTool(
      tool,
      {
        title: (input?.title ?? "").slice(0, 500),
        body: (input?.body ?? "").slice(0, 40_000),
        selection: input?.selection?.slice(0, 8_000),
      },
      settings,
    );

    const cents = costCents(result.usage.model, result.usage.inputTokens, result.usage.outputTokens);
    await logUsage({
      tool,
      model: result.usage.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costCents: cents,
      actor: session.username,
    });
    await audit(session.username, `ai:${tool}`, undefined, `${result.usage.model} · ${cents}¢`);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر الاستدعاء.";
    const status = message.includes("غير مضبوط") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
