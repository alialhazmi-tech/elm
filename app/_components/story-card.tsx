import Image from "next/image";
import Link from "next/link";

import { seriesOf } from "@/lib/content/provider";
import { storyHref, type Story } from "@/lib/content/types";

type Props = {
  story: Story;
  index?: number;
  priority?: boolean;
  compact?: boolean;
};

export function StoryCard({ story, index = 0, priority = false, compact = false }: Props) {
  const series = seriesOf(story);

  return (
    <article className={compact ? "story-card story-card-compact" : "story-card"} data-story-id={story.id}>
      <Link className="story-link" href={storyHref(story)}>
        <div className={`story-art story-art-${(index % 4) + 1}`}>
          {story.image ? (
            /* width/height بلا sizes: يولّد Next مرشّحَي 1x و2x فقط بدل سلم المقاسات كاملًا.
               روابط ووردبريس العربية تُرمَّز إلى ~250 حرفًا، فكل مرشّح إضافي يضخّم HTML. */
            <Image
              className="story-image"
              src={story.image}
              alt=""
              width={640}
              height={360}
              priority={priority}
            />
          ) : (
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          )}
          {series ? (
            <span
              className="story-series"
              style={{ "--series-color": series.color } as React.CSSProperties}
            >
              {series.name}
            </span>
          ) : null}
        </div>
        <div className="story-copy">
          <div className="story-meta">
            <span>{story.eyebrow}</span>
            <span>{story.readingMinutes} دقائق</span>
          </div>
          <h3>{story.title}</h3>
          {compact ? null : <p>{story.excerpt}</p>}
        </div>
      </Link>
    </article>
  );
}
