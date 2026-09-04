/** حدود النبضة العامة: زمن تراكمي، لا دلتا قابلة للتكرار. */
export const READING_COOKIE = "alelm-reader";
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function readingInput(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.storyId !== "string" || !/^[\w-]{1,100}$/.test(v.storyId)) return null;
  if (typeof v.sessionId !== "string" || !UUID.test(v.sessionId)) return null;
  if (typeof v.activeMs !== "number" || !Number.isFinite(v.activeMs) || v.activeMs < 0) return null;
  if (typeof v.progress !== "number" || !Number.isFinite(v.progress) || v.progress < 0 || v.progress > 100) return null;
  return { storyId: v.storyId, sessionId: v.sessionId, activeMs: Math.min(7_200_000, Math.floor(v.activeMs)), progress: Math.floor(v.progress) };
}
