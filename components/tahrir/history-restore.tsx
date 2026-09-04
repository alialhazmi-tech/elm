"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function HistoryRestore({ id, versionId, expectedVersion }: { id: string; versionId: string; expectedVersion: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div><Button disabled={busy} onClick={async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/tahrir/story/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, versionId, expectedVersion }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.push(`/tahrir/${result.format === "jakalelm" ? "jak" : "editor"}/${result.id}`);
    } catch (error) { setError(error instanceof Error ? error.message : "تعذرت الاستعادة."); setBusy(false); }
  }}>{busy ? "جارٍ إنشاء المسودة…" : "استعادة كمسودة للمراجعة"}</Button><p role="alert">{error}</p></div>;
}
