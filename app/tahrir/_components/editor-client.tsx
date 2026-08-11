"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { Finding, GuardReport } from "@/lib/policy/types";

interface EditorInitial {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  section: string;
  slug: string;
  seriesSlug: string | null;
  image: string | null;
  format: string;
  pinned: boolean;
  breakingUntil: string | null;
  status: string;
}

interface Props {
  role: string;
  series: Array<{ slug: string; name: string; color: string }>;
  sections: Array<[string, string]>;
  recentMedia: Array<{ url: string; filename: string }>;
  initial: EditorInitial | null;
}

const FORMATS: Array<[string, string]> = [
  ["news", "خبر"],
  ["infographics", "إنفوجرافيك"],
  ["videos", "فيديو"],
  ["reports", "تقرير"],
  ["podcasts", "بودكاست"],
];

const SEVERITY_LABELS: Record<string, string> = {
  blocking: "قاطع",
  warning: "تحذير",
  suggestion: "مقترح",
};

const wordCount = (text: string) => text.trim().split(/\s+/u).filter(Boolean).length;

function hoursAhead(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

export function EditorClient({ role, series, sections, recentMedia, initial }: Props) {
  const router = useRouter();
  const [id, setId] = useState(initial?.id ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [section, setSection] = useState(initial?.section ?? "news");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [seriesSlug, setSeriesSlug] = useState(initial?.seriesSlug ?? null);
  const [image, setImage] = useState(initial?.image ?? "");
  const [format, setFormat] = useState(initial?.format ?? "news");
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [breakingUntil, setBreakingUntil] = useState<string | null>(initial?.breakingUntil ?? null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [report, setReport] = useState<GuardReport | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleGuard(nextTitle: string, nextBody: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const response = await fetch("/api/tahrir/guard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle, body: nextBody }),
      }).catch(() => null);
      if (response?.ok) setReport((await response.json()) as GuardReport);
    }, 600);
  }

  function onTitle(value: string) {
    setTitle(value);
    scheduleGuard(value, body);
  }

  function onBody(value: string) {
    setBody(value);
    scheduleGuard(title, value);
  }

  function applyFix(finding: Finding) {
    if (!finding.autofix) return;
    const { field, from, to } = finding.autofix;
    if (field === "title") onTitle(title.replace(from, to));
    else onBody(body.replace(from, to));
  }

  async function save(): Promise<string | null> {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/tahrir/story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id || undefined, title, excerpt, body, section, slug, seriesSlug, image: image || null, format, pinned, breakingUntil }),
    }).catch(() => null);
    setBusy(false);

    const data = await response?.json().catch(() => null);
    if (!response?.ok) {
      setMessage({ kind: "err", text: data?.error ?? "تعذر الحفظ." });
      return null;
    }

    setId(data.id);
    setSlug(data.slug);
    if (!initial) setStatus("draft");
    setMessage({ kind: "ok", text: "حُفظت المسودة." });
    return data.id as string;
  }

  async function submitForReview() {
    const savedId = await save();
    if (!savedId) return;

    setBusy(true);
    const response = await fetch("/api/tahrir/story/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: savedId }),
    }).catch(() => null);
    setBusy(false);

    const data = await response?.json().catch(() => null);
    if (!response?.ok) {
      setMessage({ kind: "err", text: data?.error ?? "رفض الحارس الإرسال." });
      return;
    }
    setStatus("review");
    setMessage({ kind: "ok", text: "أُرسلت للاعتماد — بانتظار المعتمد البشري." });
  }

  async function schedule() {
    if (!scheduleAt) {
      setMessage({ kind: "err", text: "اختر موعد الجدولة أولًا." });
      return;
    }
    const savedId = await save();
    if (!savedId) return;

    setBusy(true);
    const response = await fetch("/api/tahrir/story/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: savedId, scheduledAt: new Date(scheduleAt).toISOString() }),
    }).catch(() => null);
    setBusy(false);

    const data = await response?.json().catch(() => null);
    if (!response?.ok) {
      setMessage({ kind: "err", text: data?.error ?? "تعذرت الجدولة." });
      return;
    }
    setStatus("scheduled");
    setMessage({ kind: "ok", text: "جُدولت — الحارس سيفحصها ثانية لحظة الموعد." });
  }

  async function publish() {
    const savedId = await save();
    if (!savedId) return;

    setBusy(true);
    const response = await fetch("/api/tahrir/story/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: savedId }),
    }).catch(() => null);
    setBusy(false);

    const data = await response?.json().catch(() => null);
    if (!response?.ok) {
      setMessage({ kind: "err", text: data?.error ?? "تعذر النشر." });
      return;
    }
    setStatus("published");
    setMessage({ kind: "ok", text: "نُشرت المادة على الموقع." });
    router.refresh();
  }

  const titleWords = wordCount(title);
  const blocking = report?.counts.blocking ?? 0;
  const gateOpen = report ? report.canRequestApproval : true;
  const canApprove = role === "approver" || role === "chief";

  return (
    <div className="th-ed">
      <div className="th-ed-main">
        <input
          className="th-ed-title"
          placeholder="عنوان المادة…"
          value={title}
          onChange={(event) => onTitle(event.target.value)}
        />
        <div className="th-ed-cnt">
          <span className={titleWords > 10 ? "bad" : "good"}>
            العنوان {titleWords} {titleWords > 10 ? "كلمة — تجاوز حد الدستور (10)" : "كلمات (الحد 10)"}
          </span>
        </div>
        <textarea
          className="th-ed-sum"
          placeholder="✦ قبل القراءة — خلاصة في سطر واحد"
          value={excerpt}
          onChange={(event) => setExcerpt(event.target.value)}
        />
        <textarea
          className="th-ed-body"
          placeholder="نص المادة…"
          value={body}
          onChange={(event) => onBody(event.target.value)}
        />
      </div>

      <div className="th-ed-side">
        <div className="th-panel">
          <div className="th-guard-hd">
            <span className={`dot ${blocking === 0 ? "ok" : ""}`} />
            <h2>حارس السياسة</h2>
            <span className="cnt">
              {report ? `${report.rulesEvaluated} قاعدة · ${report.findings.length} ملاحظات` : "اكتب ليفحص"}
            </span>
          </div>

          {report?.findings.slice(0, 8).map((finding, index) => (
            <div className={`th-find f-${finding.severity}`} key={`${finding.ruleId}-${index}`}>
              <div className="fh">
                <span className="sv">{SEVERITY_LABELS[finding.severity]}</span>
                <span className="rid">{finding.ruleId}</span>
              </div>
              <div className="fx">{finding.message}</div>
              {finding.autofix && (
                <button className="th-fix" onClick={() => applyFix(finding)}>
                  أصلح آليًا
                </button>
              )}
            </div>
          ))}

          <div className={`th-gate ${gateOpen ? "open" : ""}`}>
            {gateOpen ? (
              <>
                <b>البوابة مفتوحة</b> — لا مخالفات قاطعة. الاعتماد النهائي بشري دائمًا.
              </>
            ) : (
              <>
                <b>ممنوع طلب الاعتماد</b> حتى معالجة: {report?.audit.blockingRuleIds.join("، ")}
              </>
            )}
          </div>

          {message && <div className={`th-msg ${message.kind}`}>{message.text}</div>}

          <div className="th-actions">
            <button className="th-save" onClick={save} disabled={busy}>
              حفظ المسودة
            </button>
            {status !== "published" && (
              <button
                className={`th-send ${gateOpen && !busy ? "ready" : ""}`}
                onClick={submitForReview}
                disabled={!gateOpen || busy}
              >
                إرسال للاعتماد
              </button>
            )}
            {canApprove && status !== "published" && (
              <button
                className={`th-send ${gateOpen && !busy ? "ready" : ""}`}
                onClick={publish}
                disabled={!gateOpen || busy}
              >
                اعتماد ونشر الآن
              </button>
            )}
            {canApprove && status !== "published" && (
              <>
                <input
                  className="th-input"
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(event) => setScheduleAt(event.target.value)}
                  aria-label="موعد الجدولة"
                />
                <button className="th-save" onClick={schedule} disabled={!gateOpen || busy}>
                  {status === "scheduled" ? "تعديل موعد الجدولة" : "جدولة النشر"}
                </button>
              </>
            )}
            {status === "published" && (
              <button className="th-save" onClick={save} disabled={busy}>
                تحديث المادة المنشورة
              </button>
            )}
          </div>
        </div>

        {canApprove && (
          <div className="th-panel">
            <div className="th-meta">
              <div className="lb">أدوات النشر — للمعتمدين</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  className="th-mini"
                  style={pinned ? { background: "var(--t-gold)", borderColor: "var(--t-gold)", color: "#1a1503", fontWeight: 700 } : undefined}
                  onClick={() => setPinned(!pinned)}
                >
                  {pinned ? "★ مثبتة في صدارة الرئيسية — اضغط للإلغاء" : "تثبيت في صدارة الرئيسية"}
                </button>
                {breakingUntil ? (
                  <div style={{ fontSize: 11, lineHeight: 1.8 }}>
                    <span className="th-gchip block">عاجل حتى {breakingUntil.slice(11, 16)} UTC</span>{" "}
                    <button className="th-mini" onClick={() => setBreakingUntil(null)}>
                      أنهِ العاجل
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button className="th-mini" onClick={() => setBreakingUntil(hoursAhead(2))}>
                      ⚡ عاجل لساعتين
                    </button>
                    <button className="th-mini" onClick={() => setBreakingUntil(hoursAhead(6))}>
                      عاجل لست ساعات
                    </button>
                  </div>
                )}
                <div style={{ fontSize: 9.5, color: "var(--t-ink3)", lineHeight: 1.7 }}>
                  الشريط يظهر في الموقع فور الحفظ ويختفي وحده بانتهاء الصلاحية.
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="th-panel">
          <div className="th-meta">
            <div className="lb">الشكل</div>
            <div className="th-serpick">
              {FORMATS.map(([slug2, name]) => (
                <button
                  key={slug2}
                  className={format === slug2 ? "on" : ""}
                  style={{ "--sc": "var(--t-navy)" } as React.CSSProperties}
                  onClick={() => setFormat(slug2)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div className="th-meta">
            <div className="lb">السلسلة</div>
            <div className="th-serpick">
              {series.map((item) => (
                <button
                  key={item.slug}
                  className={seriesSlug === item.slug ? "on" : ""}
                  style={{ "--sc": item.color } as React.CSSProperties}
                  onClick={() => setSeriesSlug(seriesSlug === item.slug ? null : item.slug)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
          <div className="th-meta">
            <div className="lb">القسم</div>
            <select
              className="th-input"
              value={section}
              onChange={(event) => setSection(event.target.value)}
            >
              {sections.map(([slug2, name]) => (
                <option key={slug2} value={slug2}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="th-meta">
            <div className="lb">صورة المادة</div>
            <input
              className="th-input ltr"
              placeholder="/uploads/… أو رابط خارجي"
              value={image}
              onChange={(event) => setImage(event.target.value)}
            />
            {recentMedia.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {recentMedia.map((item) => (
                  <button
                    key={item.url}
                    className="th-mini"
                    title={item.filename}
                    style={{
                      padding: 0,
                      width: 44,
                      height: 32,
                      overflow: "hidden",
                      borderColor: image === item.url ? "var(--t-gold)" : undefined,
                    }}
                    onClick={() => setImage(item.url)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.filename}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </button>
                ))}
              </div>
            )}
            <div style={{ fontSize: 9.5, color: "var(--t-ink3)", marginTop: 6 }}>
              المصغرات من المكتبة موثقة الحقوق فقط — صورة غير موثقة تمنع النشر (§12).
            </div>
          </div>
          <div className="th-meta">
            <div className="lb">الرابط (لاتيني)</div>
            <input
              className="th-input ltr"
              placeholder="my-story-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
