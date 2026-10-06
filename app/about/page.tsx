import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { InfoIcon, InfoNav, SparkMark, type InfoIconName } from "@/app/_components/info-pages";
import { PublicEmailLink } from "@/app/_components/public-email-link";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { SERIES } from "@/lib/content/series";

export const metadata: Metadata = {
  title: "من نحن",
  description: "العلم منصة إعلامية معرفية سعودية تقدّم المعرفة وراء الخبر: تضع الأحداث في سياقها وتشرح أسبابها وتداعياتها بلغة عربية واضحة.",
  alternates: { canonical: "/about" },
};

/** وصف كل سلسلة في صفحة التعريف، أطول من وصف المسطرة القصير. */
const SERIES_ABOUT: Record<string, { text: string; note?: string }> = {
  absat: { text: "تشرح المفاهيم والملفات المركبة خطوة بخطوة." },
  "bel-arqam": { text: "تقرأ الظواهر من خلال البيانات، مع توضيح مصادرها وسياقها." },
  limatha: { text: "تبحث في الأسباب التي تقف خلف الظواهر والأحداث." },
  "matha-baad": { text: "تقرأ التداعيات وما يمكن أن يترتب على الحدث." },
  "matha-law": { text: "تختبر سيناريوهات افتراضية.", note: "تُعرض بوصفها احتمالات، لا وقائع ولا تنبؤات مؤكدة." },
  "efhamha-sah": { text: "تفحص الادعاءات المتداولة وتشرح مواضع الالتباس." },
  "bel-tarikh": { text: "تعيد الأحداث إلى جذورها." },
  shakhsiat: { text: "تتناول سيرًا وتجارب ذات أثر." },
  aghrab: { text: "تستكشف موضوعات غير مألوفة." },
};
const SERIES_ORDER = ["absat", "bel-arqam", "limatha", "matha-baad", "matha-law", "efhamha-sah", "bel-tarikh", "shakhsiat", "aghrab"];
const ABOUT_SERIES = SERIES_ORDER.flatMap((slug) => SERIES.filter((series) => series.slug === slug));
const seriesColor = (slug: string) => SERIES.find((series) => series.slug === slug)?.color;

/** طبقات المعرفة تحت الخبر، كل طبقة بلون سلسلتها. */
const LAYERS = [
  { slug: "limatha", name: "لماذا", text: "الأسباب خلف الحدث" },
  { slug: "bel-arqam", name: "بالأرقام", text: "البيانات في سياقها" },
  { slug: "bel-tarikh", name: "بالتاريخ", text: "الجذور التي سبقته" },
  { slug: "matha-baad", name: "ماذا بعد", text: "ما يترتب عليه" },
];

const FORMATS: { icon: InfoIconName; name: string; text: string }[] = [
  { icon: "text", name: "مادة مكتوبة", text: "شرح متصل يربط الخبر بخلفيته ومصادره." },
  { icon: "slides", name: "قصة بصرية", text: "شرائح مترابطة في «جاك العلم»." },
  { icon: "chart", name: "إنفوجرافيك", text: "الأرقام مرسومة بمقياسها وسياقها." },
  { icon: "audio", name: "موجز مسموع", text: "خلاصة تُسمع في دقائق." },
];

const TOPICS = ["السياسة", "الاقتصاد", "التقنية", "الصحة", "المجتمع", "الثقافة"];

const AI_TOOLS = [
  { name: "لخّص لي", note: "ثلاث نقاط من المادة" },
  { name: "اسأل عن هذه المادة", note: "إجابة من نص المادة" },
  { name: "الاستماع إلى الموجز", note: "صوت اصطناعي" },
  { name: "في غرفة الأخبار", note: "اقتراحات يراجعها المحرر" },
];

const sc = (color?: string) => ({ "--sc": color }) as CSSProperties;

export default function AboutPage() {
  return (
    <>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <SiteHeader />
      <InfoNav current="/about" />
      <main id="main-content" className="ip-page">
        <section className="ip-wrap ip-about-hero">
          <div>
            <p className="ip-eyebrow">من نحن</p>
            <h1 className="ip-kufi">المعرفة وراء الخبر</h1>
            <p className="ip-lead">
              العلم منصة إعلامية معرفية سعودية. نضع الأحداث في سياقها، ونشرح أسبابها وتداعياتها بلغة
              عربية واضحة، مستفيدين من الصحافة التفسيرية والبيانات والسرد البصري والتقنيات الذكية، ليجد
              القارئ ما يساعده على الفهم وتكوين رأيه.
            </p>
          </div>
          <figure className="ip-layers">
            <div className="ip-layer-news">
              <small>الخبر</small>
              <p>ما الذي حدث اليوم؟</p>
            </div>
            <ul className="ip-layer-stack">
              {LAYERS.map((layer) => (
                <li key={layer.slug} className="ip-layer" style={sc(seriesColor(layer.slug))}>
                  <span><b>{layer.name}</b>{layer.text}</span>
                </li>
              ))}
            </ul>
            <figcaption>تحت كل خبر طبقات من المعرفة، ولكل طبقة سلسلة ولون.</figcaption>
          </figure>
        </section>

        <div className="ip-wrap">
          <div className="ip-spectrum" aria-hidden="true">
            {ABOUT_SERIES.map((series) => <i key={series.slug} style={sc(series.color)} />)}
          </div>
        </div>

        <section className="ip-wrap ip-section" style={{ borderTop: 0 }}>
          <div className="ip-section-head">
            <h2 className="ip-h2">لكل موضوع الشكل الذي يشرحه</h2>
            <p className="ip-body">نتناول القضايا التي تمس حياة الناس في السعودية والعالم، ونختار لكل موضوع الشكل الأنسب لشرحه.</p>
          </div>
          <ul className="ip-formats">
            {FORMATS.map((format) => (
              <li key={format.name} className="ip-format">
                <InfoIcon name={format.icon} />
                <b>{format.name}</b>
                <span>{format.text}</span>
              </li>
            ))}
          </ul>
          <ul className="ip-chips ip-topics" aria-label="الموضوعات">
            {TOPICS.map((topic) => <li key={topic}>{topic}</li>)}
          </ul>
        </section>

        <section className="ip-wrap ip-section">
          <div className="ip-vm">
            <div>
              <h2>رؤيتنا</h2>
              <p>أن تكون العلم وجهة يومية موثوقة للمعرفة، تقرّب القضايا المعقدة من القارئ العربي وتساعده على فهم عالم سريع التغيّر.</p>
            </div>
            <div>
              <h2>رسالتنا</h2>
              <p>تقديم محتوى عربي دقيق وواضح يربط الخبر بخلفيته، ويشرح الأرقام في سياقها، ويميّز بين الحقيقة والتفسير والاحتمال، مع تطوير أدوات تسهّل الوصول إلى المعرفة والتفاعل معها.</p>
            </div>
          </div>
        </section>

        <section className="ip-wrap ip-section">
          <div className="ip-section-head">
            <h2 className="ip-h2">سلاسلنا التحريرية</h2>
            <p className="ip-body">لكل سؤال يطرحه القارئ سلسلة تجيب عنه، ولكل سلسلة لونها الذي تعرفها به في المنصة.</p>
          </div>
          <ul className="ip-series-grid">
            {ABOUT_SERIES.map((series) => (
              <li key={series.slug} className="ip-series" style={sc(series.color)}>
                <Link href={`/series/${series.slug}`}>{series.name}</Link>
                <p>{SERIES_ABOUT[series.slug].text}</p>
                {SERIES_ABOUT[series.slug].note ? <small>{SERIES_ABOUT[series.slug].note}</small> : null}
              </li>
            ))}
            <li className="ip-series ip-jak" style={sc("var(--navy)")}>
              <div>
                <Link href="/jak">جاك العلم</Link>
                <p>القصص في شرائح بصرية مترابطة، مدخل آخر إلى الموضوع يحافظ على سياقه ومعناه.</p>
              </div>
              <div className="ip-jak-slides" aria-hidden="true"><i /><i /><i /><i /></div>
            </li>
          </ul>
        </section>

        <section className="ip-wrap">
          <div className="ip-ai-band">
            <div>
              <p className="ip-eyebrow"><SparkMark />الذكاء الاصطناعي في العلم</p>
              <h2>أدوات ذكية تساعد على الفهم، والمسؤولية تبقى تحريرية</h2>
              <p>نستخدم الذكاء الاصطناعي لتسهيل فهم المحتوى وتطوير إنتاجه، ونفصح عن موضعه في كل خطوة.</p>
              <Link className="ip-ai-band-cta" href="/ai">كيف نستخدمه</Link>
            </div>
            <ul>
              {AI_TOOLS.map((tool) => <li key={tool.name}>{tool.name}<span>{tool.note}</span></li>)}
            </ul>
          </div>
        </section>

        <section className="ip-wrap ip-contact">
          <p>للتواصل مع العلم، وللملاحظات والتصحيحات</p>
          <span className="ip-email"><PublicEmailLink email="info@alelm.net" /></span>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
