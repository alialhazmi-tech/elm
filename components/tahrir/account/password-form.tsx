"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRoundIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = String(form.get("next") ?? "");
    if (next !== String(form.get("confirm") ?? "")) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch("/api/tahrir/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current: form.get("current"), next }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (response?.ok) {
      router.replace("/tahrir");
      router.refresh();
      return;
    }
    setError(data?.error ?? "تعذر الاتصال بالخادم.");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="pw-current">{forced ? "كلمة المرور المؤقتة" : "كلمة المرور الحالية"}</Label>
        <Input id="pw-current" name="current" type="password" autoComplete="current-password" required className="h-10" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pw-next">كلمة المرور الجديدة</Label>
        <p id="pw-requirements" className="text-sm font-medium leading-6 text-foreground">
          يجب ألا تقل كلمة المرور الجديدة عن <strong>15 محرفًا</strong>.
        </p>
        <Input id="pw-next" name="next" type="password" autoComplete="new-password" aria-describedby="pw-requirements" minLength={15} required className="h-10" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pw-confirm">تأكيد كلمة المرور</Label>
        <Input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" aria-describedby="pw-requirements" minLength={15} required className="h-10" />
      </div>
      <Button type="submit" size="lg" disabled={busy} className="font-display font-bold">
        <KeyRoundIcon data-icon="inline-start" />
        {busy ? "جارٍ الحفظ…" : "حفظ والدخول"}
      </Button>
      {!forced ? (
        <Link href="/tahrir" className="text-center text-xs text-muted-foreground hover:underline">
          العودة إلى اللوحة
        </Link>
      ) : null}
      <div role="alert" className="min-h-4 text-xs text-(--t-block)">
        {error}
      </div>
    </form>
  );
}
