"use client";

/**
 * مؤشرات المادة — بطاقة واحدة بأربعة وجوه تتقلّب: معدل القراءة، إكمال القراءة،
 * التفاعلات المباشرة، ونسبة التفاعل. النقاط مؤشر تنقّل، والسحب واللمس يعملان،
 * وتدور تلقائيًا حتى يتدخل القارئ. الأرقام من قراءات الزوار المجمّعة.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { INTERACTION_EVENT } from "@/app/_components/interaction-client";
import type { StoryInsights } from "@/lib/personalization/insights";
import { toLatinDigits } from "@/lib/format";

const n = (value: number) => toLatinDigits(String(value));
const ROTATE_MS = 7000;

function Trend({ value, unit = "%" }: { value: number; unit?: string }) {
  if (!value) return null;
  const up = value > 0;
  return (
    <span className={`ins-trend${up ? "" : " is-down"}`}>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d={up ? "M5 1l4 7H1z" : "M5 9L1 2h8z"} fill="currentColor" />
      </svg>
      <b className="latin-number" dir="ltr" lang="en">{up ? "+" : ""}{n(value)}{unit}</b>
    </span>
  );
}

/** منحنى ناعم لآخر 30 يومًا — مسار بيزييه بلا مكتبات. */
function Sparkline({ values }: { values: number[] }) {
  const w = 300;
  const h = 90;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 8 - (v / max) * (h - 16)] as const);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  }
  return (
    <svg className="ins-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="ins-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${w} ${h} L 0 ${h} Z`} fill="url(#ins-fill)" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function ArticleInsights({ storyId, readingMinutes }: { storyId: string; readingMinutes: number }) {
  const [data, setData] = useState<StoryInsights | null>(null);
  const loaded = data !== null;
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const userTouched = useRef(false);

  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let sequence = 0;
    const load = async () => {
      const id = ++sequence;
      try {
        const response = await fetch(`/api/content/insights?storyId=${encodeURIComponent(storyId)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("INSIGHTS_UNAVAILABLE");
        const json = await response.json();
        if (typeof json.readers !== "number") throw new Error("INVALID_INSIGHTS");
        if (id !== sequence || controller.signal.aborted) return;
        setData(json as StoryInsights);
        setFailed(false);
      } catch {
        if (!controller.signal.aborted && id === sequence) setFailed(true);
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    const changed = (event: Event) => { if ((event as CustomEvent).detail?.storyId === storyId) void load(); };
    window.addEventListener(INTERACTION_EVENT, changed);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener(INTERACTION_EVENT, changed); };
  }, [storyId, attempt]);

  const goTo = useCallback((next: number, smooth = true) => {
    const track = trackRef.current;
    if (!track) return;
    const count = track.children.length;
    const target = ((next % count) + count) % count;
    const child = track.children[target] as HTMLElement | undefined;
    if (!child) return;
    const rtl = getComputedStyle(track).direction === "rtl";
    const first = track.children[0].getBoundingClientRect();
    const rect = child.getBoundingClientRect();
    const left = rtl ? rect.right - first.right : rect.left - first.left;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left, behavior: smooth && !reduceMotion ? "smooth" : "instant" });
    setIndex(target);
  }, []);

  // مزامنة النقاط مع السحب اليدوي.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rtl = getComputedStyle(track).direction === "rtl";
        const rect = track.getBoundingClientRect();
        const padding = parseFloat(getComputedStyle(track).paddingInlineStart) || 0;
        const edge = rtl ? rect.right - padding : rect.left + padding;
        const distances = Array.from(track.children, child => {
          const box = child.getBoundingClientRect();
          return Math.abs((rtl ? box.right : box.left) - edge);
        });
        const next = distances.indexOf(Math.min(...distances));
        setIndex((current) => (current === next ? current : next));
      });
    };
    const onPointer = () => {
      userTouched.current = true;
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    track.addEventListener("pointerdown", onPointer, { passive: true });
    track.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("pointerdown", onPointer);
      track.removeEventListener("touchstart", onPointer);
      cancelAnimationFrame(raf);
    };
  }, [loaded]);

  // دوران تلقائي هادئ يتوقف بأول تدخل، ويحترم تقليل الحركة.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (userTouched.current) return;
      if (document.visibilityState !== "visible") return;
      goTo(index + 1);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [goTo, index]);

  if (failed && data === null) return <section className="ins" aria-label="مؤشرات المادة"><p role="status">تعذّر تحميل مؤشرات المادة</p><button type="button" onClick={() => setAttempt(value => value + 1)}>إعادة المحاولة</button></section>;

  if (!data) return <section className="ins" aria-label="مؤشرات المادة"><p role="status">جارٍ تحميل مؤشرات القراءة والتفاعل…</p></section>;
  const ins = data;
  const fresh = ins.readers < 20;
  const avg = fresh ? readingMinutes : ins.avgMinutes;
  const labels = ["< 2 د", "2–4 د", "4–6 د", "> 6 د"];
  const total = ins.likes + ins.answers;
  const titles = ["معدل القراءة", "إكمال القراءة", "التفاعلات المباشرة", "نسبة التفاعل"];

  const select = (i: number) => {
    userTouched.current = true;
    goTo(i);
  };

  return (
    <section className="ins" aria-label="مؤشرات المادة" data-loading={data === null && !failed ? "" : undefined} onFocusCapture={() => { userTouched.current = true; }}>
      {failed && <p className="ins-desc" role="status">تعذّر تحديث المؤشرات. <button type="button" onClick={() => setAttempt(value => value + 1)}>إعادة المحاولة</button></p>}
      {!failed && <p className="ins-desc ins-sample">{data === null ? "جارٍ تحميل المؤشرات…" : `${n(ins.readers)} متصفح ضمن قياس القراءة${fresh ? " · تظهر النسب بعد 20 قارئًا" : ""}`}</p>}
      <div className="ins-track" ref={trackRef}>
        {/* 1) معدل القراءة */}
        <article className="ins-face" aria-hidden={index !== 0}>
          <header>
            <h3>معدل القراءة</h3>
            {fresh ? null : <span className="ins-chip">{n(ins.readers)} قارئ</span>}
          </header>
          <p className="ins-big"><b className="latin-number" dir="ltr" lang="en">{n(avg)}</b><span>د</span></p>
          <p className="ins-desc">{fresh ? "الزمن المقدّر لقراءة المادة" : "متوسط الوقت الذي يقضيه القارئ في قراءة المحتوى"}</p>
          <ul className="ins-bars">
            {ins.timeBuckets.map((value, i) => (
              <li key={labels[i]}>
                <span className="lbl">{labels[i]}</span>
                <span className="bar"><i style={{ width: `${fresh ? 0 : value}%`, opacity: 0.5 + i * 0.16 }} /></span>
                {fresh ? <span className="val muted">—</span> : <span className="val latin-number" dir="ltr" lang="en">{`${n(value)}%`}</span>}
              </li>
            ))}
          </ul>
        </article>

        {/* 2) إكمال القراءة */}
        <article className="ins-face" aria-hidden={index !== 1}>
          <header>
            <h3>إكمال القراءة</h3>
            {fresh ? null : <span className="ins-chip">{n(ins.readers)} قارئ</span>}
          </header>
          {fresh ? <p className="ins-big ins-empty">العينة غير كافية بعد</p> : <p className="ins-big"><b className="latin-number" dir="ltr" lang="en">{n(ins.completion)}</b><span>%</span></p>}
          <p className="ins-desc">{fresh ? "تظهر النسب بعد 20 قارئًا" : "نسبة القرّاء الذين أكملوا قراءة المادة حتى النهاية"}</p>
          <div className="ins-progress"><i style={{ width: `${fresh ? 0 : ins.completion}%` }} /></div>
          <ul className="ins-steps">
            {([["مقدمة", ins.reach.intro], ["محتوى", ins.reach.body], ["خاتمة", ins.reach.end]] as const).map(([label, value], i) => (
              <li key={label}>
                <span className="bar"><i style={{ width: `${fresh ? 0 : value}%`, opacity: 0.55 + i * 0.22 }} /></span>
                <span className="lbl">{label}</span>
                {fresh ? <span className="val muted">—</span> : <span className="val latin-number" dir="ltr" lang="en">{`${n(value)}%`}</span>}
              </li>
            ))}
          </ul>
        </article>

        {/* 3) التفاعلات المباشرة */}
        <article className="ins-face" aria-hidden={index !== 2}>
          <header>
            <h3>التفاعلات المباشرة</h3>
            <Trend value={ins.trend} />
          </header>
          <p className="ins-big"><b className="latin-number" dir="ltr" lang="en">{n(total)}</b></p>
          <p className="ins-desc">مجموع الإعجابات الحالية وإجابات سؤال الختام، منذ بدء التسجيل</p>
          <div className="ins-split" aria-hidden="true">
            {total === 0 ? (
              <i className="empty" style={{ flex: 1 }} />
            ) : (
              <>
                <i style={{ flex: Math.max(ins.likes, 0.001) }} />
                <i className="alt" style={{ flex: Math.max(ins.answers, 0.001) }} />
              </>
            )}
          </div>
          <p className="ins-legend">
            <span><i />إعجابات <b className="latin-number" dir="ltr" lang="en">{n(ins.likes)}</b></span>
            <span><i className="alt" />إجابات سؤال الختام <b className="latin-number" dir="ltr" lang="en">{n(ins.answers)}</b></span>
          </p>
          <p className="ins-desc">الإعجابات والإجابات القائمة المسجّلة خلال آخر 30 يومًا</p>
          <Sparkline values={ins.daily} />
        </article>

        {/* 4) نسبة التفاعل */}
        <article className="ins-face" aria-hidden={index !== 3}>
          <header>
            <h3>نسبة التفاعل</h3>
            {!fresh && <span className="ins-chip">{n(ins.readers)} قارئ</span>}
          </header>
          {fresh ? <p className="ins-big ins-empty">العينة غير كافية بعد</p> : <p className="ins-big"><b className="latin-number" dir="ltr" lang="en">{n(ins.engagement)}</b><span>%</span></p>}
          <p className="ins-desc">{fresh ? "تظهر النسب بعد 20 قارئًا" : "نسبة المتصفحات ضمن قياس القراءة التي سجّلت إعجابًا أو إجابة لسؤال الختام"}</p>
          <div className="ins-progress"><i style={{ width: `${fresh ? 0 : ins.engagement}%` }} /></div>
          <p className="ins-desc">المشاهدات تقيس الوصول. الإعجاب والإجابة تفاعلان مباشران؛ من يقوم بهما معًا يُحتسب مرة واحدة في النسبة.</p>
        </article>
      </div>

      <nav className="ins-nav" aria-label="التنقل بين المؤشرات">
        <span className="ins-dots">
          {titles.map((title, i) => (
            <button
              key={title}
              type="button"
              className={i === index ? "is-on" : undefined}
              aria-label={title}
              aria-current={i === index ? "true" : undefined}
              onClick={() => select(i)}
            />
          ))}
        </span>
        <span className="ins-arrows">
          <button type="button" aria-label="السابق" onClick={() => select(index - 1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <button type="button" aria-label="التالي" onClick={() => select(index + 1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
        </span>
      </nav>
    </section>
  );
}
