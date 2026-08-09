import Image from "next/image";
import Link from "next/link";

import { sectionName, seriesOf } from "@/lib/content/provider";
import { toEasternDigits } from "@/lib/format";
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
  if (hours < 24) return `منذ ${toEasternDigits(hours)} ساعات`;
  const days = Math.round(hours / 24);
  return `منذ ${toEasternDigits(days)} أيام`;
};

/** بطاقة مصغرة — عمود البنتو الجانبي. */
export function MiniCard({ story }: { story: Story }) {
  const series = seriesOf(story);
  const when = relativeTime(story.publishedAt);

  return (
    <article className="mini" style={{ "--kc": series?.color } as React.CSSProperties} data-story-id={story.id}>
      <div>
        <span className="kick">{series?.name ?? story.eyebrow}</span>
        <h3>
          <Link className="stretched" href={storyHref(story)}>{story.title}</Link>
        </h3>
        <time>
          {when ? `${when} · ` : ""}
          {toEasternDigits(story.readingMinutes)} دقائق
        </time>
      </div>
      {story.image ? (
        <Image className="m-img" src={story.image} alt="" width={236} height={172} />
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

/** بطاقة فيديو — قسم مرئي وصوتي. */
export function VideoCard({ story }: { story: Story }) {
  return (
    <article className="video-card" data-story-id={story.id}>
      <span className="play" aria-hidden="true">▶</span>
      {story.image ? (
        <Image className="v-img" src={story.image} alt="" width={640} height={400} />
      ) : null}
      <Link className="video-copy" href={storyHref(story)}>
        <span className="kick">مرئي · فيديوجرافيك</span>
        <h3>{story.title}</h3>
        <time>{toEasternDigits(story.readingMinutes)} دقائق مشاهدة</time>
      </Link>
    </article>
  );
}
