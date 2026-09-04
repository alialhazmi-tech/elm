"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { memberAuth } from "@/lib/membership/auth";
import { clearBehavioralData, setPersonalizationEnabled } from "@/lib/personalization/privacy";
import { setSaved } from "@/lib/personalization/saved";
import { newsletterSubscribers } from "@/db/schema";
import { getDb } from "@/lib/db";

export async function signOutMember() {
  await memberAuth.signOut().catch(() => null);
  redirect("/");
}

export async function togglePersonalization(formData: FormData) {
  const { data } = await memberAuth.getSession().catch(() => ({ data: null }));
  if (!data?.user) redirect("/join");
  await setPersonalizationEnabled(data.user.id, formData.get("enabled") === "1");
  redirect("/account");
}

export async function clearInferredSignals() {
  const { data } = await memberAuth.getSession().catch(() => ({ data: null }));
  if (!data?.user) redirect("/join");
  await clearBehavioralData(data.user.id);
  redirect("/account");
}

export async function toggleNewsletter() {
  const { data } = await memberAuth.getSession().catch(() => ({ data: null }));
  if (!data?.user?.email) redirect("/join");
  const email = data.user.email.trim().toLowerCase();
  const db = getDb();
  if (db) {
    const existing = await db
      .select({ id: newsletterSubscribers.id })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, email))
      .limit(1);
    if (existing.length > 0) {
      await db.delete(newsletterSubscribers).where(eq(newsletterSubscribers.email, email));
    } else {
      await db.insert(newsletterSubscribers).values({
        id: crypto.randomUUID(),
        email,
        source: "account",
        createdAt: new Date().toISOString(),
      });
    }
  }
  redirect("/account");
}

export async function removeSavedStory(formData: FormData) {
  const { data } = await memberAuth.getSession().catch(() => ({ data: null }));
  if (!data?.user) redirect("/join");
  const storyId = String(formData.get("storyId") ?? "");
  if (storyId) {
    await setSaved(data.user.id, storyId, false);
  }
  redirect("/account");
}
