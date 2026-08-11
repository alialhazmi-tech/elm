"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STYLES: Array<{ key: string; name: string; desc: string }> = [
  { key: "real", name: "حقيقي", desc: "لقطة واقعية بعدسة صحفية — للأخبار الميدانية والتقارير" },
  { key: "illustrative", name: "توضيحي", desc: "مشهد فني يشرح الفكرة — للتحليلات و«افهمها صح» و«لماذا»" },
  { key: "graphic", name: "رسومي", desc: "مسطح أيقوني بألوان الهوية — للإنفوجرافيك و«بالأرقام»" },
];

const SIZES: Array<[string, string]> = [
  ["cover", "غلاف 16:9"],
  ["square", "مربع 1:1"],
  ["portrait", "عمودي 9:16"],
];

export function AiImagesClient({ imagesEnabled, keyReady }: { imagesEnabled: boolean; keyReady: boolean }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("real");
  const [size, setSize] = useState("cover");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Array<{ id: string; url: string }>>([]);

  async function generate() {
    if (busy || !prompt.trim()) return;
    setBusy(true);
    setError("");

    const response = await fetch("/api/tahrir/ai/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, style, size }),
    }).catch(() => null);

    const data = await response?.json().catch(() => null);
    setBusy(false);

    if (!response?.ok) {
      setError(data?.error ?? "تعذر التوليد.");
      return;
    }
    setResults(data.images ?? []);
    router.refresh();
  }

  const blocked = !imagesEnabled || !keyReady;

  return (
    <div className="th-imgen">
      <div className="th-panel" style={{ padding: "16px 18px" }}>
        <div style={{ font: "700 12px var(--f-display)", marginBottom: 8, color: "var(--t-ink2)" }}>
          وصف الصورة — بالعربية، وسيُضاف نمط الهوية تلقائيًا
        </div>
        <textarea
          className="th-imgen-prompt"
          placeholder="مثال: ناقلة نفط عملاقة تعبر مضيق هرمز عند الغروب — بلا نصوص داخل الصورة."
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <div className="th-stylecards">
          {STYLES.map((item) => (
            <button
              key={item.key}
              className={`th-stylecard s-${item.key} ${style === item.key ? "on" : ""}`}
              onClick={() => setStyle(item.key)}
            >
              <div className="prev" />
              <div className="nm">{item.name}</div>
              <div className="ds">{item.desc}</div>
            </button>
          ))}
        </div>
        <div className="th-sizechips">
          {SIZES.map(([key, label]) => (
            <button key={key} className={size === key ? "on" : ""} onClick={() => setSize(key)}>
              {label}
            </button>
          ))}
        </div>
        <button className="th-gen-btn" onClick={generate} disabled={busy || blocked}>
          {busy ? "◪ جارٍ التوليد…" : "◪ ولّد صورتين"}
        </button>
        {blocked && (
          <div className="th-msg err" style={{ padding: "10px 0 0" }}>
            {!keyReady
              ? "مفتاح مزود الصور غير مضبوط — أضف GEMINI_API_KEY ثم أعد التشغيل."
              : "توليد الصور معطل من إعدادات الذكاء."}
          </div>
        )}
        {error && <div className="th-msg err" style={{ padding: "10px 0 0" }}>{error}</div>}
        <div className="th-ai-foot" style={{ marginTop: 12, borderRadius: 9 }}>
          <b>سياسة الصور المولدة:</b> لا توليد لوجوه شخصيات حقيقية (يمنعه المزود بإعداد صريح) · كل
          صورة توسم «مولّدة بالذكاء» بشفافية · حقوقها داخلية فتوثق تلقائيًا في المكتبة.
        </div>
      </div>

      <div className="th-panel">
        <div className="hd">
          <h2>النتائج</h2>
        </div>
        {results.length === 0 && <div className="th-empty">الصور المولدة تظهر هنا وتُحفظ في المكتبة.</div>}
        {results.length > 0 && (
          <div className="th-gen-results">
            {results.map((image) => (
              <div className="th-gen-thumb" key={image.id}>
                {/* عرض الأصل المولّد كما حُفظ */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="صورة مولدة بالذكاء" />
                <div className="mi">
                  <span className="th-ai-tag">✦ مولّدة بالذكاء</span>
                  <div style={{ marginTop: 6 }}>
                    <button
                      className="th-mini"
                      onClick={() => navigator.clipboard.writeText(image.url)}
                    >
                      انسخ الرابط لصورة المادة
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
