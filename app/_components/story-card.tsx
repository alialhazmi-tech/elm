import Image from "next/image";
import Link from "next/link";

import { toEasternDigits } from "@/lib/format";
import { sectionName, seriesOf } from "@/lib/content/provider";
import { storyHref, type Story } from "@/lib/content/types";

/**
 * بطاقة الخبر وفق دليل الهوية: حد علوي كحلي، «عين» حمراء صغيرة للقسم/السلسلة
 * (الأحمر شارة فقط)، زوايا قائمة، والأرقام عربية شرقية.
 * صور البطاقات width/height بلا sizes عمدًا: مرشّحا 1x/2x فقط —
 * روابط ووردبريس العربية تُرمَّز إلى ~250 حرفًا فكل مرشح إضافي يضخّم HTML.
 */

const relativeTime = (iso?: string): string | null => {
  if (!iso) return null;
  const hours = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return "قبل قليل";
  if (hours < 24) return `منذ ${toEasternDigits(hours)} ساعات`;
  return `منذ ${toEasternDigits(Math.round(hours / 24))} أيام`;
};

type Props = {
  story: Story;
  withImage?: boolean;
  showExcerpt?: boolean;
};

export function NewsCard({ story, withImage = false, showExcerpt = false }: Props) {
  const series = seriesOf(story);
  const when = relativeTime(story.publishedAt);
  const hasImage = withImage && story.image;

  return (
    <article className={hasImage ? "n-card with-image" : "n-card"} data-story-id={story.id}>
      {hasImage ? (
        <Image className="c-img" src={story.image as string} alt="" width={640} height={380} />
      ) : null}
      <div className="n-body">
        <div className="kicker">
          <span>
            {series ? `${series.name} · ` : ""}
            {sectionName(story.section)}
          </span>
          {when ? <time>{when}</time> : null}
        </div>
        <h3>
          <Link href={storyHref(story)}>{story.title}</Link>
        </h3>
        {showExcerpt ? (
          <p>{story.excerpt.slice(0, 130)}{story.excerpt.length > 130 ? "…" : ""}</p>
        ) : null}
      </div>
    </article>
  );
}

/** بطاقة فيديو — العنوان على تدرّج كحلي أسفل الصورة وفق معالجة الصور. */
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
