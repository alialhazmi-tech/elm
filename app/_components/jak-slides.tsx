/**
 * قارئ «جاك العلم» — عرض الشرائح العمودية الغامرة.
 * مكوّن عرض خالص (يعمل خادمًا وعميلًا): المعنى من قاعدة البيانات، والشكل هنا.
 * الحركة والعدادات في jak-motion (عميل ~1.5KB) — والصفحة مقروءة كاملة بدونه.
 */

import Image from "next/image";

import type { JakSlide } from "@/lib/tahrir/jak";

import { JakMotion } from "./jak-motion";

export interface JakStoryMeta {
  title: string;
  sectionName: string;
  readingMinutes: number;
  publishedLabel?: string;
  shareUrl: string;
  next?: { title: string; href: string } | null;
}

/** "73%" → {value:73, suffix:"%"} — وغير الرقمي يُعرض نصًا ساكنًا. */
function parseStat(stat: string): { value: number; suffix: string } | null {
  const match = /^([0-9]+(?:\.[0-9]+)?)\s*(.*)$/.exec(stat.trim());
  if (!match) return null;
  return { value: Number(match[1]), suffix: match[2] };
}

const compWidth = (value: string, other: string) => {
  const a = Number.parseFloat(value);
  const b = Number.parseFloat(other);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.max(a, b) <= 0) return 100;
  return Math.max(12, Math.round((a / Math.max(a, b)) * 100));
};

const ART_FALLBACKS = ["jart-a", "jart-b", "jart-c"];

function Art({ slide, index, priority }: { slide: JakSlide; index: number; priority: boolean }) {
  if (slide.image) {
    return (
      <div className="jak-art">
        <Image
          src={slide.image}
          alt=""
          fill
          sizes="(max-width: 700px) 100vw, 620px"
          priority={priority}
          loading={priority ? undefined : "lazy"}
        />
      </div>
    );
  }
  // بلا صورة: تدرج من هوية العلم يحمل الشريحة وحده.
  return <div className={`jak-art ${ART_FALLBACKS[index % ART_FALLBACKS.length]}`} />;
}

function SlideBody({ slide }: { slide: JakSlide }) {
  const stat = slide.stat ? parseStat(slide.stat) : null;

  switch (slide.type) {
    case "stat":
      return (
        <div className="jak-center">
          {slide.title && <span className="jak-kick jrv">{slide.title}</span>}
          <div className="jak-big" dir="ltr">
            {stat ? (
              <>
                <span data-count={stat.value}>0</span>
                <small>{stat.suffix}</small>
              </>
            ) : (
              slide.stat
            )}
          </div>
          {slide.statLabel && <p className="jak-biglbl jrv jd1">{slide.statLabel}</p>}
          {slide.body && <p className="jrv jd2">{slide.body}</p>}
        </div>
      );

    case "comparison": {
      const sides = slide.data?.sides ?? [];
      const [first, second] = sides;
      return (
        <div className="jak-center">
          {slide.title && <h2 className="jrv">{slide.title}</h2>}
          {first && second && (
            <div className="jak-duel">
              <div className="jak-side jrv jd1">
                <span className="y">{first.label}</span>
                <span className="bar"><i style={{ "--w": `${compWidth(first.value, second.value)}%` } as React.CSSProperties} /></span>
                <span className="n" dir="ltr">{first.value}</span>
              </div>
              <div className="jak-side now jrv jd2">
                <span className="y">{second.label}</span>
                <span className="bar"><i style={{ "--w": `${compWidth(second.value, first.value)}%` } as React.CSSProperties} /></span>
                <span className="n" dir="ltr">{second.value}</span>
              </div>
            </div>
          )}
          {slide.body && <p className="jak-gain jrv jd3">{slide.body}</p>}
        </div>
      );
    }

    case "timeline":
      return (
        <div className="jak-center">
          {slide.title && <h2 className="jrv">{slide.title}</h2>}
          <div className="jak-tl">
            {(slide.data?.points ?? []).map((point, index) => (
              <div className={`pt jrv jd${Math.min(index + 1, 3)}`} key={index}>
                <span className="yr" dir="ltr">{point.year}</span>
                <b>{point.title}</b>
                {point.detail && <span className="dt">{point.detail}</span>}
              </div>
            ))}
          </div>
        </div>
      );

    case "quote":
      return (
        <div className="jak-center">
          <div className="jak-qm jrv" aria-hidden="true">”</div>
          <blockquote className="jrv jd1">{slide.body || slide.title}</blockquote>
          {slide.data?.quoteBy && <cite className="jrv jd2">— {slide.data.quoteBy}</cite>}
        </div>
      );

    case "list":
    case "summary":
      return (
        <div className="jak-center">
          {slide.title && <h2 className="jrv">{slide.title}</h2>}
          <ul className={slide.type === "summary" ? "jak-sum" : "jak-items"}>
            {(slide.data?.items ?? []).map((item, index) => (
              <li className={`jrv jd${Math.min(index + 1, 3)}`} key={index}>
                {slide.type === "list" && <b className="n" dir="ltr">{index + 1}</b>}
                {item}
              </li>
            ))}
          </ul>
          {slide.body && <p className="jrv jd3">{slide.body}</p>}
        </div>
      );

    case "fact":
      return (
        <div className="jak-center">
          <span className="jak-fk jrv">حقيقة سريعة</span>
          <h2 className="jrv jd1">{slide.title || slide.body}</h2>
          {slide.title && slide.body && <p className="jrv jd2">{slide.body}</p>}
        </div>
      );

    default:
      return (
        <div className="jak-bottom">
          <h2 className="jrv">{slide.title}</h2>
          {slide.body && <p className="jrv jd1">{slide.body}</p>}
        </div>
      );
  }
}

export function JakStory({ meta, slides }: { meta: JakStoryMeta; slides: JakSlide[] }) {
  const visible = slides.filter((slide) => !slide.hidden);
  const total = visible.length + 2;

  return (
    <div className="jak-stage" data-jak-root>
      <div className="jak-col">
        {/* الافتتاحية: هوية العلم + عنوان المادة */}
        <section className="jak-slide jak-hero" data-jak-slide>
          <Art
            slide={visible[0]?.type === "hero" ? visible[0] : ({ image: null } as JakSlide)}
            index={0}
            priority
          />
          <span className="jak-brand">الع<i>ل</i>م</span>
          <div className="jak-bottom">
            <span className="jak-kick jrv">جاك العلم · {meta.sectionName} · {meta.readingMinutes} دقائق</span>
            <h1 className="jrv jd1">{visible[0]?.type === "hero" && visible[0].title ? visible[0].title : meta.title}</h1>
            {visible[0]?.type === "hero" && visible[0].body && <p className="jrv jd2">{visible[0].body}</p>}
          </div>
          <span className="jak-cue" aria-hidden="true">مرر للأسفل ↓</span>
        </section>

        {visible
          .filter((slide, index) => !(index === 0 && slide.type === "hero"))
          .filter((slide) => slide.type !== "end")
          .map((slide, index) => (
            <section className={`jak-slide jak-${slide.type}`} data-jak-slide key={slide.id}>
              <Art slide={slide} index={index + 1} priority={false} />
              {slide.type === "text" && (
                <span className="jak-num" dir="ltr" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
              )}
              <SlideBody slide={slide} />
              <span className="jak-idx" dir="ltr" aria-hidden="true">{index + 2} / {total}</span>
            </section>
          ))}

        {/* الختامية: مشاركة + التالي */}
        <section className="jak-slide jak-endcap" data-jak-slide>
          <div className={`jak-art ${ART_FALLBACKS[1]}`} />
          <div className="jak-center">
            <div className="jak-endlogo jrv">الع<i>ل</i>م</div>
            <p className="jrv jd1">وصلت لنهاية القصة — المعرفة بسلاسة</p>
            <div className="jak-share jrv jd2">
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(meta.title)}&url=${encodeURIComponent(meta.shareUrl)}`} target="_blank" rel="noopener noreferrer">مشاركة ↗</a>
              <span data-jak-copy={meta.shareUrl} role="button" tabIndex={0}>نسخ الرابط</span>
            </div>
            {meta.next && (
              <a className="jak-next jrv jd3" href={meta.next.href}>
                <span>اقرأ بعدها</span>
                <b>{meta.next.title}</b>
              </a>
            )}
          </div>
        </section>
      </div>

      <JakMotion />
    </div>
  );
}
