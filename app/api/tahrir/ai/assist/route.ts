import { NextResponse } from "next/server";

import {
  AI_TOOLS,
  editorialReservationCents,
  type Usage,
  runEditorialTool,
  type AiResult,
  type AiTool,
  type FullEditProgressStage,
} from "@/lib/ai/editorial";
import { textClient } from "@/lib/ai/text-client";
import { missingTextKeyMessage } from "@/lib/ai/provider-config";
import { loadAiSettings, type AiSettingsData } from "@/lib/ai/settings";
import { budgetGate, costCents, logUsage } from "@/lib/ai/usage";
import { requirePermission } from "@/lib/tahrir/access";
import { audit } from "@/lib/tahrir/service";

interface EditorialInput {
  title: string;
  body: string;
  selection?: string;
}

async function recordUsage(tool: AiTool, result: AiResult, actor: string, reservationId?: string) {
  const parts = result.usages ?? [result.usage];
  const cents = parts.reduce(
    (sum, part) => sum + costCents(part.model, part.inputTokens, part.outputTokens),
    0,
  );
  await logUsage({
    reservationId,
    tool,
    model: parts.map((part) => part.model).join("+"),
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    costCents: cents,
    actor,
  });
  await audit(actor, `ai:${tool}`, undefined, `${parts.map((part) => part.model).join("+")} · ${cents}¢`).catch(() => console.error("AI_AUDIT_FAILED", { reservationId, tool }));
}

function errorMessage(error: unknown): string {
  const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
  if (status === 401 || status === 403) return `رفض مزوّد الذكاء مفتاح التشغيل أو صلاحية النموذج (${status}). راجع إعدادات المزوّد.`;
  if (status === 402) return "رفض مزوّد الذكاء الطلب بسبب رصيد الحساب أو حد المفتاح (402). هذا منفصل عن سقف العلم الداخلي.";
  if (status === 429) return "مزوّد الذكاء يقيّد الطلبات حاليًا (429). انتظر قليلًا ثم أعد المحاولة.";
  if (status === 400 || status === 404 || status === 422) return `رفض مزوّد الذكاء صيغة الطلب أو النموذج المحدد (${status}). راجع إعدادات النموذج.`;
  if (typeof status === "number" && status >= 500) return `تعذّر إكمال الطلب لدى مزوّد الذكاء (${status}). لم يُطبّق أي تغيير.`;
  if (error instanceof Error && /timeout/i.test(error.name)) return "انتهت مهلة الاتصال بمزوّد الذكاء. لم يُطبّق أي تغيير؛ أعد المحاولة لاحقًا.";
  if (error instanceof Error && error.name === "APIConnectionError") return "انقطع الاتصال بمزوّد الذكاء قبل اكتمال النتيجة. لم يُطبّق أي تغيير.";
  return error instanceof Error ? error.message : "تعذر الاستدعاء.";
}

/** نسوّي كل القياسات المكتملة حتى عند فشل مرحلة أخرى أو رفض المخرج. */
async function generate(tool: AiTool, input: EditorialInput, settings: AiSettingsData, actor: string, reservationId: string | undefined,
  options: { signal: AbortSignal; onFullEditProgress?: (stage: FullEditProgressStage) => void }) {
  const usages: Usage[] = [];
  let unmeasuredCents = 0;
  let result: AiResult;
  const started = Date.now();
  let stage: FullEditProgressStage | "request" = "request";
  try {
    result = await runEditorialTool(tool, input, settings, { ...options,
      onFullEditProgress: value => { stage = value; options.onFullEditProgress?.(value); },
      onUsage: usage => usages.push(usage), onUnmeasured: cents => { unmeasuredCents += cents; } });
  } catch (error) {
    await logUsage({ reservationId, tool: `${tool}:${unmeasuredCents ? "unmeasured" : "failed"}`,
      model: usages.map(part => part.model).join("+") || settings.models.fast,
      inputTokens: usages.reduce((sum, part) => sum + part.inputTokens, 0),
      outputTokens: usages.reduce((sum, part) => sum + part.outputTokens, 0),
      costCents: usages.reduce((sum, part) => sum + costCents(part.model, part.inputTokens, part.outputTokens), 0) + unmeasuredCents,
      actor,
    }).catch(() => console.error("AI_SETTLEMENT_FAILED", { reservationId, tool }));
    // لا نصوص مواد أو مفاتيح أو رسائل مزوّد خام في السجل.
    console.error("AI_GENERATION_FAILED", { reservationId, tool, elapsedMs: Date.now() - started,
      errorType: error instanceof Error ? error.name : "unknown", stage,
      providerStatus: error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : undefined,
      unmeasuredCents, completedCalls: usages.length });
    throw error;
  }
  await recordUsage(tool, result, actor, reservationId);
  return result;
}

function streamFullEdit(
  request: Request,
  input: EditorialInput,
  settings: AiSettingsData,
  actor: string,
  reservationId?: string,
) {
  const encoder = new TextEncoder();
  let firstEvent = true;
  const cancelled = new AbortController();
  const signal = AbortSignal.any([request.signal, cancelled.signal]);

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

      const heartbeat = setInterval(() => send({ type: "heartbeat" }), 10_000);
      try {
        const result = await generate("full_edit", input, settings, actor, reservationId, {
          signal,
          onFullEditProgress: (stage: FullEditProgressStage) => send({ type: "progress", stage }),
        });
        send({ type: "result", data: { ok: true, ...result } });
      } catch (error) {
        if (!request.signal.aborted) send({ type: "error", error: errorMessage(error) });
      } finally {
        clearInterval(heartbeat);
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
    cancel() { cancelled.abort(); },
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

  const normalizedInput: EditorialInput = {
    title: typeof input?.title === "string" ? input.title.slice(0, 500) : "",
    body: typeof input?.body === "string" ? input.body.slice(0, 40_000) : "",
    selection: typeof input?.selection === "string" ? input.selection.slice(0, 8_000) : undefined,
  };
  if ((tool === "headlines" || tool === "excerpt" || tool === "metadata") && !normalizedInput.body.trim()) {
    return NextResponse.json({ error: "أضف متن المادة أولًا لتوليد العنوان أو الموجز من محتواها." }, { status: 400 });
  }

  if (!normalizedInput.body.trim()) return NextResponse.json({ error: "أضف متن المادة أولًا." }, { status: 400 });
  if (!textClient()) return NextResponse.json({ error: missingTextKeyMessage() }, { status: 503 });
  if (request.signal.aborted) return new Response(null, { status: 499 });
  const gate = await budgetGate(settings.caps, editorialReservationCents(tool, normalizedInput, settings));
  if (!gate.ok) return NextResponse.json({ error: gate.reason }, { status: 429 });

  if (tool === "full_edit" && request.headers.get("accept")?.includes("application/x-ndjson")) {
    return streamFullEdit(request, normalizedInput, settings, session.username, gate.reservationId);
  }

  try {
    const result = await generate(tool, normalizedInput, settings, session.username, gate.reservationId, { signal: request.signal });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = errorMessage(error);
    const status = message.includes("غير مضبوط") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
