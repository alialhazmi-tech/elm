"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogInIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/tahrir/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
    }).catch(() => null);
    if (response?.ok) {
      router.replace("/tahrir");
      router.refresh();
      return;
    }
    const data = await response?.json().catch(() => null);
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
      <Button type="submit" size="lg" disabled={busy} className="font-display font-bold">
        <LogInIcon data-icon="inline-start" className="rtl:-scale-x-100" />
        {busy ? "جارٍ الدخول…" : "دخول"}
      </Button>
      <div role="alert" className="min-h-4 text-xs text-(--t-block)">
        {error}
      </div>
    </form>
  );
}
