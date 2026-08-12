"use client";

/**
 * صفحات «جاك العلم» الأفقية 16:9 — معالجة غامرة بأسلوب التقرير المصمم.
 *
 * القاعدة: الشريحة ذات الصورة تصير صفحة كاملة بالصورة والنص فوقها خلف سكريم
 * اتجاهي يضمن التباين؛ والشريحة بلا صورة تصير لوح بيانات على المداد.
 * النص يبقى HTML حيًا في الحالين — قابلًا للقراءة والفهرسة والطباعة إلى PDF.
 */

import Image from "next/image";
import { useState } from "react";

import type { JakSlide, SlideData } from "@/lib/tahrir/jak";

import { JakReportMotion } from "./jak-report-motion";

interface ReportMeta {
  title: string;
  sectionName: string;
}

/**
 * يفصل الرقم عن لاحقته («3.9 مليار ريال» → 3.9 + مليار ريال) ليصعد الرقم وحده،
 * وتبقى القيمة كاملة في HTML الخادم كما هي.
 */
function StatValue({ value }: { value: string }) {
  const match = /^(\D*?)(\d+(?:\.\d+)?)([\s\S]*)$/.exec(value.trim());
  if (!match) return <>{value}</>;
  const [, prefix, number, suffix] = match;
  return (
    <>
      {prefix}
      <span className="jak-report-countup" data-countup={number}>{number}</span>
      {suffix}
    </>
  );
}

/**
 * جهة النص = عكس موضوع الصورة دائمًا، فلا يجلس الكلام فوق ما تركّز عليه الصورة.
 * تصنيف الذكاء يُحترم ما لم يناقض نفسه (نص وموضوع في الجهة ذاتها).
 */
const OPPOSITE = { left: "right", right: "left", center: "center" } as const;

function textSideOf(slide: JakSlide): "left" | "right" | "center" {
  const focal = (slide.data?.focalPoint ?? "center") as keyof typeof OPPOSITE;
  const declared = slide.data?.textSafeArea as "left" | "right" | "center" | undefined;
  if (declared && declared !== focal) return declared;
  return OPPOSITE[focal] ?? "center";
}

/** شكل الصفحة: غلاف · اقتباس · صورة ساردة · لوح بيانات. */
type PageKind = "cover" | "quote" | "photo" | "data";

/** قوالب البيانات تبقى لوحًا مهما حملت صورة — الصورة فيها خلفية خافتة لا موضوعًا. */
const DATA_TEMPLATES = new Set(["stats", "grid"]);

const kindOf = (slide: JakSlide, index: number, hasArt: boolean): PageKind => {
  if (slide.data?.template && DATA_TEMPLATES.has(slide.data.template)) return "data";
  if (!hasArt) return "data";
  if (index === 0 || slide.type === "hero") return "cover";
  if (slide.type === "quote") return "quote";
  return "photo";
};

const fallbackBlocks = (slide: JakSlide): NonNullable<SlideData["blocks"]> => {
  if (slide.data?.blocks?.length) return slide.data.blocks;
  if (slide.data?.items?.length) {
    return slide.data.items.map((body) => ({ title: "", body, value: "", label: "" }));
  }
  if (slide.data?.sides?.length) {
    return slide.data.sides.map((side) => ({ title: side.label, body: "", value: side.value, label: "" }));
  }
  if (slide.data?.points?.length) {
    return slide.data.points.map((point) => ({
      title: point.title,
      body: point.detail,
      value: point.year,
      label: "",
    }));
  }
  if (slide.stat || slide.body) {
    return [{ title: slide.title, body: slide.body, value: slide.stat, label: slide.statLabel }];
  }
  return [];
};

function ReportPage({ slide, index, total, meta }: {
  slide: JakSlide;
  index: number;
  total: number;
  meta: ReportMeta;
}) {
  /**
   * شكل الصفحة يُحسم من وجود الصورة لا من اكتمال تحميلها — وإلا خرجت من الخادم
   * لوح بيانات ثم قفزت إلى صورة بعد الترطيب (وميض محتوى مختلف كليًا).
   * الفشل الفعلي وحده يُسقطها إلى لوح البيانات.
   */
  const [artFailed, setArtFailed] = useState(false);

  const hasArt = Boolean(slide.image) && !artFailed;
  const kind = kindOf(slide, index, hasArt);
  const eyebrow = slide.data?.eyebrow || (kind === "data" ? "بالأرقام" : "جاك العلم");
  const safe = textSideOf(slide);
  const blocks = fallbackBlocks(slide);
  const listItems = slide.data?.items ?? [];

  return (
    <section
      className={`jak-report-page kind-${kind} safe-${safe} ${hasArt ? "has-art" : "no-art"}`}
      data-report-page
      data-template={kind}
    >
      {slide.image && (
        <Image
          className="jak-report-bg"
          src={slide.image}
          alt=""
          fill
          unoptimized={slide.image.startsWith("/uploads/")}
          sizes="(max-width: 1100px) 100vw, 1280px"
          style={{ objectPosition: `${slide.data?.focalPoint ?? "center"} center` }}
          onError={() => setArtFailed(true)}
          priority={index === 0}
        />
      )}
      <span className="jak-report-scrim" aria-hidden="true" />

      <header className="jak-report-brand">
        <span>الع<i>ل</i>م</span>
        <small>{meta.sectionName}</small>
      </header>

      {kind === "quote" && (
        <div className="jak-report-copy">
          <span className="jak-report-eyebrow">{eyebrow}</span>
          <blockquote>{slide.title}</blockquote>
          {slide.data?.quoteBy && <cite>— {slide.data.quoteBy}</cite>}
        </div>
      )}

      {(kind === "cover" || kind === "photo") && (
        <div className="jak-report-copy">
          <span className="jak-report-eyebrow">{eyebrow}</span>
          {kind === "cover" ? <h1>{slide.title || meta.title}</h1> : <h2>{slide.title}</h2>}
          {slide.body && <p>{slide.body}</p>}
          {slide.stat && (
            <div className="jak-report-inline-stat">
              <strong dir="ltr"><StatValue value={slide.stat} /></strong>
              <span>{slide.statLabel}</span>
            </div>
          )}
          {listItems.length > 0 && (
            <ul className="jak-report-list">
              {listItems.slice(0, 4).map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {kind === "data" && (
        <>
          <div className="jak-report-dashboard-head">
            <span className="jak-report-eyebrow">{eyebrow}</span>
            <h2>{slide.title}</h2>
            {slide.body && <p>{slide.body}</p>}
          </div>
          <div className={`jak-report-blocks count-${Math.min(blocks.length, 6)}`}>
            {blocks.slice(0, 6).map((block, blockIndex) => (
              <article className="jak-report-block" key={blockIndex}>
                {block.value && <strong dir="ltr"><StatValue value={block.value} /></strong>}
                {block.label && <small>{block.label}</small>}
                {block.title && <h3>{block.title}</h3>}
                {block.body && <p>{block.body}</p>}
              </article>
            ))}
          </div>
        </>
      )}

      <footer className="jak-report-foot">
        <span>#{eyebrow.replace(/\s+/g, "_")}</span>
        <b dir="ltr">{index + 1} / {total}</b>
      </footer>
    </section>
  );
}

export function JakReport({ meta, slides }: { meta: ReportMeta; slides: JakSlide[] }) {
  const visible = slides.filter((slide) => !slide.hidden && (slide.type !== "end" || slide.image));
  return (
    <div className="jak-report" data-jak-report>
      {visible.map((slide, index) => (
        <ReportPage
          key={`${slide.id}-${slide.image ?? "none"}`}
          slide={slide}
          index={index}
          total={visible.length}
          meta={meta}
        />
      ))}
      <JakReportMotion />
    </div>
  );
}
