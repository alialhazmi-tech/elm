import type { Metadata } from "next";
import { getHomeBundle } from "@/lib/content/home";
import { mockContentProvider } from "@/lib/content/mock-provider";
import type { Story } from "@/lib/content/types";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "العلم | المعرفة وراء الخبر",
  description:
    "منصة إعلام ومعرفة سعودية تشرح ما وراء الخبر عبر السلاسل والبيانات والفيديو والبودكاست.",
  alternates: { canonical: "/" },
};

const navItems = ["السلاسل", "وراء الخبر", "مرئي", "صوتي"];

function StoryCard({ story, index }: { story: Story; index: number }) {
  return (
    <article className="story-card" data-story-id={story.id}>
      <div className={`story-art story-art-${(index % 4) + 1}`} aria-hidden="true">
        <span>{String(index + 1).padStart(2, "0")}</span>
      </div>
      <div className="story-copy">
        <div className="story-meta">
          <span>{story.eyebrow}</span>
          <span>{story.readingMinutes} دقائق</span>
        </div>
        <h3>{story.title}</h3>
        <p>{story.excerpt}</p>
      </div>
    </article>
  );
}

export default async function Home() {
  const bundle = await getHomeBundle(mockContentProvider);
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "العلم",
    url: "https://alelm.net",
    description: "منصة إعلام ومعرفة سعودية",
  };

  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#top" aria-label="العلم - الصفحة الرئيسية">
            <span className="brand-mark" aria-hidden="true">ع</span>
            <span className="brand-word">العلم</span>
          </a>
          <nav aria-label="التنقل الرئيسي">
            {navItems.map((item) => (
              <a key={item} href={`#${item === "السلاسل" ? "series" : "content"}`}>
                {item}
              </a>
            ))}
          </nav>
          <span className="edition">منصة معرفة عربية</span>
        </div>
      </header>

      <main id="main-content">
        <section className="hero" id="top" aria-labelledby="hero-title" data-story-id={bundle.hero.id}>
          <div className="hero-copy">
            <p className="eyebrow"><span />{bundle.hero.eyebrow}</p>
            <h1 id="hero-title">{bundle.hero.title}</h1>
            <p className="hero-deck">{bundle.hero.excerpt}</p>
            <div className="hero-meta">
              <span>{bundle.hero.readingMinutes} دقائق قراءة</span>
              <span>سلسلة لماذا</span>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="orbit orbit-a" />
            <div className="orbit orbit-b" />
            <div className="visual-grid" />
            <div className="visual-card visual-card-one"><b>المكان</b><span>ذاكرة</span></div>
            <div className="visual-card visual-card-two"><b>الزمن</b><span>سياق</span></div>
            <div className="visual-number">24</div>
          </div>
        </section>

        <section className="series-rail" id="series" aria-labelledby="series-title">
          <div className="section-heading compact">
            <div>
              <p>منتجات العلم</p>
              <h2 id="series-title">تسع سلاسل، تسع طرق للفهم</h2>
            </div>
            <span>اسحب لاكتشاف المزيد</span>
          </div>
          <div className="series-list" role="list">
            {bundle.series.map((item, index) => (
              <article
                className="series-chip"
                key={item.slug}
                role="listitem"
                style={{ "--series-color": item.color } as React.CSSProperties}
              >
                <span className="series-index">{String(index + 1).padStart(2, "0")}</span>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="content-shell" id="content">
          {bundle.sections.map((section, sectionIndex) => (
            <section className="content-section" key={section.key} aria-labelledby={`${section.key}-title`}>
              <div className="section-heading">
                <div>
                  <p>{section.kicker}</p>
                  <h2 id={`${section.key}-title`}>{section.title}</h2>
                </div>
                <span className="section-number">0{sectionIndex + 1}</span>
              </div>
              <div className="story-grid">
                {section.stories.map((story, index) => (
                  <StoryCard key={story.id} story={story} index={index + sectionIndex} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="newsletter" aria-labelledby="newsletter-title">
          <div>
            <p>رسالة واحدة، معنى أوضح</p>
            <h2 id="newsletter-title">المعرفة التي تستحق وقتك</h2>
          </div>
          <p>ملخص أسبوعي للسلاسل وما وراء الخبر. لا ضوضاء، ولا سباق تنبيهات.</p>
          <span className="newsletter-status">صفحة الاشتراك ضمن M3</span>
        </section>
      </main>

      <footer>
        <div className="footer-brand">العلم</div>
        <p>منصة إعلام ومعرفة سعودية تضع السياق قبل السرعة.</p>
        <p className="footer-note">نسخة تأسيسية - المحتوى المعروض بيانات تطوير غير منشورة.</p>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
