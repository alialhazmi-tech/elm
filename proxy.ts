import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { originAccess, ORIGIN_TOKEN_HEADER } from "@/lib/security/origin-access";
import { contentSecurityPolicy } from "@/lib/security/csp";
import { brokenStoryRedirect } from "@/lib/seo/broken-story-url";
import { markdownPath, prefersMarkdown } from "@/lib/agents/discovery";

export function proxy(request: NextRequest) {
  const access = originAccess(request, {
    enforced: process.env.ORIGIN_AUTH_ENFORCE === "1",
    secret: process.env.ORIGIN_AUTH_SECRET,
    cronSecret: process.env.CRON_SECRET,
  });
  if (!access.allowed) return new NextResponse(access.status === 503 ? "الخدمة غير مهيأة." : "الوصول غير مسموح.", {
    status: access.status, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
  const repaired = brokenStoryRedirect(request.nextUrl.pathname);
  if (repaired) return NextResponse.redirect(new URL(repaired + request.nextUrl.search, request.url), 308);
  const headers = new Headers(request.headers);
  headers.delete(ORIGIN_TOKEN_HEADER);
  headers.delete("x-nonce");
  headers.delete("content-security-policy");
  headers.delete("x-alelm-markdown-path");
  if (access.clientIp) headers.set("x-forwarded-for", access.clientIp);
  const negotiable = markdownPath(request.nextUrl.pathname);
  const markdown = negotiable && ["GET", "HEAD"].includes(request.method)
    && !request.headers.has("rsc") && !request.headers.has("next-router-prefetch")
    && prefersMarkdown(request.headers.get("accept"));
  // A relative config rewrite stays inside Next. Absolute proxy rewrites can
  // re-enter the origin guard after Next normalizes loopback hostnames.
  if (markdown) headers.set("x-alelm-markdown-path", request.nextUrl.pathname);
  const editorial = request.nextUrl.pathname === "/tahrir" || request.nextUrl.pathname.startsWith("/tahrir/");
  const nonce = editorial ? randomBytes(24).toString("base64") : undefined;
  const policy = nonce ? contentSecurityPolicy(process.env.NODE_ENV !== "production", nonce) : undefined;
  if (nonce && policy) {
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", policy);
  }
  const response = NextResponse.next({ request: { headers } });
  if (negotiable) response.headers.set("Vary", "Accept");
  if (markdown) response.headers.set("Cache-Control", "private, no-store");
  if (policy) {
    response.headers.set("Content-Security-Policy", policy);
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}
// بلا استثناء assets/prefetch: حارس الأصل يحمي كل المسارات، وnonce يخص التحرير فقط.
