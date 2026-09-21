import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { loadActor } from "@/lib/tahrir/access";
import { mfaConfigured } from "@/lib/tahrir/totp";
import { MfaForm } from "@/components/tahrir/account/mfa-form";
export const dynamic = "force-dynamic";
export default async function SecurityPage() {
  const actor = await loadActor(); if (!actor) redirect("/tahrir/login");
  return <main className="mx-auto grid max-w-xl gap-5 p-6" dir="rtl"><h1 className="text-2xl font-bold">أمان الحساب</h1>
    {actor.mfaRequired ? <Alert role="status"><ShieldAlertIcon /><AlertTitle>التحقق بخطوتين إلزامي لحسابك</AlertTitle><AlertDescription>حسابك يحمل صلاحيات إدارية (الأعضاء أو الأدوار أو الصلاحية الشاملة)، فلا تُفتح بقية اللوحة قبل تفعيله من هنا. تحتاج كلمة المرور الحالية وتطبيق تحقق.</AlertDescription></Alert> : null}
    <Link href="/tahrir/password">تغيير كلمة المرور</Link><MfaForm initialEnabled={actor.mfaEnabled} configured={mfaConfigured()} /></main>;
}
