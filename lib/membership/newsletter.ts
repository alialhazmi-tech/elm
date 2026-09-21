import { eq } from "drizzle-orm";
import { newsletterSubscribers } from "@/db/schema";
import { getDb } from "@/lib/db";

/** اشتراك/إلغاء اشتراك بريد العضو في النشرة — المنطق المشترك بين صفحة الحساب وواجهة التطبيق. */
export async function setNewsletterSubscription(rawEmail: string, subscribed: boolean): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("قاعدة البيانات غير مهيأة.");
  const email = rawEmail.trim().toLowerCase();
  if (!subscribed) {
    await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.email, email));
    return;
  }
  await db
    .insert(newsletterSubscribers)
    .values({ id: crypto.randomUUID(), email, source: "account", createdAt: new Date().toISOString() })
    .onConflictDoNothing();
}
