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
  if (!db) return Response.json({ ok: false, error: "الاشتراك غير متاح الآن. حاول لاحقًا." }, { status: 503 });

  try {
    await db.insert(newsletterSubscribers).values({
      id: crypto.randomUUID(), email, source, createdAt: new Date().toISOString(),
    }).onConflictDoNothing({ target: newsletterSubscribers.email });
    return Response.json({ ok: true, status: "created" });
  } catch {
    console.error("[newsletter] persist failed");
    return Response.json({ ok: false, error: "تعذر حفظ الاشتراك. حاول مرة أخرى." }, { status: 503 });
  }
}
