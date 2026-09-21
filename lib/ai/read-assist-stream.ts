import type { AiResult } from "./editorial";
import { readAssistResponse } from "./read-assist-response.ts";

/** ترويسة القبول التي تطلب من مساعد التحرير بثّ NDJSON مع نبضات بدل رد صامت طويل. */
export const ASSIST_STREAM_ACCEPT = "application/x-ndjson";

export type AssistStreamEvent = {
  type?: string;
  stage?: string;
  error?: string;
  data?: Partial<AiResult> & { ok?: boolean };
};

const INVALID_STREAM = "وصل رد غير صالح من المساعد. أعد التوليد، وإذا تكرر الخطأ فأبلغ الدعم.";

/**
 * يقرأ بثّ المساعد (نبضات، تقدم، نتيجة أو خطأ) سطرًا سطرًا.
 * الرد غير المبثوث (JSON عادي أو صفحة وسيط أو خطأ HTTP) يمرّ على `readAssistResponse` بالرسائل العربية نفسها.
 */
export async function readAssistStream(
  response: Response,
  onEvent?: (event: AssistStreamEvent) => void,
): Promise<Partial<AiResult>> {
  const body = response.body;
  const streamed = response.ok && body && /x-ndjson/i.test(response.headers.get("content-type") ?? "");
  if (!streamed || !body) return readAssistResponse(response);

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: Partial<AiResult> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    if (done && buffer.trim()) { lines.push(buffer); buffer = ""; }

    for (const line of lines) {
      if (!line.trim()) continue;
      let event: AssistStreamEvent;
      try {
        const parsed: unknown = JSON.parse(line);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(INVALID_STREAM);
        event = parsed as AssistStreamEvent;
      } catch {
        throw new Error(INVALID_STREAM);
      }
      if (event.type === "error") throw new Error(event.error?.trim() || "تعذّر إكمال التوليد. أعد المحاولة بعد قليل.");
      if (event.type === "result") {
        if (!event.data || typeof event.data !== "object" || Array.isArray(event.data)) throw new Error(INVALID_STREAM);
        result = event.data;
      } else if (event.type === "progress") {
        onEvent?.(event);
      }
    }
    if (done) break;
  }

  if (!result) throw new Error("انقطع الاتصال قبل وصول النتيجة. أعد التوليد.");
  return result;
}
