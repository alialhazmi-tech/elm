/**
 * نقل موحّد لطلبات لوحة التحرير من المتصفح: JSON في الاتجاهين، مهلة، رسائل عربية لأعطال الشبكة والمهلة
 * والاستجابة غير المفهومة، ولا يرمي أبدًا — النتيجة كائن مميّز يقرؤه المستدعي.
 * المحرر له نقله الخاص (بث NDJSON وحماية الإصدارات) ولا يمرّ من هنا.
 */

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string };

export interface ApiInit extends Omit<RequestInit, "body"> {
  /** كائن يُسلسل JSON تلقائيًا؛ FormData أو نص يُمرَّران كما هما. */
  body?: unknown;
}

export interface ApiOptions {
  /** المهلة بالمللي ثانية — الافتراضي 15 ثانية. */
  timeoutMs?: number;
  /** الرسالة عند فشل الخادم بلا `error` مقروء (تُبقي نص الشاشة كما كان). */
  fallback?: string;
}

export const API_MESSAGES = {
  network: "تعذر الاتصال بالخادم. تحقق من الشبكة وأعد المحاولة.",
  timeout: "انتهت مهلة الطلب. أعد المحاولة.",
  parse: "استجابة غير مفهومة من الخادم.",
  generic: "تعذر تنفيذ الطلب.",
} as const;

const STATUS_MESSAGES: Record<number, string> = {
  401: "انتهت الجلسة — سجّل الدخول مجددًا.",
  403: "لا تملك صلاحية هذا الإجراء.",
  404: "العنصر المطلوب غير موجود.",
  409: "تعارض مع نسخة أحدث — حدّث الصفحة.",
  413: "الحجم أكبر من المسموح.",
  429: "طلبات كثيرة — انتظر قليلًا ثم أعد المحاولة.",
};

function statusMessage(status: number, fallback?: string): string {
  if (fallback) return fallback;
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (status >= 500) return "خطأ في الخادم. أعد المحاولة لاحقًا.";
  return API_MESSAGES.generic;
}

function isPlainBody(body: unknown): boolean {
  if (body === null || typeof body !== "object") return false;
  if (typeof FormData !== "undefined" && body instanceof FormData) return false;
  if (typeof Blob !== "undefined" && body instanceof Blob) return false;
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) return false;
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return false;
  return true;
}

export async function apiCall<T = unknown>(
  url: string,
  init: ApiInit = {},
  { timeoutMs = 15_000, fallback }: ApiOptions = {},
): Promise<ApiResult<T>> {
  const { body, headers, signal, ...rest } = init;
  const finalHeaders = new Headers(headers);
  let finalBody: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (isPlainBody(body)) {
      finalBody = JSON.stringify(body);
      if (!finalHeaders.has("Content-Type")) finalHeaders.set("Content-Type", "application/json");
    } else {
      finalBody = body as BodyInit;
    }
  }
  if (!finalHeaders.has("Accept")) finalHeaders.set("Accept", "application/json");

  const timeout = AbortSignal.timeout(timeoutMs);
  const finalSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(url, { ...rest, headers: finalHeaders, body: finalBody, signal: finalSignal, cache: rest.cache ?? "no-store" });
  } catch (error) {
    const timedOut = timeout.aborted || (error instanceof Error && error.name === "TimeoutError");
    return { ok: false, status: timedOut ? 408 : 0, error: timedOut ? API_MESSAGES.timeout : API_MESSAGES.network };
  }

  let text = "";
  try {
    text = await response.text();
  } catch {
    return { ok: false, status: response.status, error: timeout.aborted ? API_MESSAGES.timeout : API_MESSAGES.parse };
  }

  let data: unknown = null;
  if (text.trim().length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      return {
        ok: false,
        status: response.status,
        error: response.ok ? API_MESSAGES.parse : statusMessage(response.status, fallback),
      };
    }
  }

  if (response.ok) return { ok: true, status: response.status, data: data as T };

  const serverError =
    data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
      ? ((data as { error: string }).error.trim() || null)
      : null;
  return { ok: false, status: response.status, error: serverError ?? statusMessage(response.status, fallback) };
}
