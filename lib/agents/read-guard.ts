import { createHash } from "node:crypto";
import { isIP } from "node:net";

/** Bounded, per-process overload protection; no persistent identity or account state. */
export class PublicReadLimiter {
  private clients = new Map<string, number>();
  private start = 0;
  private total = 0;
  private active = 0;
  take(key: string, now = Date.now()): { release: () => void } | null {
    if (now - this.start >= 60_000) { this.start = now; this.total = 0; this.clients.clear(); }
    const count = this.clients.get(key) ?? 0;
    if (this.total >= 600 || count >= 60 || this.active >= 8
      || (!this.clients.has(key) && this.clients.size >= 512)) return null;
    this.total++; this.clients.set(key, count + 1); this.active++;
    let released = false;
    return { release: () => { if (!released) { released = true; this.active--; } } };
  }
}

const processState = globalThis as typeof globalThis & { __alelmPublicReadLimiter?: PublicReadLimiter };
const limiter = processState.__alelmPublicReadLimiter ??= new PublicReadLimiter();

export function publicReadGuard(request: Request) {
  // proxy.ts replaces this header only after verifying the Cloudflare origin secret.
  // Without origin enforcement, do not let clients choose their own rate-limit key.
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = process.env.ORIGIN_AUTH_ENFORCE === "1" && isIP(forwarded) ? forwarded : "unverified";
  const key = createHash("sha256").update(ip).digest("hex");
  const slot = limiter.take(key);
  return slot ?? Response.json({ error: "Public content rate limit exceeded; retry shortly" }, {
    status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" },
  });
}
