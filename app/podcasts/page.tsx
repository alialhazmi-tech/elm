import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { MosaicCard } from "@/app/_components/story-card";
import { listByFormat } from "@/lib/content/provider";
import { toLatinDigits } from "@/lib/format";

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
        <section className="hub-hero">
          <p className="eyebrow">بودكاست</p>
          <h1>برامج العلم الصوتية</h1>
          <p className="hub-count">
            {shows.length > 0
              ? `${toLatinDigits(shows.length)} برامج · الحلقات تُبث عبر قناة العلم`
              : "الحلقات تُبث عبر قناة العلم"}
          </p>
        </section>

        <div className="wrap">
          {shows.length > 0 ? (
            <div className="section-feed">
              {shows.map((story) => (
                <MosaicCard key={story.id} story={story} />
              ))}
            </div>
          ) : (
            <p className="empty-state">برامج البودكاست في الطريق.</p>
          )}

          <section className="ai-surface ask-block" style={{ marginTop: 28 }}>
            <p style={{ margin: 0, lineHeight: 1.9 }}>
              حلقات البرامج كاملة — الغبوق، ملامح، عتمة، وتقرير — على{" "}
              <a href={YOUTUBE_CHANNEL} rel="noopener" target="_blank">
                قناة العلم في يوتيوب ←
              </a>
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
