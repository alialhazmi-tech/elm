import Image from "next/image";
import Link from "next/link";

import { sectionName, seriesOf } from "@/lib/content/provider";
import { formatReadingMinutes, relativeTimeAr, toLatinDigits } from "@/lib/format";
import { storyHref, type Story } from "@/lib/content/types";

/**
 * صور البطاقات width/height بلا sizes عمدًا: مرشّحا 1x/2x فقط —
 * روابط ووردبريس العربية تُرمَّز إلى ~250 حرفًا فكل مرشح إضافي يضخّم HTML.
 */

/** صف أفقي — قائمة «وراء الخبر» في الرئيسية: نص يمينًا وصورة مصغرة يسارًا. */
export function ContextRowCard({ story }: { story: Story }) {
  const series = seriesOf(story);
  const when = relativeTimeAr(story.publishedAt);

  return (
    <article
      className="ctx-row"
      style={{ "--kc": series?.color } as React.CSSProperties}
      data-story-id={story.id}
    >
      <div className="ctx-row-body">
        <span className="kicker">{series?.name ?? sectionName(story.section)}</span>
        <h3>
          <Link className="story-link" href={storyHref(story)}>{story.title}</Link>
        </h3>
        <div className="ctx-row-meta">
          <span>قراءة {toLatinDigits(story.readingMinutes)} د</span>
          {when ? <span>· {when}</span> : null}
        </div>
      </div>
      {story.image ? (
        <Link className="ctx-thumb" href={storyHref(story)} tabIndex={-1} aria-hidden="true">
          <Image src={story.image} alt="" fill sizes="112px" />
        </Link>
      ) : null}
    </article>
  );
}

/** بطاقة الفسيفساء — قصص «وراء الخبر» والسلاسل والأقسام. */
export function MosaicCard({
  story,
  tall = false,
  className,
  stat,
}: {
  story: Story;
  tall?: boolean;
  className?: string;
  /** الرقم المفتاحي تحت العنوان — بطاقات صفحة السلسلة تُبرزه حين يحمله العنوان. */
  stat?: string | null;
}) {
  const series = seriesOf(story);
  const when = relativeTimeAr(story.publishedAt);

  return (
    <article
      className={["m-card", tall ? "m-tall" : "", className ?? ""].join(" ").trim()}
      style={{ "--kc": series?.color } as React.CSSProperties}
      data-story-id={story.id}
    >
      {story.image ? (
        <Link className="m-media" href={storyHref(story)} tabIndex={-1} aria-hidden="true">
          <Image className="c-img" src={story.image} alt="" width={640} height={tall ? 590 : 400} />
        </Link>
      ) : null}
      <div className="m-body">
        <div className="m-kick">
          <span>
            {series ? `${series.name} · ` : ""}
            {sectionName(story.section)}
          </span>
          {when ? <time>{when}</time> : null}
        </div>
        <h3>
          <Link href={storyHref(story)}>{story.title}</Link>
        </h3>
        {stat ? <span className="m-stat latin-number" dir="ltr" lang="en">{stat}</span> : null}
        {tall ? <p>{story.excerpt.slice(0, 180)}{story.excerpt.length > 180 ? "…" : ""}</p> : null}
        <div className="m-meta">
          <span>{formatReadingMinutes(story.readingMinutes)}</span>
          {when ? <time>{when}</time> : null}
        </div>
        {story.factCheck ? (
          <span className="verdict">✓ دقّقها العلم: شائعة متداولة — الحقيقة داخل المادة</span>
        ) : null}
      </div>
    </article>
  );
}

/** بطاقة وسائط — قسم مرئي وصوتي: صورة 16:9 وشارة مدة، والعنوان تحتها. */
export function VideoCard({ story }: { story: Story }) {
  return (
    <article className="media-card" data-story-id={story.id}>
      <div className="media-thumb">
        {story.image ? (
          <Image src={story.image} alt="" fill sizes="(max-width: 940px) 100vw, 380px" />
        ) : null}
        <span className="dur">{formatReadingMinutes(story.readingMinutes)}</span>
      </div>
      <span className="kicker">مرئي · فيديوجرافيك</span>
      <h3>
        <Link className="story-link" href={storyHref(story)}>{story.title}</Link>
      </h3>
    </article>
  );
}
