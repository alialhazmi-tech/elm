"use client";

/**
 * استوديو الإنفوجرافيك التفاعلي الذكي — لوحة التحكم والتحرير المباشر وتوليد الصور الحقيقية.
 */

import { useState } from "react";

import { InteractiveInfographic } from "@/app/_components/interactive-infographic";
import { getBlueEconomyPreset } from "@/lib/ai/infographic";
import {
  INFOGRAPHIC_THEMES,
  THEME_CONFIGS,
  type InfographicData,
  type InfographicThemeId,
} from "@/lib/ai/infographic-types";

const PRESET_TOPICS = [
  {
    title: "اقتصاد المدّ الأزرق",
    theme: "ocean-cyber" as InfographicThemeId,
    desc: "المصائد ومزارع الأحياء المائية والاستزراع السمكي بالبحر الأحمر والخليج العربي.",
  },
  {
    title: "مبادرة السعودية الخضراء والطاقة المتجددة",
    theme: "cyber-emerald" as InfographicThemeId,
    desc: "زراعة 10 مليارات شجرة، الطاقة الشمسية، ومستهدفات تحييد الكربون 2060.",
  },
  {
    title: "الذكاء الاصطناعي في الرعاية الصحية",
    theme: "midnight-tech" as InfographicThemeId,
    desc: "مستشفيات المستقبل الافتراضية، التشخيص المبكر، وتقنيات الجينوم الوطنية.",
  },
  {
    title: "التعدين والصناعات المعدنية المتقدمة",
    theme: "desert-gold" as InfographicThemeId,
    desc: "استغلال الثروة المعدنية البالغة 9.4 تريليون ريال وسلاسل الإمداد الوطنية.",
  },
];

export function InfographicStudio() {
  const [topic, setTopic] = useState("اقتصاد المدّ الأزرق");
  const [text, setText] = useState("");
  const [theme, setTheme] = useState<InfographicThemeId>("ocean-cyber");
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageProvider, setImageProvider] = useState<"auto" | "gemini" | "openai">("auto");
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [infographic, setInfographic] = useState<InfographicData>(getBlueEconomyPreset());
  const [activeTab, setActiveTab] = useState<"preview" | "editor" | "prompts" | "export">("preview");

  // توليد هيكل ونصوص الإنفوجرافيك عبر AI
  const handleGenerate = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatusMsg("جارٍ تحليل النص واستخراج الأرقام وصياغة الإنفوجرافيك بالذكاء الاصطناعي...");

    try {
      const topicToSend =
        topic && topic !== "اقتصاد المدّ الأزرق"
          ? topic
          : text.trim()
            ? ""
            : topic;

      const res = await fetch("/api/tahrir/infographic/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topicToSend,
          text: text.trim() || topicToSend,
          preferredTheme: theme,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل التوليد");
      }

      setInfographic(data.infographic);
      if (data.infographic.title) {
        setTopic(data.infographic.title);
      }
      if (data.infographic.themeId) {
        setTheme(data.infographic.themeId);
      }
      setStatusMsg("تم توليد الهيكل الجديد بنجاح من النص! تفقد المعاينة الحية بالأسفل.");
      setActiveTab("preview");

      setTimeout(() => {
        document.getElementById("studio-preview-section")?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ أثناء التوليد");
    } finally {
      setBusy(false);
    }
  };

  // توليد الصور الحقيقية للإنفوجرافيك عبر Nano Banana (Gemini) أو GPT DALL-E
  const handleGenerateRealImages = async () => {
    if (imageBusy) return;
    setImageBusy(true);
    setError("");
    setStatusMsg("جارٍ توليد الصور الحقيقية بالذكاء الاصطناعي (قد يستغرق 10-20 ثانية)...");

    try {
      const res = await fetch("/api/tahrir/infographic/generate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          infographic,
          provider: imageProvider,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل توليد الصور");
      }

      setInfographic(data.infographic);
      setStatusMsg("تم توليد وربط الصور الحقيقية بنجاح! تفقد المعاينة الحية.");
      setActiveTab("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر توليد الصور");
    } finally {
      setImageBusy(false);
    }
  };

  const handleSelectPreset = (p: typeof PRESET_TOPICS[0]) => {
    setTopic(p.title);
    setText(p.desc);
    setTheme(p.theme);
  };

  return (
    <div className="space-y-6">
      {/* لوحة التوليد والإدخال */}
      <section className="th-panel" style={{ padding: "20px 24px" }}>
        <div className="hd" style={{ marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>استوديو الإنفوجرافيك التفاعلي الذكي</h2>
            <p style={{ fontSize: 13, color: "var(--t-ink2)", marginTop: 4 }}>
              أدخل أي تقرير لتوليد تجربة بصرية متحركة ومتكاملة، مع خيار توليد صور حقيقية عالية الدقة بنقرة واحدة.
            </p>
          </div>
          <span className="th-ai-tag">✦ مولّد بالذكاء</span>
        </div>

        {/* أمثلة جاهزة سريعة */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t-ink2)", marginBottom: 8 }}>
            نماذج ومواضيع جاهزة للتجربة:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PRESET_TOPICS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(p)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  background: topic === p.title ? "var(--bg-accent, #0284c7)" : "var(--bg-subtle, #f1f5f9)",
                  color: topic === p.title ? "#ffffff" : "var(--t-ink)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {p.title}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              <span>عنوان الموضوع أو التقرير:</span>
              <input
                type="text"
                className="th-input"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, marginTop: 4, display: "block" }}
                placeholder="مثال: نمو الاستزراع المائي وصادرات الأسماك في المملكة"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </label>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              <span>السمة البصرية (Color Theme):</span>
              <select
                className="th-select"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, marginTop: 4, display: "block" }}
                value={theme}
                onChange={(e) => setTheme(e.target.value as InfographicThemeId)}
              >
                {INFOGRAPHIC_THEMES.map((tId) => (
                  <option key={tId} value={tId}>
                    {THEME_CONFIGS[tId].name} ({THEME_CONFIGS[tId].category})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            <span>نص التقرير أو البيانات التفصيلية (اختياري، يترك فارغاً للتوليد من الموضوع مباشرة):</span>
            <textarea
              className="th-imgen-prompt"
              style={{ width: "100%", minHeight: 80, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginTop: 4, display: "block" }}
              placeholder="الصق هنا أي نص خبري أو أرقام وإحصائيات لترجمتها تلقائيًا إلى بطاقات تفاعلية وعناصر عائمة..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
        </div>

        {/* اختيار مزود الصور */}
        <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 10, background: "var(--bg-subtle, #f8fafc)", border: "1px solid #e2e8f0", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>محرك توليد الصور:</span>
            <select
              className="th-select"
              style={{ padding: "6px 10px", fontSize: 12, borderRadius: 6 }}
              value={imageProvider}
              onChange={(e) => setImageProvider(e.target.value as "auto" | "gemini" | "openai")}
            >
              <option value="auto">تلقائي (الأسرع والأدق)</option>
              <option value="gemini">Google Gemini / Imagen (Nano Banana Pro)</option>
              <option value="openai">OpenAI DALL-E 3 (GPT Images)</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, marginRight: "auto" }}>
            <button
              type="button"
              className="th-btn"
              disabled={imageBusy}
              onClick={handleGenerateRealImages}
              style={{
                padding: "8px 16px",
                background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 12,
                borderRadius: 8,
                cursor: imageBusy ? "not-allowed" : "pointer",
              }}
            >
              {imageBusy ? "⏳ جارٍ توليد الصور الحقيقية..." : "🎨 توليد صور حقيقية بالذكاء الاصطناعي"}
            </button>
          </div>
        </div>

        {statusMsg && !error && (
          <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "#f0fdf4", color: "#166534", fontSize: 12, fontWeight: 600 }}>
            ✨ {statusMsg}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            className="th-btn"
            disabled={busy || (!topic && !text)}
            onClick={handleGenerate}
            style={{
              padding: "10px 22px",
              background: "linear-gradient(135deg, #0284c7, #0369a1)",
              color: "#fff",
              fontWeight: 700,
              borderRadius: 8,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "جارٍ التحليل والتوليد بالذكاء..." : "✦ توليد وهيكلة الإنفوجرافيك"}
          </button>
        </div>
      </section>

      {/* شريط تبويبات المعاينة والتحرير */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid rgba(0,0,0,0.1)", paddingBottom: 8 }}>
        {[
          { key: "preview", label: "👁️ المعاينة التفاعلية الحية" },
          { key: "editor", label: "✎ محرر المحتوى والأرقام" },
          { key: "prompts", label: "🖼️ مطالبات وتوليد الصور AI" },
          { key: "export", label: "⤓ التصدير والتضمين" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 700 : 500,
              background: activeTab === tab.key ? "var(--bg-accent, #0284c7)" : "transparent",
              color: activeTab === tab.key ? "#fff" : "var(--t-ink)",
              border: "none",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* محتوى التبويب */}
      <div id="studio-preview-section">
        {activeTab === "preview" && (
          <div style={{ borderRadius: 24, overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}>
            <InteractiveInfographic
              key={infographic.id + "-" + (infographic.generatedAt || "")}
              data={infographic}
              enableControls={true}
            />
          </div>
        )}
      </div>

      {activeTab === "editor" && (
        <div className="th-panel" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>تعديل نصوص وبيانات الإنفوجرافيك</h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                <span>العنوان الرئيسي:</span>
                <input
                  type="text"
                  className="th-input"
                  value={infographic.title}
                  onChange={(e) => setInfographic({ ...infographic, title: e.target.value })}
                  style={{ width: "100%", padding: 8, marginTop: 4, display: "block" }}
                />
              </label>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                <span>الشعار التصنيفي (Eyebrow):</span>
                <input
                  type="text"
                  className="th-input"
                  value={infographic.eyebrow}
                  onChange={(e) => setInfographic({ ...infographic, eyebrow: e.target.value })}
                  style={{ width: "100%", padding: 8, marginTop: 4, display: "block" }}
                />
              </label>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              <span>المقدمة والنبذة:</span>
              <textarea
                className="th-input"
                value={infographic.introText}
                onChange={(e) => setInfographic({ ...infographic, introText: e.target.value })}
                style={{ width: "100%", minHeight: 70, padding: 8, marginTop: 4, display: "block" }}
              />
            </label>
          </div>

          <h4 style={{ fontSize: 14, fontWeight: 700, margin: "20px 0 10px", color: "var(--t-ink)" }}>
            المؤشرات الرقمية الكبرى (Macro Stats):
          </h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {infographic.macroSection.stats.map((stat, idx) => (
              <div key={stat.id} style={{ padding: 12, borderRadius: 8, background: "var(--bg-subtle, #f8fafc)", border: "1px solid #e2e8f0" }}>
                <input
                  type="number"
                  step="0.1"
                  value={stat.value}
                  onChange={(e) => {
                    const newStats = [...infographic.macroSection.stats];
                    newStats[idx].value = Number(e.target.value);
                    setInfographic({
                      ...infographic,
                      macroSection: { ...infographic.macroSection, stats: newStats },
                    });
                  }}
                  style={{ width: "100%", padding: 6, fontWeight: "bold", fontSize: 16, marginBottom: 4 }}
                />
                <input
                  type="text"
                  value={stat.label}
                  onChange={(e) => {
                    const newStats = [...infographic.macroSection.stats];
                    newStats[idx].label = e.target.value;
                    setInfographic({
                      ...infographic,
                      macroSection: { ...infographic.macroSection, stats: newStats },
                    });
                  }}
                  style={{ width: "100%", padding: 4, fontSize: 12 }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "prompts" && (
        <div className="th-panel" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>مطالبات وتوليد الصور بالذكاء الاصطناعي (AI Prompts)</h3>
              <p style={{ fontSize: 13, color: "var(--t-ink2)", marginTop: 2 }}>
                مطالبات مصممة بدقة لتوليد صور سينمائية فائقة الوضوح عبر Gemini (Nano Banana) و OpenAI DALL-E 3.
              </p>
            </div>
            <button
              type="button"
              disabled={imageBusy}
              onClick={handleGenerateRealImages}
              style={{
                padding: "8px 16px",
                background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 12,
                borderRadius: 8,
                cursor: imageBusy ? "not-allowed" : "pointer",
              }}
            >
              {imageBusy ? "⏳ جارٍ التوليد..." : "🎨 توليد كافة الصور الآن"}
            </button>
          </div>

          <div className="space-y-4">
            <div style={{ padding: 14, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>1. خلفية المشهد الافتتاحي (Hero Background):</div>
              <code style={{ display: "block", fontSize: 12, background: "#0f172a", color: "#38bdf8", padding: 10, borderRadius: 6, direction: "ltr", textAlign: "left" }}>
                {infographic.hero.bgPrompt}
              </code>
              {infographic.hero.bgImageUrl && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#16a34a", fontWeight: "bold" }}>
                  ✓ تم توليد الصورة: {infographic.hero.bgImageUrl}
                </div>
              )}
            </div>

            <div style={{ padding: 14, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>2. الفاصل البانورامي (Section Divider):</div>
              <code style={{ display: "block", fontSize: 12, background: "#0f172a", color: "#38bdf8", padding: 10, borderRadius: 6, direction: "ltr", textAlign: "left" }}>
                {infographic.macroSection.bannerPrompt || "Cinematic panoramic ocean seascape at sunset, ultra realistic."}
              </code>
            </div>

            <div style={{ padding: 14, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>3. العناصر العائمة ثلاثية الأبعاد (3D Floating Assets):</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {infographic.showcaseSection.items.map((item) => (
                  <div key={item.id} style={{ fontSize: 12, borderRight: "3px solid #0284c7", paddingRight: 8 }}>
                    <strong>{item.name}:</strong>
                    <code style={{ display: "block", fontSize: 11, background: "#0f172a", color: "#a5f3fc", padding: 6, borderRadius: 4, direction: "ltr", textAlign: "left", marginTop: 4 }}>
                      {item.imagePrompt}
                    </code>
                    {item.imageUrl && (
                      <span style={{ fontSize: 11, color: "#16a34a", fontWeight: "bold" }}>
                        ✓ الصورة جاهزة ومربوطة
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "export" && (
        <div className="th-panel" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>خيارات التصدير والمشاركة</h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ padding: 16, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>كود تضمين الإنفوجرافيك (Embed Code)</h4>
              <p style={{ fontSize: 12, color: "var(--t-ink2)", marginBottom: 10 }}>
                يمكنك تضمين هذا الإنفوجرافيك التفاعلي في أي موقع أو مقال خارجي عبر كود iframe:
              </p>
              <textarea
                readOnly
                value={`<iframe src="https://alelm.net/infographic/${infographic.id}" width="100%" height="800" frameborder="0"></iframe>`}
                style={{ width: "100%", height: 80, fontSize: 11, fontFamily: "monospace", padding: 8, borderRadius: 6, direction: "ltr" }}
              />
            </div>

            <div style={{ padding: 16, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>بيانات JSON المهيكلة</h4>
              <p style={{ fontSize: 12, color: "var(--t-ink2)", marginBottom: 10 }}>
                نسخ كائن البيانات الكامل لاستخدامه في أنظمة إدارة المحتوى والتطبيقات:
              </p>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(JSON.stringify(infographic, null, 2))}
                style={{ padding: "8px 14px", background: "#0284c7", color: "#fff", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
              >
                📋 نسخ بيانات JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
