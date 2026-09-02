"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockIcon } from "lucide-react";
import { toast } from "sonner";

import { Panel } from "@/components/tahrir/overview/panel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface SettingsShape {
  tools: Record<string, boolean>;
  models: { editorial: string; light: string; image: string; fast: string };
  caps: { dailyUsd: number; monthlyUsd: number };
  tone: string;
}

const TOOL_META: Array<[string, string, string, "editorial" | "light" | "fast" | "image"]> = [
  ["headlines", "اقتراح العناوين", "3 بدائل تُفحص بالحارس قبل العرض", "editorial"],
  ["excerpt", "توليد «قبل القراءة»", "خلاصة سطر واحد من المتن", "editorial"],
  ["improve", "تحسين الفقرات", "بفرق ظاهر — الاعتماد بنقرة منك", "editorial"],
  ["proofread", "التدقيق اللغوي", "تصحيح بلا إعادة صياغة", "editorial"],
  ["classify", "التصنيف الآلي", "سلسلة/قسم/شكل — اقتراح يطبَّق بنقرة", "light"],
  ["seo", "توليد SEO والكلمات المفتاحية", "عنوان ووصف بحث + كلمات مفتاحية من المتن", "editorial"],
  ["full_edit", "التحرير الذكي الشامل", "Sonnet يحرر المتن وHaiku يولّد العنوان وSEO والتصنيف بالتوازي", "fast"],
  ["jak", "جاك العلم", "تحليل التقرير إلى خطة شرائح + عمليات الشريحة الواحدة — بمدقق أرقام صارم", "editorial"],
  ["images", "توليد الصور", "الأنماط الثلاثة: حقيقي/توضيحي/رسومي", "image"],
];

const GOVERNANCE: Array<[string, string]> = [
  ["حقن الدستور التحريري في كل استدعاء", "إلزامي — غير قابل للتعطيل"],
  ["فحص الحارس لكل مخرج قبل عرضه", "إلزامي — غير قابل للتعطيل"],
  ["تدوين كل استدعاء في سجل التدقيق", "مَن استدعى ماذا وبأي كلفة"],
];

function Row({ name, desc, model, children }: { name: string; desc: string; model?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-2.5 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold">{name}</div>
        <div className="text-[11px] text-muted-foreground">{desc}</div>
      </div>
      {model ? (
        <code className="hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground sm:inline" dir="ltr">
          {model}
        </code>
      ) : (
        <span className="hidden sm:inline" />
      )}
      {children}
    </div>
  );
}

export function AiSettingsClient({ initial, isChief }: { initial: SettingsShape; isChief: boolean }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);

  async function patch(partial: Partial<SettingsShape>) {
    if (!isChief) {
      toast.error("التعديل قرار رئيس التحرير.");
      return;
    }
    const response = await fetch("/api/tahrir/ai/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (response?.ok) {
      setSettings(data.settings);
      toast.success("حُفظت.");
      router.refresh();
    } else {
      toast.error(data?.error ?? "تعذر الحفظ.");
    }
  }

  return (
    <>
      <Panel title="الأدوات — تفعيل كل أداة على حدة">
        {TOOL_META.map(([key, name, desc, modelKey]) => (
          <Row key={key} name={name} desc={desc} model={settings.models[modelKey]}>
            <Switch
              checked={Boolean(settings.tools[key])}
              aria-label={name}
              disabled={!isChief}
              onCheckedChange={(checked) => patch({ tools: { ...settings.tools, [key]: checked } })}
            />
          </Row>
        ))}
      </Panel>
      <Panel title="الحوكمة">
        {GOVERNANCE.map(([name, desc]) => (
          <Row
            key={name}
            name={name}
            desc={desc}
          >
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <LockIcon className="size-3.5" />
              <Switch checked disabled aria-label="إلزامي" />
            </span>
          </Row>
        ))}
      </Panel>
      <Panel title="نبرة العلم — تُضاف فوق الدستور في كل استدعاء">
        <div className="grid gap-2 p-4">
          <Textarea
            rows={4}
            value={settings.tone}
            readOnly={!isChief}
            aria-label="نبرة العلم"
            onChange={(event) => setSettings({ ...settings, tone: event.target.value })}
          />
          {isChief ? (
            <Button size="sm" className="justify-self-start" onClick={() => patch({ tone: settings.tone })}>
              احفظ النبرة
            </Button>
          ) : null}
        </div>
      </Panel>
    </>
  );
}
