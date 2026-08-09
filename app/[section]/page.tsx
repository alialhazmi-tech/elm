import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { toEasternDigits } from "@/lib/format";
import { MosaicCard } from "@/app/_components/story-card";
import { KNOWN_SECTIONS, sectionName, seedContentProvider } from "@/lib/content/provider";

export const revalidate = 180;

type Params = { params: Promise<{ section: string }> };

export async function generateStaticParams() {
  return KNOWN_SECTIONS.map((section) => ({ section }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { section } = await params;
  if (!KNOWN_SECTIONS.includes(section)) return { title: "القسم غير موجود" };

  return {
    title: sectionName(section),
    description: `أحدث مواد قسم ${sectionName(section)} في العلم.`,
    alternates: { canonical: `/${section}` },
  };
}

export default async function SectionPage({ params }: Params) {
  const { section } = await params;
  if (!KNOWN_SECTIONS.includes(section)) notFound();

  const stories = await seedContentProvider.listBySection(section);

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader active={`/${section}`} />

      <main id="main-content">
        <section className="hub-hero">
          <p className="eyebrow">قسم</p>
          <h1>{sectionName(section)}</h1>
          <p className="hub-count">{toEasternDigits(stories.length)} مادة</p>
        </section>

        <div className="wrap">
          <div className="grid-3">
            {stories.map((story, index) => (
              <MosaicCard key={story.id} story={story} tall={index === 0} />
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
