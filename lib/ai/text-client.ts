import Anthropic from "@anthropic-ai/sdk";
import { aiProvider, openRouterKey } from "./provider-config.ts";

/** واجهة Messages الأصلية على OpenRouter تحفظ عقود التحرير ومراحل التقدم الحالية. */
export function textClient(): Anthropic | null {
  if (aiProvider() === "openrouter") {
    const key = openRouterKey();
    if (!key) return null;
    return new Anthropic({
      apiKey: null,
      authToken: key,
      baseURL: "https://openrouter.ai/api",
      maxRetries: 0,
      timeout: 120_000,
      defaultHeaders: { "HTTP-Referer": "https://alelm.net", "X-OpenRouter-Title": "Al Elm" },
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        if (response.ok) return response;
        // لا نمرر تفاصيل المزود الخام إلى المحرر أو السجلات.
        await response.body?.cancel();
        return Response.json({ error: { type: "provider_error", message: `OpenRouter رفض الطلب (${response.status}). راجع الرصيد والمفتاح والنموذج في إعدادات التشغيل.` } }, { status: response.status });
      },
    });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? new Anthropic({ apiKey, baseURL: "https://api.anthropic.com", maxRetries: 0, timeout: 120_000 }) : null;
}
