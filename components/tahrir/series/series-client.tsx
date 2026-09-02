"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const FIELDS: Array<[string, string, string, "input" | "textarea"]> = [
  ["name", "اسم السلسلة", "مثال: خلف الكواليس", "input"],
  ["valueCase", "اتصالها بأهداف المنصة وقيمتها المعرفية", "ماذا تضيف للقارئ؟", "textarea"],
  ["gapCase", "لماذا لا تغطيها السلاسل القائمة؟", "حدود السلاسل الثماني أمام هذا المحتوى", "textarea"],
  ["impactCase", "الأثر المتوقع (تحريري أو زيارات)", "توقع قابل للقياس", "textarea"],
];

/** اقتراح سلسلة جديدة بشروط الدستور الثلاثة — يُرفع لاعتماد رئيس التحرير. */
export function ProposalForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch("/api/tahrir/series/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(FIELDS.map(([key]) => [key, form.get(key)]))),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setBusy(false);
    if (response?.ok) {
      toast.success("رُفع المقترح لاعتماد رئيس التحرير.");
      formElement.reset();
      router.refresh();
    } else {
      toast.error(data?.error ?? "تعذر رفع المقترح.");
    }
  }

  return (
    <form className="grid gap-3 p-4" onSubmit={submit}>
      {FIELDS.map(([key, label, placeholder, kind]) => (
        <div key={key} className="grid gap-1.5">
          <Label htmlFor={`sp-${key}`}>{label}</Label>
          {kind === "input" ? (
            <Input id={`sp-${key}`} name={key} placeholder={placeholder} required />
          ) : (
            <Textarea id={`sp-${key}`} name={key} placeholder={placeholder} rows={2} required />
          )}
        </div>
      ))}
      <Button type="submit" disabled={busy}>
        {busy ? "يرفع…" : "رفع المقترح لاعتماد رئيس التحرير"}
      </Button>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        شروط الإنشاء من الدستور — باب السلاسل: القيمة المعرفية، وتغطية ما لا تغطيه القائمة، وأثر متوقع.
      </p>
    </form>
  );
}

export function ProposalDecision({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function decide(decision: "accepted" | "rejected") {
    setBusy(true);
    const response = await fetch("/api/tahrir/series/proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    }).catch(() => null);
    setBusy(false);
    if (response?.ok) toast.success(decision === "accepted" ? "قُبل المقترح." : "رُفض المقترح.");
    else toast.error("تعذر تسجيل القرار.");
    router.refresh();
  }

  return (
    <span className="inline-flex gap-1.5">
      <Button size="xs" onClick={() => decide("accepted")} disabled={busy}>
        قبول
      </Button>
      <Button size="xs" variant="outline" onClick={() => decide("rejected")} disabled={busy}>
        رفض
      </Button>
    </span>
  );
}

/** مفتاح ظهور سلسلة متقاعدة في فهرس /series — صفحتها وموادها تبقى حية دائمًا. */
export function ArchiveToggle({ slug, hidden }: { slug: string; hidden: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
      <Switch
        checked={!hidden}
        disabled={busy}
        aria-label={hidden ? "أظهر في الفهرس" : "أخفِ من الفهرس"}
        onCheckedChange={async (visible) => {
          setBusy(true);
          const response = await fetch("/api/tahrir/series/visibility", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug, hidden: !visible }),
          }).catch(() => null);
          setBusy(false);
          if (!response?.ok) toast.error("تعذر تغيير الظهور.");
          router.refresh();
        }}
      />
      في الفهرس
    </span>
  );
}
