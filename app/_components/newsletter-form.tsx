"use client";

import { useId, useState, type FormEvent } from "react";

type Status = "idle" | "loading" | "success" | "exists" | "error";

export function NewsletterForm({ source = "footer" }: { source?: string }) {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading") return;

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; status?: string; error?: string }
        | null;

      if (!response.ok || !data?.ok) {
        setStatus("error");
        setMessage(data?.error ?? "تعذّر الاشتراك الآن — حاول لاحقًا");
        return;
      }

      if (data.status === "exists") {
        setStatus("exists");
        setMessage("هذا البريد مشترك مسبقًا.");
      } else {
        setStatus("success");
        setMessage("تم حفظ اشتراكك في قائمة النشرة.");
        setEmail("");
      }
    } catch {
      setStatus("error");
      setMessage("تعذّر الاتصال. حاول مرة أخرى.");
    }
  }

  const done = status === "success" || status === "exists";

  return (
    <form className="ft-compose" onSubmit={onSubmit} noValidate>
      <label className="sr-only" htmlFor={inputId}>البريد الإلكتروني للنشرة</label>
      <input
        id={inputId}
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        dir="ltr"
        placeholder="name@email.com"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (status !== "idle" && status !== "loading") {
            setStatus("idle");
            setMessage("");
          }
        }}
        disabled={status === "loading"}
        required
      />
      <button type="submit" disabled={status === "loading" || !email.trim()}>
        {status === "loading" ? "جارٍ التسجيل…" : "اشترك في النشرة"}
      </button>
      {message ? (
        <p className={`ft-compose-msg ${done ? "is-ok" : "is-err"}`} role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
