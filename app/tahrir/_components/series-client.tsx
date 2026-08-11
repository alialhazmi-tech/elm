"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProposalForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/tahrir/series/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        valueCase: form.get("valueCase"),
        gapCase: form.get("gapCase"),
        impactCase: form.get("impactCase"),
      }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setBusy(false);

    if (response?.ok) {
      setMessage("رُفع المقترح لاعتماد رئيس التحرير.");
      (event.target as HTMLFormElement).reset?.();
      router.refresh();
    } else {
      setMessage(data?.error ?? "تعذر رفع المقترح.");
    }
  }

  return (
    <form className="th-serform" onSubmit={submit}>
      <label htmlFor="sp-name">اسم السلسلة</label>
      <input id="sp-name" name="name" placeholder="مثال: خلف الكواليس" required />
      <label htmlFor="sp-value">اتصالها بأهداف المنصة وقيمتها المعرفية</label>
      <textarea id="sp-value" name="valueCase" placeholder="ماذا تضيف للقارئ؟" required />
      <label htmlFor="sp-gap">لماذا لا تغطيها السلاسل القائمة؟</label>
      <textarea id="sp-gap" name="gapCase" placeholder="حدود السلاسل الثماني أمام هذا المحتوى" required />
      <label htmlFor="sp-impact">الأثر المتوقع (تحريري أو زيارات)</label>
      <textarea id="sp-impact" name="impactCase" placeholder="توقع قابل للقياس" required />
      <button className="th-fix" style={{ width: "100%", marginTop: 14, padding: 9, fontSize: 12 }} disabled={busy}>
        رفع المقترح لاعتماد رئيس التحرير
      </button>
      <div style={{ fontSize: 10, color: "var(--t-ink3)", marginTop: 8, lineHeight: 1.7 }}>
        شروط الإنشاء من الدستور — باب السلاسل: القيمة المعرفية، وتغطية ما لا تغطيه القائمة، وأثر متوقع.
        {message && <b style={{ display: "block", color: "var(--t-navy)" }}>{message}</b>}
      </div>
    </form>
  );
}

export function ProposalDecision({ id }: { id: string }) {
  const router = useRouter();

  async function decide(decision: "accepted" | "rejected") {
    await fetch("/api/tahrir/series/proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    });
    router.refresh();
  }

  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <button className="th-mini" onClick={() => decide("accepted")}>
        قبول
      </button>
      <button className="th-mini" onClick={() => decide("rejected")}>
        رفض
      </button>
    </span>
  );
}
