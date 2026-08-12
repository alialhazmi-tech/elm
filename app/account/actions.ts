"use server";

import { redirect } from "next/navigation";
import { memberAuth } from "@/lib/membership/auth";
import { clearBehavioralData, setPersonalizationEnabled } from "@/lib/personalization/privacy";

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
