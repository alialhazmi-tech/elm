"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogInIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invalidateViewerSession } from "@/lib/membership/client-session";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/tahrir/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password"), code: form.get("code") }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (response?.ok) {
      invalidateViewerSession();
      router.replace(data?.mustChangePassword ? "/tahrir/password" : "/tahrir");
      router.refresh();
      return;
    }
    if (data?.mfaRequired) setMfaRequired(true);
    setError(data?.error ?? "تعذر الاتصال بالخادم.");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="th-user">اسم المستخدم</Label>
        <Input id="th-user" name="username" autoComplete="username" required className="h-10" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="th-pass">كلمة المرور</Label>
        <Input id="th-pass" name="password" type="password" autoComplete="current-password" required className="h-10" />
      </div>
      {mfaRequired && <div className="grid gap-1.5"><Label htmlFor="th-code">رمز التحقق أو الاسترداد</Label><Input id="th-code" name="code" autoComplete="one-time-code" dir="ltr" required maxLength={64} /></div>}
      <Button type="submit" size="lg" disabled={busy} className="font-display font-bold">
        <LogInIcon data-icon="inline-start" className="rtl:-scale-x-100" />
        {busy ? "جارٍ الدخول…" : "دخول"}
      </Button>
      <Link href="/tahrir/recover" className="justify-self-start text-sm underline">نسيت كلمة المرور؟</Link>
      <div role="alert" className="min-h-4 text-xs text-(--t-block)">
        {error}
      </div>
    </form>
  );
}
