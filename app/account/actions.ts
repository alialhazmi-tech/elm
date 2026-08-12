"use server";

import { redirect } from "next/navigation";
import { memberAuth } from "@/lib/membership/auth";

export async function signOutMember() {
  await memberAuth.signOut().catch(() => null);
  redirect("/");
}
