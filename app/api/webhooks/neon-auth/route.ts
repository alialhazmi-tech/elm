import {
  accountEmailConfigured,
  deliverAccountEmail,
} from "@/lib/membership/email/delivery";
import {
  prepareNeonAccountEmail,
  verifyNeonEmailWebhook,
} from "@/lib/membership/email/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const response = (status: number) =>
  new Response(null, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

export async function POST(request: Request) {
  const base = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.ACCOUNT_EMAIL_RECEIPT_SECRET ?? "";
  if (!accountEmailConfigured() || !base || secret.length < 32)
    return response(503);
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    return response(415);
  if (Number(request.headers.get("content-length")) > 32_768)
    return response(413);
  const reader = request.body?.getReader();
  if (!reader) return response(400);
  let raw: string;
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32_768) {
        await reader.cancel();
        return response(413);
      }
      chunks.push(value);
    }
    raw = new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks),
    );
  } catch {
    return response(400);
  }
  let payload: unknown;
  try {
    payload = await verifyNeonEmailWebhook(raw, request.headers, base);
  } catch (error) {
    return response(
      error instanceof Error && error.message === "WEBHOOK_KEYS_UNAVAILABLE"
        ? 503
        : 401,
    );
  }
  let message;
  try {
    message = prepareNeonAccountEmail(payload, secret);
  } catch {
    return response(422);
  }
  try {
    await deliverAccountEmail(
      message.to,
      message.email,
      message.idempotencyKey,
    );
    return response(204);
  } catch {
    console.error("ACCOUNT_EMAIL_WEBHOOK_DELIVERY_FAILED");
    return response(503);
  }
}
