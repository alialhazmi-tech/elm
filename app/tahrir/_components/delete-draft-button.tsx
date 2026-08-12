"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteDraftButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);

  if (deleted) return null;

  async function remove() {
    if (busy || !window.confirm(`حذف المسودة «${title}» نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    setBusy(true);
    const response = await fetch("/api/tahrir/story", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      window.alert(data?.error ?? "تعذر حذف المسودة.");
      return;
    }
    setDeleted(true);
    router.refresh();
  }

  return (
    <button
      type="button"
      className="th-draft-delete"
      onClick={remove}
      disabled={busy}
      aria-label={`حذف مسودة ${title}`}
    >
      {busy ? "يحذف…" : "حذف"}
    </button>
  );
}
