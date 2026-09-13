import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { originAccess, ORIGIN_TOKEN_HEADER } from "@/lib/security/origin-access";
import { contentSecurityPolicy } from "@/lib/security/csp";

export function proxy(request: NextRequest) {
  const access = originAccess(request, {
    enforced: process.env.ORIGIN_AUTH_ENFORCE === "1",
    secret: process.env.ORIGIN_AUTH_SECRET,
    cronSecret: process.env.CRON_SECRET,
  });
  if (!access.allowed) return new NextResponse(access.status === 503 ? "الخدمة غير مهيأة." : "الوصول غير مسموح.", {
    status: access.status, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
  const headers = new Headers(request.headers);
  headers.delete(ORIGIN_TOKEN_HEADER);
  headers.delete("x-nonce");
  headers.delete("content-security-policy");
  if (access.clientIp) headers.set("x-forwarded-for", access.clientIp);
  const editorial = request.nextUrl.pathname === "/tahrir" || request.nextUrl.pathname.startsWith("/tahrir/");
  const nonce = editorial ? randomBytes(24).toString("base64") : undefined;
  const policy = nonce ? contentSecurityPolicy(process.env.NODE_ENV !== "production", nonce) : undefined;
  if (nonce && policy) {
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", policy);
  }
  const response = NextResponse.next({ request: { headers } });
  if (policy) {
    response.headers.set("Content-Security-Policy", policy);
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}
// بلا استثناء assets/prefetch: حارس الأصل يحمي كل المسارات، وnonce يخص التحرير فقط.
