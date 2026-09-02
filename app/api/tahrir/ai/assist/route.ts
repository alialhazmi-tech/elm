import { NextResponse } from "next/server";

import {
  AI_TOOLS,
  runEditorialTool,
  type AiResult,
  type AiTool,
  type FullEditProgressStage,
} from "@/lib/ai/editorial";
import { loadAiSettings, type AiSettingsData } from "@/lib/ai/settings";
import { budgetGate, costCents, logUsage } from "@/lib/ai/usage";
import { requirePermission } from "@/lib/tahrir/access";
import { audit } from "@/lib/tahrir/service";

interface EditorialInput {
  title: string;
  body: string;
  selection?: string;
}

async function recordUsage(tool: AiTool, result: AiResult, actor: string) {
  const parts = result.usages ?? [result.usage];
  const cents = parts.reduce(
    (sum, part) => sum + costCents(part.model, part.inputTokens, part.outputTokens),
    0,
  );
  await logUsage({
    tool,
    model: parts.map((part) => part.model).join("+"),
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    costCents: cents,
    actor,
  });
  await audit(actor, `ai:${tool}`, undefined, `${parts.map((part) => part.model).join("+")} · ${cents}¢`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "تعذر الاستدعاء.";
}

function streamFullEdit(
  request: Request,
  input: EditorialInput,
  settings: AiSettingsData,
  actor: string,
) {
  const encoder = new TextEncoder();
  let firstEvent = true;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: Record<string, unknown>) => {
        if (closed) return;
        const payload = firstEvent ? { ...event, padding: " ".repeat(1100) } : event;
        firstEvent = false;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        } catch {
          closed = true;
        }
      };

      try {
        const result = await runEditorialTool("full_edit", input, settings, {
          signal: request.signal,
          onFullEditProgress: (stage: FullEditProgressStage) => send({ type: "progress", stage }),
        });
        await recordUsage("full_edit", result, actor);
        send({ type: "result", data: { ok: true, ...result } });
      } catch (error) {
        if (!request.signal.aborted) send({ type: "error", error: errorMessage(error) });
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // أُغلق الاتصال من العميل؛ request.signal يوقف استدعاء النموذج.
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-store, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** مساعد التحرير — بوابة واحدة لكل الأدوات، بسقوف الخادم وحارس السياسة. */
export async function POST(request: Request) {
  const access = await requirePermission("ai.assist");
  if (!access.ok) return access.response;
  const session = access.actor;

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

  const normalizedInput: EditorialInput = {
    title: (input?.title ?? "").slice(0, 500),
    body: (input?.body ?? "").slice(0, 40_000),
    selection: input?.selection?.slice(0, 8_000),
  };

  if (tool === "full_edit" && request.headers.get("accept")?.includes("application/x-ndjson")) {
    return streamFullEdit(request, normalizedInput, settings, session.username);
  }

  try {
    const result = await runEditorialTool(tool, normalizedInput, settings, { signal: request.signal });
    await recordUsage(tool, result, session.username);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = errorMessage(error);
    const status = message.includes("غير مضبوط") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
