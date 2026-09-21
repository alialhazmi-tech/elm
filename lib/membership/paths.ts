/** مسار داخلي آمن بعد الدخول — يمنع التحويل المفتوح. */
export function safeInternalPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) return null;
  if (path.startsWith("/join") || path.startsWith("/tahrir") || path.startsWith("/api")) return null;
  return path.slice(0, 220);
}
