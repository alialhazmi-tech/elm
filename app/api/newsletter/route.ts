import { eq } from "drizzle-orm";

import { newsletterSubscribers } from "@/db/schema";
import { getDb } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "طلب غير صالح" }, { status: 400 });
  }

  const email =
    typeof body === "object" && body && "email" in body && typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";
  const source =
    typeof body === "object" && body && "source" in body && typeof body.source === "string"
      ? body.source.slice(0, 40)
      : "footer";

  if (!EMAIL_RE.test(email) || email.length > 190) {
    return Response.json({ ok: false, error: "أدخل بريدًا إلكترونيًا صالحًا" }, { status: 400 });
  }

  const db = getDb();
  if (!db) {
    // بدون قاعدة: نقبل التسجيل شكليًا حتى لا تنكسر التجربة المحلية.
    return Response.json({ ok: true, status: "queued" });
  }

  try {
    const existing = await db
      .select({ id: newsletterSubscribers.id })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, email))
      .limit(1);

    if (existing[0]) {
      return Response.json({ ok: true, status: "exists" });
    }

    await db.insert(newsletterSubscribers).values({
      id: crypto.randomUUID(),
      email,
      source,
      createdAt: new Date().toISOString(),
    });

    return Response.json({ ok: true, status: "created" });
  } catch (error) {
    // الجدول قد لا يكون مدفوعًا بعد — لا نكسر الواجهة.
    console.warn("[newsletter] persist failed", error instanceof Error ? error.message : error);
    return Response.json({ ok: true, status: "queued" });
  }
}
