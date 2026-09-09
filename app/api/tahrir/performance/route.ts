import { createHash } from 'node:crypto';
import { readingOrigin } from '@/lib/personalization/reading-input';
import { requireActor } from '@/lib/tahrir/access';
import { dashboardPerformanceRoute, performanceInput } from '@/lib/performance/protocol';
import { createPerformanceLimiter } from '@/lib/performance/limit';

export const runtime = 'nodejs';
const allow = createPerformanceLimiter();
const response = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  if (!readingOrigin(request)) return response(403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return response(415);
  const network = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allow(createHash('sha256').update(network).digest('hex'))) return response(429);
  const reader = request.body?.getReader();
  if (!reader) return response(400);
  let bytes = 0, body = '';
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 4096) { await reader.cancel(); return response(413); }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
  } catch { return response(400); }
  finally { reader.releaseLock(); }
  const gate = await requireActor(); if (!gate.ok) return gate.response;
  const input = performanceInput(await Promise.resolve().then(() => JSON.parse(body)).catch(() => null), Date.now(), dashboardPerformanceRoute);
  if (!input) return response(400);
  for (const metric of input) {
    console.info(JSON.stringify({ event: 'dashboard-performance', ...metric,
      release: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 40) ?? 'local',
      receivedAt: Date.now() }));
  }
  return response(204);
}
