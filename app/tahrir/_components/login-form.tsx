"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <form onSubmit={submit}>
      <label htmlFor="th-user">اسم المستخدم</label>
      <input id="th-user" name="username" autoComplete="username" required />
      <label htmlFor="th-pass">كلمة المرور</label>
      <input id="th-pass" name="password" type="password" autoComplete="current-password" required />
      <button className="go" disabled={busy}>
        {busy ? "جارٍ الدخول…" : "دخول"}
      </button>
      <div className="err" role="alert">{error}</div>
    </form>
  );
}
