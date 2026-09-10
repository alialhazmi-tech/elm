/**
 * نقل المادة من المتصفح إلى API اللوحة — مشترك بين محرر المادة ومحرر جاك.
 * مهلة موحدة، expectedVersion دائمًا، ومعرّف حفظ ثابت لأول محاولة حتى لا تُنشئ
 * إعادة الطلب بعد فقدان الاستجابة مسودة مكررة. النتيجة مُنمَّطة بلا استثناءات.
 */

export const TRANSPORT_TIMEOUT_MS = 15_000;

export type TransportFailure = {
  ok: false;
  /** 0 حين لم يصل رد (انقطاع أو مهلة). */
  status: number;
  error: string;
  timedOut: boolean;
  /** جسم الخطأ كما أعاده الخادم (مثل blocking/findings من الحارس). */
  body: Record<string, unknown> | null;
};

export type TransportResult<T> = { ok: true; data: T } | TransportFailure;

export interface SavedStory {
  scheduledAt?: string;
  id: string;
  version: number;
  status: string;
  revisionOf: string | null;
  slug: string;
  section: string;
}

export interface TransitionResult {
  version: number;
  id?: string;
}

export type TransitionRoute = "submit" | "publish" | "schedule" | "archive" | "restore";

interface CallOptions {
  timeoutMs?: number;
  /** رسالة الفشل حين لا يشرح الخادم السبب. */
  fallback: string;
}

async function postJson<T>(url: string, payload: Record<string, unknown>, options: CallOptions): Promise<TransportResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(options.timeoutMs ?? TRANSPORT_TIMEOUT_MS),
      body: JSON.stringify(payload),
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    return { ok: false, status: 0, error: options.fallback, timedOut, body: null };
  }
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const error = data && typeof data.error === "string" && data.error.trim() ? data.error : options.fallback;
    return { ok: false, status: response.status, error, timedOut: false, body: data };
  }
  return { ok: true, data: (data ?? {}) as T };
}

/** معرّف ثابت لأول محاولة حفظ؛ يبقى حتى يؤكد الخادم الهوية. */
export const newSaveId = () => crypto.randomUUID();

export interface SaveStoryInput extends Record<string, unknown> {
  id: string;
  expectedVersion: number;
}

/** حفظ المسودة؛ يتحقق أن الرد يحمل هوية ونسخة رقمية. */
export async function saveStory(payload: SaveStoryInput, options: { timeoutMs?: number; fallback?: string } = {}): Promise<TransportResult<SavedStory>> {
  const fallback = options.fallback ?? "تعذر الحفظ. بقيت تعديلاتك في المحرر؛ أعد محاولة حفظ المسودة.";
  const result = await postJson<SavedStory>("/api/tahrir/story", payload, { timeoutMs: options.timeoutMs, fallback });
  if (!result.ok) return result;
  if (typeof result.data.id !== "string" || typeof result.data.version !== "number") {
    return { ok: false, status: 0, error: fallback, timedOut: false, body: null };
  }
  return result;
}

/** انتقالات سير الاعتماد — مسار واحد لكل إجراء. */
export function transitionStory(
  route: TransitionRoute,
  payload: { id: string; expectedVersion?: number; reason?: string },
  options: { timeoutMs?: number; fallback?: string } = {},
): Promise<TransportResult<TransitionResult>> {
  return postJson<TransitionResult>(`/api/tahrir/story/${route}`, payload, {
    timeoutMs: options.timeoutMs,
    fallback: options.fallback ?? "تعذر إتمام الإجراء. تحقق من حالة المادة في تبويب آخر قبل إعادة المحاولة.",
  });
}

export function scheduleStory(
  payload: { id: string; expectedVersion: number; scheduledAt: string },
  options: { timeoutMs?: number } = {},
): Promise<TransportResult<TransitionResult>> {
  return transitionStory("schedule", payload, { timeoutMs: options.timeoutMs, fallback: "تعذرت الجدولة." });
}

/** استدعاء عام لمسارات اللوحة الأخرى بالمهلة نفسها (شرائح جاك مثلًا). */
export function postDashboardJson<T>(url: string, payload: Record<string, unknown>, fallback: string, timeoutMs?: number): Promise<TransportResult<T>> {
  return postJson<T>(url, payload, { fallback, timeoutMs });
}
