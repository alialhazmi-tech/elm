import Image from "next/image";
import Link from "next/link";

import { sectionName, seriesOf } from "@/lib/content/provider";
import { toLatinDigits } from "@/lib/format";
import { storyHref, type Story } from "@/lib/content/types";

/**
 * صور البطاقات width/height بلا sizes عمدًا: مرشّحا 1x/2x فقط —
 * روابط ووردبريس العربية تُرمَّز إلى ~250 حرفًا فكل مرشح إضافي يضخّم HTML.
 */

const relativeTime = (iso?: string): string | null => {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 1) return "قبل قليل";
  if (hours < 24) return `منذ ${toLatinDigits(hours)} ساعات`;
  const days = Math.round(hours / 24);
  return `منذ ${toLatinDigits(days)} أيام`;
};

/** صف أفقي — قائمة «وراء الخبر» في الرئيسية: نص يمينًا وصورة مصغرة يسارًا. */
export function ContextRowCard({ story }: { story: Story }) {
  const series = seriesOf(story);

  return (
    <article
      className="ctx-row"
      style={{ "--kc": series?.color } as React.CSSProperties}
      data-story-id={story.id}
    >
      <div>
        <span className="kicker">{series?.name ?? sectionName(story.section)}</span>
        <h3>
          <Link className="story-link" href={storyHref(story)}>{story.title}</Link>
        </h3>
      </div>
      {story.image ? (
        <div className="ctx-thumb">
          <Image src={story.image} alt="" fill sizes="112px" />
        </div>
      ) : null}
    </article>
  );
}

/** بطاقة الفسيفساء — قصص «وراء الخبر» والسلاسل والأقسام. */
export function MosaicCard({
  story,
  tall = false,
  className,
}: {
  story: Story;
  tall?: boolean;
  className?: string;
}) {
  const series = seriesOf(story);
  const when = relativeTime(story.publishedAt);

  return (
    <article
      className={["m-card", tall ? "m-tall" : "", className ?? ""].join(" ").trim()}
      style={{ "--kc": series?.color } as React.CSSProperties}
      data-story-id={story.id}
    >
      {story.image ? (
        <Image className="c-img" src={story.image} alt="" width={640} height={tall ? 590 : 400} />
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
        {tall ? <p>{story.excerpt.slice(0, 140)}{story.excerpt.length > 140 ? "…" : ""}</p> : null}
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
        <span className="dur">{toLatinDigits(story.readingMinutes)} دقائق</span>
      </div>
      <span className="kicker">مرئي · فيديوجرافيك</span>
      <h3>
        <Link className="story-link" href={storyHref(story)}>{story.title}</Link>
      </h3>
    </article>
  );
}
