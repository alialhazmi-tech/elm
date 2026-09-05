"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function SavedStoriesList({ items, ownerId }: { items: Array<{ id: string; title: string; href: string }>; ownerId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const saving = useRef(false);
  const remove = async (storyId: string) => {
    if (saving.current) return;
    saving.current = true; setBusy(storyId); setError("");
    try {
      const response = await fetch("/api/tahrir/account/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId, saved: false, expectedMemberId: ownerId }) });
      if (!response.ok) throw new Error("REMOVE_FAILED");
      window.dispatchEvent(new Event("alelm-saved-change"));
      router.refresh();
    } catch { setError("تعذّر إلغاء الحفظ. تحقق من الحساب والاتصال ثم أعد المحاولة."); }
    finally { saving.current = false; setBusy(null); }
  };
  return <>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <ul className="divide-y rounded-xl border bg-card">
      {items.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
        <Link href={item.href} className="min-w-0 flex-1 font-display font-bold hover:underline">{item.title}</Link>
        <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void remove(item.id)} aria-label={`إلغاء حفظ: ${item.title}`}>{busy === item.id ? "جارٍ الإزالة…" : "إلغاء الحفظ"}</Button>
      </li>)}
    </ul>
  </>;
}
