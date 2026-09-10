"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestStaffPasswordReset, completeStaffPasswordReset } from "./actions";

function NewPassword({ name, label }: { name: string; label: string }) {
  const [visible, setVisible] = useState(false);
  return <div className="grid gap-1.5">
    <Label htmlFor={name}>{label}</Label>
    <div className="relative"><Input id={name} name={name} type={visible ? "text" : "password"} autoComplete="new-password" required minLength={10} maxLength={512} dir="ltr" className="h-11 ps-11" />
      <button type="button" className="absolute inset-y-0 end-0 grid w-11 place-items-center" aria-label={`${visible ? "إخفاء" : "إظهار"} ${label}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <Eye size={18} /> : <EyeOff size={18} />}</button>
    </div>
  </div>;
}

export function RecoveryForm({ token }: { token?: string }) {
  const [state, action, pending] = useActionState(token ? completeStaffPasswordReset : requestStaffPasswordReset, {});
  return <div className="grid gap-4">
    {token && state.success ? <p role="status" className="text-sm text-(--t-ok)">{state.success}</p> : <form action={action} className="grid gap-4">
      {token ? <><input type="hidden" name="token" value={token} /><NewPassword name="password" label="كلمة المرور الجديدة" /><p className="text-xs text-muted-foreground">من 10 إلى 512 محرفًا. اختر كلمة طويلة وفريدة؛ يُنصح بمزج الحروف والأرقام والرموز.</p><NewPassword name="confirmPassword" label="تأكيد كلمة المرور" /></> : <div className="grid gap-1.5"><Label htmlFor="recovery-username">اسم المستخدم أو بريد تسجيل الدخول</Label><Input id="recovery-username" name="username" autoComplete="username" maxLength={190} required className="h-11" /><p className="text-xs text-muted-foreground">سنرسل الرابط إلى البريد المسجّل لحسابك الإداري. الرابط صالح لمدة 15 دقيقة.</p></div>}
      {state.error && <p role="alert" className="text-sm text-(--t-block)">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-(--t-ok)">{state.success}</p>}
      <Button type="submit" disabled={pending}>{pending ? "جارٍ التنفيذ…" : token ? "حفظ كلمة المرور" : "إرسال رابط الاستعادة"}</Button>
    </form>}
    {token && !state.success && <Link href="/tahrir/recover" className="text-sm underline">طلب رابط جديد</Link>}
    <Link href="/tahrir/login" className="text-sm underline">العودة إلى تسجيل الدخول</Link>
  </div>;
}
