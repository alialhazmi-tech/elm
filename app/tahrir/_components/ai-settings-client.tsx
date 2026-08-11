"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SettingsShape {
  tools: Record<string, boolean>;
  models: { editorial: string; light: string; image: string };
  caps: { dailyUsd: number; monthlyUsd: number };
  tone: string;
}

const TOOL_META: Array<[string, string, string, "editorial" | "light" | "image"]> = [
  ["headlines", "اقتراح العناوين", "3 بدائل تُفحص بالحارس قبل العرض", "editorial"],
  ["excerpt", "توليد «قبل القراءة»", "خلاصة سطر واحد من المتن", "editorial"],
  ["improve", "تحسين الفقرات", "بفرق ظاهر — الاعتماد بنقرة منك", "editorial"],
  ["proofread", "التدقيق اللغوي", "تصحيح بلا إعادة صياغة", "editorial"],
  ["classify", "التصنيف الآلي", "سلسلة/قسم/شكل — اقتراح يطبَّق بنقرة", "light"],
  ["seo", "توليد SEO والكلمات المفتاحية", "عنوان ووصف بحث + كلمات مفتاحية من المتن", "editorial"],
  ["full_edit", "التحرير الذكي الشامل", "إعادة تحرير كاملة بأسلوب العلم + عنوان وSEO وتصنيف — التطبيق بنقرة", "editorial"],
  ["jak", "جاك العلم", "تحليل التقرير إلى خطة شرائح + عمليات الشريحة الواحدة — بمدقق أرقام صارم", "editorial"],
  ["images", "توليد الصور", "الأنماط الثلاثة: حقيقي/توضيحي/رسومي", "image"],
];

export function AiSettingsClient({
  initial,
  isChief,
}: {
  initial: SettingsShape;
  isChief: boolean;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [message, setMessage] = useState("");

  async function patch(partial: Partial<SettingsShape>) {
    if (!isChief) {
      setMessage("التعديل قرار رئيس التحرير.");
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
      setMessage("حُفظت.");
      router.refresh();
    } else {
      setMessage(data?.error ?? "تعذر الحفظ.");
    }
  }

  return (
    <>
      <div className="th-panel" style={{ marginTop: 14 }}>
        <div className="hd">
          <h2>الأدوات — تفعيل كل أداة على حدة</h2>
          {message && <span className="mr">{message}</span>}
        </div>
        {TOOL_META.map(([key, name, desc, modelKey]) => (
          <div className="th-set-row" key={key}>
            <div>
              <div className="sn">{name}</div>
              <div className="sd">{desc}</div>
            </div>
            <span className="th-set-model">{settings.models[modelKey]}</span>
            <button
              className={`th-toggle ${settings.tools[key] ? "on" : ""}`}
              aria-label={name}
              onClick={() => patch({ tools: { ...settings.tools, [key]: !settings.tools[key] } })}
            />
          </div>
        ))}
      </div>

      <div className="th-panel" style={{ marginTop: 14 }}>
        <div className="hd">
          <h2>الحوكمة</h2>
        </div>
        <div className="th-set-row">
          <div>
            <div className="sn">🔒 حقن الدستور التحريري في كل استدعاء</div>
            <div className="sd">إلزامي — غير قابل للتعطيل</div>
          </div>
          <span />
          <button className="th-toggle on" disabled aria-label="إلزامي" />
        </div>
        <div className="th-set-row">
          <div>
            <div className="sn">🔒 فحص الحارس لكل مخرج قبل عرضه</div>
            <div className="sd">إلزامي — غير قابل للتعطيل</div>
          </div>
          <span />
          <button className="th-toggle on" disabled aria-label="إلزامي" />
        </div>
        <div className="th-set-row">
          <div>
            <div className="sn">تدوين كل استدعاء في سجل التدقيق</div>
            <div className="sd">مَن استدعى ماذا وبأي كلفة</div>
          </div>
          <span />
          <button className="th-toggle on" disabled aria-label="إلزامي" />
        </div>
      </div>

      <div className="th-panel" style={{ marginTop: 14 }}>
        <div className="hd">
          <h2>نبرة العلم — تُضاف فوق الدستور في كل استدعاء</h2>
        </div>
        <div style={{ padding: "12px 16px" }}>
          <textarea
            className="th-imgen-prompt"
            style={{ minHeight: 88, fontSize: 11.5 }}
            value={settings.tone}
            readOnly={!isChief}
            onChange={(event) => setSettings({ ...settings, tone: event.target.value })}
          />
          {isChief && (
            <button className="th-mini" style={{ marginTop: 8 }} onClick={() => patch({ tone: settings.tone })}>
              احفظ النبرة
            </button>
          )}
        </div>
      </div>
    </>
  );
}
