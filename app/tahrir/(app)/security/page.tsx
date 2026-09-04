import { redirect } from "next/navigation";
import Link from "next/link";
import { loadActor } from "@/lib/tahrir/access";
import { findUser } from "@/lib/tahrir/service";
import { MfaForm } from "@/components/tahrir/account/mfa-form";
export const dynamic = "force-dynamic";
export default async function SecurityPage() {
  const actor = await loadActor(); if (!actor) redirect("/tahrir/login");
  const user = await findUser(actor.username); if (!user) redirect("/tahrir/login");
  return <main className="mx-auto grid max-w-xl gap-5 p-6" dir="rtl"><h1 className="text-2xl font-bold">أمان الحساب</h1><Link href="/tahrir/password">تغيير كلمة المرور</Link><MfaForm initialEnabled={Boolean(user.mfaSecret)} configured={/^[a-f\d]{64}$/i.test(process.env.TAHRIR_MFA_KEY ?? "")} /></main>;
}
