import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { listByFormat } from "@/lib/content/provider";
import { storyHref } from "@/lib/content/types";
import { toLatinDigits } from "@/lib/format";
import { podcastShowFor } from "@/lib/podcasts";

/**
 * أرشيف برامج البودكاست — رابط إرثي حي من الموقع القديم (شرط M-2).
 * البرامج مواد بشكل podcasts هاجرت بأغلفتها؛ الحلقات نفسها تُبث على قناة
 * يوتيوب العلم (بنية المصدر الأصلية) — وربط قوائم تشغيل لكل برنامج قرار
 * تحريري لاحق يضيفه المالك متى شاء.
 */

export const revalidate = 300;

const YOUTUBE_CHANNEL = "https://www.youtube.com/c/alelmmedia";

export const metadata: Metadata = {
  title: "بودكاست العلم",
  description: "برامج العلم الصوتية والمرئية: الغبوق، ملامح، عتمة، وتقرير — حلقاتها عبر قناة العلم.",
  alternates: { canonical: "/podcasts" },
};

export default async function PodcastsPage() {
  const shows = await listByFormat("podcasts", 24);

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader />

      <main id="main-content">
        <section className="hub-hero podcast-hero">
          <div className="hub-hero-copy">
            <p className="eyebrow">بودكاست</p>
            <h1>برامج العلم الصوتية</h1>
            <p className="hub-tagline">حوارات وقصص تُسمع بهدوء، بعيدًا عن ضجيج الخبر العابر.</p>
          </div>
          <p className="hub-count">
            {shows.length > 0
              ? `${toLatinDigits(shows.length)} برامج · الحلقات تُبث عبر قناة العلم`
              : "الحلقات تُبث عبر قناة العلم"}
          </p>
        </section>

        <div className="wrap">
          {shows.length > 0 ? (
            <div className="podcast-directory">
              {shows.map((story, index) => {
                const show = podcastShowFor(story.id);
                const href = storyHref(story);
                return (
                  <article
                    key={story.id}
                    className="podcast-tile"
                    style={{ "--pc": show?.accent ?? "var(--navy)" } as React.CSSProperties}
                  >
                    {story.image ? (
                      <Link className="podcast-tile-cover" href={href} tabIndex={-1} aria-hidden="true">
                        <Image src={story.image} alt="" fill sizes="(max-width: 640px) 120px, 240px" />
                      </Link>
                    ) : null}
                    <div className="podcast-tile-copy">
                      <span className="podcast-tile-index">
                        برنامج {toLatinDigits(String(index + 1).padStart(2, "0"))}
                      </span>
                      <h2><Link href={href}>{show?.name ?? story.title}</Link></h2>
                      <p>{story.excerpt}</p>
                      <Link className="podcast-tile-action" href={href}>
                        الحلقات والتفاصيل <span aria-hidden="true">←</span>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <section className="podcast-empty">
              <span>استمع الآن</span>
              <h2>الحلقات موجودة، وتجربة البرامج الجديدة في الطريق.</h2>
              <p>تجد أرشيف الغبوق وملامح وعتمة وتقرير كاملًا عبر قناة العلم.</p>
              <a href={YOUTUBE_CHANNEL} rel="noopener noreferrer" target="_blank">
                افتح قناة العلم في يوتيوب <span aria-hidden="true">←</span>
              </a>
            </section>
          )}

          {shows.length > 0 ? (
            <section className="ai-surface ask-block" style={{ marginTop: 28 }}>
              <p style={{ margin: 0, lineHeight: 1.9 }}>
                حلقات البرامج كاملة — الغبوق، ملامح، عتمة، وتقرير — على{" "}
                <a href={YOUTUBE_CHANNEL} rel="noopener noreferrer" target="_blank">
                  قناة العلم في يوتيوب ←
                </a>
              </p>
            </section>
          ) : null}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
