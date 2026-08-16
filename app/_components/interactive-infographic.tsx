"use client";

/**
 * عارض «الإنفوجرافيك التفاعلي الذكي» — تجربة بصرية متحركة وغامرة.
 */

import React, { useEffect, useRef, useState } from "react";

import {
  INFOGRAPHIC_THEMES,
  THEME_CONFIGS,
  type InfographicData,
  type InfographicShowcaseItem,
  type InfographicThemeId,
} from "@/lib/ai/infographic-types";

import "./infographic-motion.css";

// أصوات المحيط التخليقية عبر Web Audio API
class AmbientSynth {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private isPlaying = false;

  toggle(): boolean {
    if (typeof window === "undefined") return false;
    if (this.isPlaying) {
      this.stop();
      return false;
    }
    this.start();
    return true;
  }

  private start() {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 1.5;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 280;

      this.gain = this.ctx.createGain();
      this.gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
      this.gain.gain.exponentialRampToValueAtTime(0.08, this.ctx.currentTime + 1.5);

      noise.connect(filter);
      filter.connect(this.gain);
      this.gain.connect(this.ctx.destination);
      noise.start();
      this.isPlaying = true;
    } catch {
      this.isPlaying = false;
    }
  }

  private stop() {
    if (this.gain && this.ctx) {
      try {
        this.gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
        setTimeout(() => {
          this.ctx?.close();
          this.ctx = null;
          this.isPlaying = false;
        }, 500);
      } catch {
        this.isPlaying = false;
      }
    }
  }
}

const synthInstance = new AmbientSynth();

/** عدّاد الأرقام التصاعدي التفاعلي */
function AnimatedCounter({
  target,
  decimals = 1,
  prefix = "",
  suffix = "",
}: {
  target: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const duration = 1800;
    const stepTime = 16;
    const steps = duration / stepTime;
    const increment = target / steps;

    const interval = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCurrent(target);
        clearInterval(interval);
      } else {
        setCurrent(Number(start.toFixed(decimals)));
      }
    }, stepTime);

    return () => clearInterval(interval);
  }, [started, target, decimals]);

  return (
    <span ref={ref} className="tabular-nums font-bold" dir="ltr">
      {prefix}
      {current.toLocaleString("en-US", {
        minimumFractionDigits: target % 1 !== 0 ? decimals : 0,
        maximumFractionDigits: decimals,
      })}
      {suffix && <span className="mr-1 text-sm font-normal opacity-85">{suffix}</span>}
    </span>
  );
}

/** أيقونة توضيحية افتراضية للكائنات البحرية أو التقنية */
function AssetVisual({ item, accentColor }: { item: InfographicShowcaseItem; accentColor: string }) {
  if (item.imageUrl) {
    return (
      <div className="info-cutout-container">
        <div className="info-cutout-glow" style={{ background: accentColor }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt={item.name}
          className="info-cutout-asset"
        />
      </div>
    );
  }

  // رسم فني متجهي مضيء متوافق مع النمط
  return (
    <div className="info-cutout-container">
      <div className="info-cutout-glow" style={{ background: accentColor }} />
      <svg
        viewBox="0 0 120 80"
        className="w-36 h-28 drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] transition-transform duration-500 group-hover:scale-110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M10 40C25 20 65 15 95 30C105 20 115 15 118 20C115 35 115 45 118 60C115 65 105 60 95 50C65 65 25 60 10 40Z"
          fill="url(#gradFish)"
          stroke={accentColor}
          strokeWidth="1.5"
        />
        <circle cx="30" cy="35" r="3.5" fill="#ffffff" />
        <circle cx="31" cy="35" r="1.5" fill="#021224" />
        <path
          d="M45 28C55 35 55 45 45 52"
          stroke={accentColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.7"
        />
        <path
          d="M60 26C72 35 72 45 60 54"
          stroke={accentColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.7"
        />
        <defs>
          <linearGradient id="gradFish" x1="10" y1="40" x2="118" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor={accentColor} stopOpacity="0.3" />
            <stop offset="0.6" stopColor={accentColor} stopOpacity="0.8" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.9" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export function InteractiveInfographic({
  data: initialData,
  enableControls = true,
}: {
  data: InfographicData;
  enableControls?: boolean;
}) {
  const [data, setData] = useState<InfographicData>(initialData);
  const [activeTheme, setActiveTheme] = useState<InfographicThemeId>(initialData.themeId || "ocean-cyber");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeItem, setActiveItem] = useState<InfographicShowcaseItem | null>(null);
  const [visionMode, setVisionMode] = useState<"current" | "2030">("2030");
  const [soundOn, setSoundOn] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("hero");

  const theme = THEME_CONFIGS[activeTheme] || THEME_CONFIGS["ocean-cyber"];

  // تحديث النمط
  const handleThemeChange = (newTheme: InfographicThemeId) => {
    setActiveTheme(newTheme);
    setData((prev) => ({ ...prev, themeId: newTheme }));
  };

  // مراقبة المقاطع النشطة
  useEffect(() => {
    const handleScroll = () => {
      const sections = ["hero", "macro", "showcase", "operations", "impact", "vision"];
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 200 && rect.bottom >= 200) {
            setActiveSection(id);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const categories = [
    "all",
    ...Array.from(new Set(data.showcaseSection?.items?.map((item) => item.category) || [])),
  ];

  const filteredItems =
    selectedCategory === "all"
      ? data.showcaseSection?.items || []
      : data.showcaseSection?.items?.filter((item) => item.category === selectedCategory) || [];

  return (
    <div
      className="info-container"
      style={
        {
          "--info-bg": theme.bgGradient,
          "--info-card-bg": theme.cardBg,
          "--info-card-border": theme.cardBorder,
          "--info-glow": theme.glowColor,
          "--info-accent": theme.accentColor,
          "--info-text": theme.textColor,
          "--info-subtext": theme.subtextColor,
        } as React.CSSProperties
      }
    >
      {/* جسيمات الخلفية العائمة */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="info-bubble"
            style={{
              left: `${(i * 9 + 4) % 96}%`,
              width: `${12 + (i % 4) * 8}px`,
              height: `${12 + (i % 4) * 8}px`,
              animationDuration: `${7 + (i % 5) * 3}s`,
              animationDelay: `${(i * 1.3) % 6}s`,
            }}
          />
        ))}
      </div>

      {/* شريط التحكم العلوي */}
      {enableControls && (
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/40 border-b border-white/10 px-4 py-2.5 flex items-center justify-between text-xs transition-all">
          <div className="flex items-center gap-3">
            <span className="font-bold flex items-center gap-1.5" style={{ color: theme.accentColor }}>
              <span className="inline-block w-2 h-2 rounded-full animate-ping" style={{ background: theme.accentColor }} />
              استوديو الإنفوجرافيك التفاعلي
            </span>
            <span className="hidden sm:inline text-white/40">|</span>
            <span className="hidden sm:inline text-white/70">{data.title}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* مبدل الأنماط */}
            <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/10">
              {INFOGRAPHIC_THEMES.map((tId) => {
                const conf = THEME_CONFIGS[tId];
                return (
                  <button
                    key={tId}
                    title={conf.name}
                    onClick={() => handleThemeChange(tId)}
                    className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${
                      activeTheme === tId ? "bg-white/20 font-bold shadow" : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: conf.accentColor }} />
                    <span className="hidden md:inline">{conf.name.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>

            {/* زر الصوت */}
            <button
              onClick={() => setSoundOn(synthInstance.toggle())}
              className={`px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                soundOn ? "bg-cyan-500/20 border-cyan-400 text-cyan-300" : "bg-white/5 border-white/10 text-white/60 hover:text-white"
              }`}
              title="مؤثرات صوتية محيطية"
            >
              {soundOn ? "🔊 صوت المحيط" : "🔇 كتم"}
            </button>
          </div>
        </header>
      )}

      {/* مسطرة التنقل والعمق الجانبية */}
      <nav className="info-depth-gauge" aria-label="مقياس العمق">
        {[
          { id: "hero", label: "السطح 0m", title: "الافتتاحية" },
          { id: "macro", label: "المصايد 20m", title: "صيد وحصاد" },
          { id: "showcase", label: "الأعماق 50m", title: "الإنتاج المتنوع" },
          { id: "operations", label: "الشبكات 80m", title: "الأسطول والموانئ" },
          { id: "impact", label: "الأثر 100m", title: "العوائد والوظائف" },
          { id: "vision", label: "الرؤية 150m", title: "مستهدفات 2030" },
        ].map((sec) => (
          <button
            key={sec.id}
            onClick={() => document.getElementById(sec.id)?.scrollIntoView({ behavior: "smooth" })}
            className={`info-depth-dot ${activeSection === sec.id ? "active" : ""}`}
            aria-label={sec.title}
          >
            <span className="info-depth-tooltip">{sec.label} · {sec.title}</span>
          </button>
        ))}
      </nav>

      {/* المحتوى الرئيسي */}
      <main className="max-w-5xl mx-auto px-4 py-12 relative z-10 space-y-24">

        {/* 1. المشهد الافتتاحي (Hero Section) */}
        <section id="hero" className="text-center pt-8 pb-4 relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border bg-white/5 backdrop-blur-md mb-6 shadow-lg text-xs font-semibold" style={{ borderColor: theme.cardBorder, color: theme.accentColor }}>
            <span className="w-2 h-2 rounded-full" style={{ background: theme.accentColor }} />
            {data.eyebrow}
          </div>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-black mb-6 leading-tight drop-shadow-lg tracking-tight"
            style={{
              backgroundImage: `linear-gradient(135deg, #ffffff 40%, ${theme.accentColor} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {data.title}
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg leading-relaxed mb-8 opacity-85 font-normal" style={{ color: theme.subtextColor }}>
            {data.introText}
          </p>

          {/* خريطة المملكة النيونية التفاعلية */}
          <div className="relative max-w-xl mx-auto my-10 p-6 rounded-3xl info-glass info-tech-corners">
            <div className="flex items-center justify-between text-xs mb-4 text-white/70">
              <span className="font-semibold">{data.hero?.badge || "نطاق التغطية والاستثمار"}</span>
              <span style={{ color: theme.accentColor }}>{data.hero?.mapHighlight || "البحر الأحمر والخليج العربي"}</span>
            </div>

            {/* رسم خريطة المملكة النيونية المبسطة */}
            <div className="w-full h-44 flex items-center justify-center relative">
              <svg viewBox="0 0 400 200" className="w-full h-full opacity-80" fill="none">
                {/* شبكة نيون */}
                <path d="M50 150 L120 120 L220 130 L320 80 L350 40" stroke={theme.accentColor} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />
                <path d="M120 120 L200 60 L280 90 L350 40" stroke={theme.accentColor} strokeWidth="1.5" opacity="0.4" />
                
                {/* نقاط المراكز الساحلية */}
                {[
                  { cx: 70, cy: 140, label: "جازان" },
                  { cx: 120, cy: 110, label: "جدة" },
                  { cx: 160, cy: 80, label: "ينبع" },
                  { cx: 220, cy: 50, label: "نيوم" },
                  { cx: 330, cy: 75, label: "الدمام" },
                  { cx: 355, cy: 45, label: "الجبيل" },
                ].map((pt, idx) => (
                  <g key={idx}>
                    <circle cx={pt.cx} cy={pt.cy} r="5" fill={theme.accentColor} className="animate-pulse" />
                    <circle cx={pt.cx} cy={pt.cy} r="9" stroke={theme.accentColor} strokeWidth="1" opacity="0.5" />
                    <text x={pt.cx} y={pt.cy - 12} fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">
                      {pt.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </section>

        {/* 2. صيد وحصاد وفير (Macro Stats) */}
        <section id="macro" className="space-y-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-black mb-2 flex items-center justify-center gap-3">
              <span className="w-8 h-0.5" style={{ background: theme.accentColor }} />
              {data.macroSection?.title || "صيد وحصاد وفير"}
              <span className="w-8 h-0.5" style={{ background: theme.accentColor }} />
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {data.macroSection?.stats?.map((stat) => (
              <div key={stat.id} className="info-glass p-6 rounded-2xl flex flex-col justify-between text-center relative group">
                {stat.trend && (
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {stat.trend}
                  </span>
                )}
                <div className="my-4">
                  <div className="text-4xl sm:text-5xl font-black mb-2" style={{ color: theme.accentColor }}>
                    <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="text-sm font-semibold text-white/90">{stat.label}</p>
                </div>
                {stat.sublabel && (
                  <p className="text-xs mt-2 opacity-60 border-t border-white/10 pt-2">{stat.sublabel}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 3. الإنتاج متنوع (Showcase Section with 3D Floating Assets) */}
        <section id="showcase" className="space-y-8">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-black mb-2 flex items-center justify-center gap-3">
              <span className="w-8 h-0.5" style={{ background: theme.accentColor }} />
              {data.showcaseSection?.title || "الإنتاج متنوّع"}
              <span className="w-8 h-0.5" style={{ background: theme.accentColor }} />
            </h2>
            <p className="text-sm text-white/70 max-w-xl mx-auto">{data.showcaseSection?.subtitle}</p>
          </div>

          {/* فلاتر التصنيف */}
          {categories.length > 2 && (
            <div className="flex flex-wrap items-center justify-center gap-2 my-6">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    selectedCategory === cat
                      ? "bg-white text-slate-900 shadow-lg font-bold"
                      : "bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  {cat === "all" ? "جميع الأنواع" : cat}
                </button>
              ))}
            </div>
          )}

          {/* شبكة العناصر العائمة */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item, idx) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setActiveItem(item)}
                className="info-glass p-6 rounded-2xl flex flex-col justify-between cursor-pointer group hover:-translate-y-2 transition-all duration-300 text-right w-full"
              >
                <div className="w-full">
                  <div className="flex items-center justify-between text-xs text-white/60 mb-2">
                    <span className="px-2 py-0.5 rounded bg-white/10">{item.category}</span>
                    <span className="text-xs font-mono">#0{idx + 1}</span>
                  </div>

                  {/* العنصر البصري العائم */}
                  <div className={idx % 2 === 0 ? "info-anim-bob" : "info-anim-drift"}>
                    <AssetVisual item={item} accentColor={theme.accentColor} />
                  </div>

                  <h3 className="text-lg font-black mt-3 text-white transition-colors" style={{ color: "#ffffff" }}>
                    {item.name}
                  </h3>
                  <p className="text-xs mt-1 line-clamp-2 leading-relaxed font-normal" style={{ color: "rgba(240, 253, 250, 0.85)" }}>
                    {item.description}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10 flex items-baseline justify-between w-full">
                  <span className="text-xs text-white/60 font-normal">حجم الإنتاج:</span>
                  <div className="text-xl font-bold" style={{ color: theme.accentColor }}>
                    <AnimatedCounter target={item.statValue} suffix={item.statSuffix} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 4. العمليات والشبكات (Operations Grid) */}
        <section id="operations" className="space-y-8">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-black mb-2 flex items-center justify-center gap-3">
              <span className="w-8 h-0.5" style={{ background: theme.accentColor }} />
              {data.operationsSection?.title || "شباك في كل جهة"}
              <span className="w-8 h-0.5" style={{ background: theme.accentColor }} />
            </h2>
            {data.operationsSection?.subtitle && (
              <p className="text-sm text-white/70 max-w-xl mx-auto">{data.operationsSection.subtitle}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {data.operationsSection?.blocks?.map((block) => (
              <div key={block.id} className="info-glass info-tech-corners p-6 rounded-2xl flex items-center justify-between">
                <div>
                  {block.badge && (
                    <span className="inline-block text-[10px] px-2 py-0.5 rounded font-bold uppercase mb-2 bg-white/10" style={{ color: theme.accentColor }}>
                      {block.badge}
                    </span>
                  )}
                  <h4 className="text-base font-bold text-white mb-1">{block.title}</h4>
                  <p className="text-xs text-white/60">{block.label}</p>
                </div>
                <div className="text-2xl sm:text-3xl font-black px-4 py-2 rounded-xl bg-white/5 border border-white/10" style={{ color: theme.accentColor }}>
                  {block.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. الأثر الاقتصادي (Impact Section) */}
        <section id="impact" className="space-y-8">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-black mb-2 flex items-center justify-center gap-3">
              <span className="w-8 h-0.5" style={{ background: theme.accentColor }} />
              {data.impactSection?.title || "قطاع يتمدّد"}
              <span className="w-8 h-0.5" style={{ background: theme.accentColor }} />
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.impactSection?.metrics?.map((metric) => (
              <div key={metric.id} className="info-glass p-5 rounded-2xl text-center">
                <div className="text-2xl sm:text-3xl font-black mb-1" style={{ color: theme.accentColor }}>
                  <AnimatedCounter target={metric.value} suffix={metric.suffix} />
                </div>
                <p className="text-xs text-white/80 font-medium leading-snug">{metric.label}</p>
              </div>
            ))}
          </div>

          {data.impactSection?.footerNote && (
            <p className="text-center text-xs opacity-50 font-mono mt-4">{data.impactSection.footerNote}</p>
          )}
        </section>

        {/* 6. الرؤية تقود النمو (Vision 2030 Simulator) */}
        <section id="vision" className="p-8 sm:p-12 rounded-3xl info-glass info-tech-corners relative overflow-hidden">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-block px-4 py-1 rounded-full text-xs font-black mb-3 bg-amber-400/20 text-amber-300 border border-amber-400/30">
              رؤية VISION 2030
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-3">{data.visionSection?.title || "الرؤية تقود النمو"}</h2>
            <p className="text-sm text-white/80 leading-relaxed">{data.visionSection?.subtitle}</p>

            {/* مبدل الرؤية التفاعلي */}
            <div className="inline-flex items-center bg-white/10 rounded-full p-1 border border-white/20 mt-6 shadow-inner">
              <button
                onClick={() => setVisionMode("current")}
                className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  visionMode === "current" ? "bg-white text-slate-900 shadow-md" : "text-white/70 hover:text-white"
                }`}
              >
                الإنتاج الحالي (2024)
              </button>
              <button
                onClick={() => setVisionMode("2030")}
                className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  visionMode === "2030" ? "bg-emerald-400 text-slate-950 shadow-md font-black" : "text-white/70 hover:text-white"
                }`}
              >
                مستهدفات 2030 🚀
              </button>
            </div>
          </div>

          {/* أشرطة المقارنة التفاعلية */}
          <div className="space-y-6 max-w-3xl mx-auto">
            {data.visionSection?.targets?.map((target) => {
              const currentVal = target.currentValue;
              const targetVal = target.targetValue;
              const percentage = Math.min(100, Math.round((currentVal / targetVal) * 100));
              const displayVal = visionMode === "2030" ? targetVal : currentVal;

              return (
                <div key={target.id} className="bg-black/30 p-4 rounded-xl border border-white/10">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-bold text-white">{target.label}</span>
                    <span className="font-black text-base" style={{ color: theme.accentColor }}>
                      <AnimatedCounter target={displayVal} suffix={target.unit} />
                    </span>
                  </div>

                  <div className="info-vision-bar my-2">
                    <div
                      className="info-vision-fill"
                      style={{
                        width: visionMode === "2030" ? "100%" : `${Math.max(15, percentage)}%`,
                        background:
                          visionMode === "2030"
                            ? "linear-gradient(90deg, #10b981, #34d399)"
                            : theme.accentColor,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-white/50">
                    <span>الوضع الراهن: {currentVal} {target.unit}</span>
                    {target.growthMultiplier && (
                      <span className="font-bold text-emerald-400">مستهدف: {target.growthMultiplier}</span>
                    )}
                    <span>المستهدف: {targetVal} {target.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {data.visionSection?.closingStatement && (
            <p className="mt-8 text-center text-xs text-white/70 max-w-xl mx-auto leading-relaxed border-t border-white/10 pt-6">
              {data.visionSection.closingStatement}
            </p>
          )}
        </section>

      </main>

      {/* نافذة تفاصيل العنصر المنبثقة (Detail Modal) */}
      {activeItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
        >
          <button
            type="button"
            aria-label="إغلاق"
            className="absolute inset-0 w-full h-full bg-transparent border-0 cursor-default"
            onClick={() => setActiveItem(null)}
          />
          <div
            className="info-glass max-w-md w-full p-6 rounded-3xl relative border border-cyan-400/40 shadow-2xl z-10"
          >
            <button
              type="button"
              onClick={() => setActiveItem(null)}
              className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
            >
              ✕
            </button>

            <div className="text-center pt-2">
              <span className="text-xs px-3 py-1 rounded-full bg-white/10 text-cyan-300 font-semibold mb-2 inline-block">
                {activeItem.category}
              </span>
              <h3 className="text-2xl font-black text-white">{activeItem.name}</h3>

              <div className="my-4 info-anim-bob">
                <AssetVisual item={activeItem} accentColor={theme.accentColor} />
              </div>

              <div className="text-3xl font-black my-2" style={{ color: theme.accentColor }}>
                {activeItem.statValue} <span className="text-sm font-normal text-white/80">{activeItem.statSuffix}</span>
              </div>

              <p className="text-sm text-white/80 leading-relaxed my-4">{activeItem.description}</p>

              {activeItem.imagePrompt && (
                <div className="text-left bg-black/40 p-3 rounded-lg border border-white/10 text-[10px] text-white/50 font-mono mt-3">
                  <div className="text-white/80 font-bold mb-1">AI Visual Prompt:</div>
                  {activeItem.imagePrompt}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
