"use client";

/**
 * صفحات «جاك العلم» الأفقية 16:9.
 * الصور عناصر تحريرية مستقلة داخل التخطيط، والنص العربي يبقى HTML حيًا قابلًا للتحرير والطباعة.
 */

import Image from "next/image";
import { useEffect, useState } from "react";

import type { JakSlide, ReportTemplate, SlideData } from "@/lib/tahrir/jak";

interface ReportMeta {
  title: string;
  sectionName: string;
}

const templateOf = (slide: JakSlide, index: number): ReportTemplate => {
  if (slide.data?.template) return slide.data.template;
  if (index === 0) return "cover";
  if (slide.type === "stat" || slide.type === "comparison") return "stats";
  if (slide.type === "list" || slide.type === "summary" || slide.type === "timeline") return "grid";
  return "image-text";
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

function ReportArt({ slide, onReadyChange }: { slide: JakSlide; onReadyChange: (ready: boolean) => void }) {
  useEffect(() => onReadyChange(false), [onReadyChange, slide.image]);
  if (!slide.image) return null;
  return (
    <div className="jak-report-art">
      <Image
        src={slide.image}
        alt=""
        fill
        unoptimized={slide.image.startsWith("/uploads/")}
        sizes="(max-width: 1100px) 100vw, 1280px"
        style={{ objectPosition: `${slide.data?.focalPoint ?? "center"} center` }}
        onLoad={() => onReadyChange(true)}
        onError={() => onReadyChange(false)}
      />
    </div>
  );
}

function ReportPage({ slide, index, total, meta }: {
  slide: JakSlide;
  index: number;
  total: number;
  meta: ReportMeta;
}) {
  const template = templateOf(slide, index);
  const blocks = fallbackBlocks(slide);
  const safe = slide.data?.textSafeArea ?? (template === "image-text" ? "right" : "center");
  const [artReady, setArtReady] = useState(false);

  return (
    <section
      className={`jak-report-page jak-report-${template} safe-${safe} ${artReady ? "has-art" : "no-art"}`}
      data-report-page
      data-template={template}
    >
      <ReportArt key={slide.image ?? "no-image"} slide={slide} onReadyChange={setArtReady} />
      <header className="jak-report-brand">
        <span>الع<i>ل</i>م</span>
        <small>{meta.sectionName}</small>
      </header>

      {template === "cover" && (
        <div className="jak-report-cover-copy">
          <span className="jak-report-eyebrow">{slide.data?.eyebrow || "تقرير بصري"}</span>
          <h1>{slide.title || meta.title}</h1>
          {slide.body && <p>{slide.body}</p>}
        </div>
      )}

      {template === "image-text" && (
        <div className="jak-report-copy">
          <span className="jak-report-eyebrow">{slide.data?.eyebrow || "في الصورة"}</span>
          <h2>{slide.title}</h2>
          {slide.body && <p>{slide.body}</p>}
          {slide.stat && (
            <div className="jak-report-inline-stat">
              <strong dir="ltr">{slide.stat}</strong>
              <span>{slide.statLabel}</span>
            </div>
          )}
        </div>
      )}

      {(template === "stats" || template === "grid") && (
        <div className="jak-report-dashboard">
          <div className="jak-report-dashboard-head">
            <span className="jak-report-eyebrow">{slide.data?.eyebrow || (template === "stats" ? "بالأرقام" : "المشهد")}</span>
            <h2>{slide.title}</h2>
            {slide.body && <p>{slide.body}</p>}
          </div>
          <div className={`jak-report-blocks count-${Math.min(blocks.length, 6)}`}>
            {blocks.map((block, blockIndex) => (
              <article className="jak-report-block" key={blockIndex}>
                {block.value && <strong dir="ltr">{block.value}</strong>}
                {block.label && <small>{block.label}</small>}
                {block.title && <h3>{block.title}</h3>}
                {block.body && <p>{block.body}</p>}
              </article>
            ))}
          </div>
        </div>
      )}

      <footer className="jak-report-foot">
        <span>#{slide.data?.eyebrow?.replace(/\s+/g, "_") || "جاك_العلم"}</span>
        <b dir="ltr">{index + 1} / {total}</b>
      </footer>
    </section>
  );
}

export function JakReport({ meta, slides }: { meta: ReportMeta; slides: JakSlide[] }) {
  const visible = slides.filter((slide) => !slide.hidden && slide.type !== "end");
  return (
    <div className="jak-report" data-jak-report>
      {visible.map((slide, index) => (
        <ReportPage key={slide.id} slide={slide} index={index} total={visible.length} meta={meta} />
      ))}
    </div>
  );
}
