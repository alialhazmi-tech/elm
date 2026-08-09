import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { StoryCard } from "@/app/_components/story-card";
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
  const [lead, ...rest] = stories;

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader />

      <main id="main-content">
        <section className="section-hero">
          <p className="eyebrow"><span />قسم</p>
          <h1>{sectionName(section)}</h1>
          <p className="section-hero-count">{stories.length} مادة</p>
        </section>

        <div className="content-shell">
          <section className="content-section">
            <div className="story-grid">
              {lead ? <StoryCard story={lead} index={0} priority /> : null}
              {rest.map((story, index) => (
                <StoryCard key={story.id} story={story} index={index + 1} />
              ))}
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
