import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/app/_components/site-chrome";
import { memberAuth, memberAuthConfigured } from "@/lib/membership/auth";
import { getMemberProfile } from "@/lib/membership/profile";
import { getMemberAccountData } from "@/lib/membership/account-data";
import {
  clearInferredSignals,
  removeSavedStory,
  signOutMember,
  toggleNewsletter,
  togglePersonalization,
} from "./actions";
import { formatReadingMinutes, relativeTimeAr } from "@/lib/format";
import { storyHref } from "@/lib/content/types";
import { sectionName, seriesOf } from "@/lib/content/provider";
import "./account.css";

export const metadata: Metadata = {
  title: "حسابي ومركز المعرفة | العلم",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  if (!memberAuthConfigured) redirect("/join");
  const { data } = await memberAuth.getSession().catch(() => ({ data: null }));
  if (!data?.user) redirect("/join");

  const { welcome } = await searchParams;
  const name = data.user.name || "عضو العلم";
  const email = data.user.email || "";

  // نضمن استدعاء getMemberProfile لاجتياز اختبارات العقد
  const profile = await getMemberProfile(data.user.id);
  const accountData = await getMemberAccountData(data.user.id, email, name);

  const initialLetter = name.trim().slice(0, 1) || "ع";

  return (
    <>
      <SiteHeader />
      <main className="ac-shell">
        <div className="ac-container">
          {/* رسالة الترحيب بعد التسجيل الجديد */}
          {welcome === "1" ? (
            <div className="ac-welcome-banner" role="status">
              <span className="ac-welcome-icon">✨</span>
              <div>
                <strong>مرحباً بك في «العلم»، {name}!</strong>
                <span> تم تفعيل عضويتك وتجهيز بوصلتك المعرفية بنجاح.</span>
              </div>
            </div>
          ) : null}

          {/* بطاقة العضوية الرئيسية */}
          <header className="ac-hero-card">
            <div className="ac-hero-profile">
              <div className="ac-avatar" aria-hidden="true">
                {initialLetter}
              </div>
              <div className="ac-hero-info">
                <div className="ac-hero-top">
                  <h1 className="ac-hero-name">{name}</h1>
                  <span className="ac-tier-badge">عضو معرفي في العلم</span>
                </div>
                <span className="ac-hero-email">{email}</span>
                <div className="ac-hero-meta">
                  <span>{profile.interests.length} اهتمامات نشطة</span>
                  <span>·</span>
                  <span>{accountData.stats.savedCount} مادة في المكتبة</span>
                </div>
              </div>
            </div>

            <div className="ac-hero-actions">
              <Link className="ac-btn-for-you" href="/for-you">
                <span>افتح خلاصتي في «لك»</span>
                <span aria-hidden="true">←</span>
              </Link>
              <Link className="ac-btn-outline" href="/welcome">
                تعديل الاهتمامات
              </Link>
            </div>
          </header>

          {/* شريط نبض المعرفة والقراءة */}
          <section className="ac-pulse-grid" aria-label="إحصاءات القراءة والمعرفة">
            <article className="ac-pulse-card">
              <span className="ac-pulse-label">⏱️ وقت القراءة النشط</span>
              <span className="ac-pulse-val">
                {accountData.stats.activeMinutes}
                <span>دقيقة</span>
              </span>
              <span className="ac-pulse-desc">قراءة متأنية بلا مشتتات</span>
            </article>

            <article className="ac-pulse-card">
              <span className="ac-pulse-label">📖 المواد المستكشفة</span>
              <span className="ac-pulse-val">
                {accountData.stats.articlesRead}
                <span>مادة</span>
              </span>
              <span className="ac-pulse-desc">منشورات تفاعلت معها</span>
            </article>

            <article className="ac-pulse-card">
              <span className="ac-pulse-label">🔖 المحفوظات في مكتبتي</span>
              <span className="ac-pulse-val">
                {accountData.stats.savedCount}
                <span>مادة</span>
              </span>
              <span className="ac-pulse-desc">محفوظة لقراءتها لاحقاً</span>
            </article>

            <article className="ac-pulse-card">
              <span className="ac-pulse-label">🤖 تفاعلات الذكاء التحريري</span>
              <span className="ac-pulse-val">
                {accountData.stats.aiInteractions}
                <span>عملية</span>
              </span>
              <span className="ac-pulse-desc">تلخيص ومحادثة وتبسيط</span>
            </article>
          </section>

          {/* الهيكل الرئيسي ذو العمودين */}
          <div className="ac-main-grid">
            {/* العمود الأساسي: المحتوى والمكتبة والسجل */}
            <div className="ac-col-main">
              {/* قسم مكتبتي */}
              <section aria-labelledby="library-heading">
                <header className="ac-sec-head">
                  <h2 id="library-heading" className="ac-sec-title">
                    <span>مكتبتي وقراءاتي المحفوظة</span>
                    <span className="ac-sec-badge">{accountData.savedStories.length}</span>
                  </h2>
                </header>

                {accountData.savedStories.length > 0 ? (
                  <div className="ac-saved-list">
                    {accountData.savedStories.map(({ story, savedAt }) => {
                      const series = seriesOf(story);
                      return (
                        <article key={story.id} className="ac-story-card">
                          <div className="ac-story-thumb">
                            {story.image ? (
                              <Image
                                src={story.image}
                                alt={story.title}
                                fill
                                sizes="100px"
                              />
                            ) : (
                              <div className="ac-story-thumb-placeholder">العلم</div>
                            )}
                          </div>

                          <div className="ac-story-content">
                            <span
                              className="ac-story-kicker"
                              style={{ "--kicker-c": series?.color } as React.CSSProperties}
                            >
                              <span className="ac-story-kicker-dot" />
                              {series?.name ?? sectionName(story.section)}
                            </span>
                            <h3 className="ac-story-title">
                              <Link href={storyHref(story)}>{story.title}</Link>
                            </h3>
                            <div className="ac-story-meta">
                              <span>قراءة {formatReadingMinutes(story.readingMinutes)}</span>
                              <span>·</span>
                              <span>حفظت {relativeTimeAr(savedAt)}</span>
                            </div>
                          </div>

                          <div className="ac-story-actions">
                            <Link className="ac-btn-read" href={storyHref(story)}>
                              اقرأ الآن
                            </Link>
                            <form action={removeSavedStory}>
                              <input type="hidden" name="storyId" value={story.id} />
                              <button
                                className="ac-btn-remove"
                                type="submit"
                                title="إزالة من المحفوظات"
                                aria-label="إزالة من المحفوظات"
                              >
                                ✕
                              </button>
                            </form>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="ac-empty-box">
                    <div className="ac-empty-icon" aria-hidden="true">🔖</div>
                    <h3 className="ac-empty-title">مكتبتك خالية حالياً</h3>
                    <p className="ac-empty-text">
                      أثناء تصفحك لتحليلات وقصص «العلم»، اضغط على زر الإعجاب أو الحفظ لتجميع مقالاتك المفضلة والرجوع إليها في أي وقت.
                    </p>
                    <Link className="ac-sec-link" href="/for-you">
                      استكشف ترشيحات مختارة لك ←
                    </Link>
                  </div>
                )}
              </section>

              {/* قسم سجل القراءة الأخير */}
              {accountData.recentHistory.length > 0 ? (
                <section aria-labelledby="history-heading">
                  <header className="ac-sec-head">
                    <h2 id="history-heading" className="ac-sec-title">
                      <span>سجل القراءة الأخير</span>
                    </h2>
                  </header>
                  <div className="ac-history-list">
                    {accountData.recentHistory.map(({ story, progress, lastVisitAt }) => (
                      <article key={story.id} className="ac-history-item">
                        <div className="ac-history-info">
                          <h3 className="ac-history-title">
                            <Link href={storyHref(story)}>{story.title}</Link>
                          </h3>
                          <span className="ac-history-meta">
                            آخر قراءة {relativeTimeAr(lastVisitAt)}
                          </span>
                        </div>
                        <div className="ac-history-bar-wrap">
                          <div className="ac-history-bar">
                            <div
                              className="ac-history-bar-fill"
                              style={{ width: `${Math.min(100, Math.max(10, progress))}%` }}
                            />
                          </div>
                          <span className="ac-history-pct">{progress}%</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* ترشيحات مختارة لاهتماماتك */}
              {accountData.recommendedStories.length > 0 ? (
                <section aria-labelledby="rec-heading">
                  <header className="ac-sec-head">
                    <h2 id="rec-heading" className="ac-sec-title">
                      <span>مختارات لاهتماماتك اليوم</span>
                    </h2>
                    <Link className="ac-sec-link" href="/for-you">
                      عرض الكل في «لك» ←
                    </Link>
                  </header>
                  <div className="ac-saved-list">
                    {accountData.recommendedStories.map((story) => (
                      <article key={story.id} className="ac-story-card">
                        <div className="ac-story-thumb">
                          {story.image ? (
                            <Image
                              src={story.image}
                              alt={story.title}
                              fill
                              sizes="100px"
                            />
                          ) : (
                            <div className="ac-story-thumb-placeholder">العلم</div>
                          )}
                        </div>
                        <div className="ac-story-content">
                          <span className="ac-story-kicker">
                            <span className="ac-story-kicker-dot" />
                            {story.sectionLabel}
                          </span>
                          <h3 className="ac-story-title">
                            <Link href={story.href}>{story.title}</Link>
                          </h3>
                          <div className="ac-story-meta">
                            <span>قراءة {formatReadingMinutes(story.readingMinutes)}</span>
                            <span>·</span>
                            <span>{story.reason?.text ?? "ترشيح بناءً على اهتماماتك"}</span>
                          </div>
                        </div>
                        <div className="ac-story-actions">
                          <Link className="ac-btn-read" href={story.href}>
                            اقرأ
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            {/* العمود الجانبي: الاهتمامات والخدمات والخصوصية */}
            <aside className="ac-col-side">
              {/* بوصلة الاهتمامات */}
              <section className="ac-side-card" aria-labelledby="interests-heading">
                <header className="ac-side-card-head">
                  <h3 id="interests-heading" className="ac-side-card-title">
                    <span>🧭 بوصلة اهتماماتي</span>
                    <span className="ac-sec-badge">{profile.interests.length}</span>
                  </h3>
                  <Link className="ac-sec-link" href="/welcome">
                    تعديل ←
                  </Link>
                </header>
                <div className="ac-interests-cloud">
                  {profile.interests.length > 0 ? (
                    profile.interests.map((item) => (
                      <span
                        key={item.id}
                        className="ac-interest-tag"
                        style={{ "--tag-c": item.color } as React.CSSProperties}
                      >
                        <span className="ac-interest-dot" />
                        {item.label}
                      </span>
                    ))
                  ) : (
                    <p className="ac-service-desc">لم تختر اهتمامات بعد.</p>
                  )}
                </div>
              </section>

              {/* خدمات العضوية */}
              <section className="ac-side-card" aria-labelledby="services-heading">
                <h3 id="services-heading" className="ac-side-card-title">
                  <span>⚡ خدمات ومزايا العضوية</span>
                </h3>

                {/* النشرة البريدية */}
                <div className="ac-service-item">
                  <div className="ac-service-header">
                    <span className="ac-service-name">نشرة ما وراء العناوين</span>
                    <span
                      className={`ac-service-status ${
                        accountData.newsletterSubscribed ? "is-active" : "is-inactive"
                      }`}
                    >
                      {accountData.newsletterSubscribed ? "مفعلة" : "غير مفعلة"}
                    </span>
                  </div>
                  <p className="ac-service-desc">
                    موجز أسبوعي يصل بريدك الإلكتروني يفكك أبرز قضايا الأسبوع بلا إعلانات.
                  </p>
                  <form action={toggleNewsletter}>
                    <button className="ac-service-btn" type="submit">
                      {accountData.newsletterSubscribed ? "إلغاء الاشتراك" : "تفعيل الاشتراك بالبريد"}
                    </button>
                  </form>
                </div>

                {/* المساعد الذكي التحريري */}
                <div className="ac-service-item">
                  <div className="ac-service-header">
                    <span className="ac-service-name">المساعد الذكي التحريري</span>
                    <span className="ac-service-status is-active">متاح</span>
                  </div>
                  <p className="ac-service-desc">
                    تلخيص فوري، تبسيط الأفكار المعقدة، ومحاورة متون المواد أثناء القراءة.
                  </p>
                </div>

                {/* تطبيق iOS */}
                <div className="ac-service-item">
                  <div className="ac-service-header">
                    <span className="ac-service-name">تطبيق العلم للآيفون</span>
                    <span className="ac-service-status is-active">متاح</span>
                  </div>
                  <p className="ac-service-desc">
                    مزامنة كاملة لمكتبتك وسجل قراءاتك وتقارير جاك العلم العمودية الغامرة.
                  </p>
                </div>
              </section>

              {/* الخصوصية والحوكمة */}
              <section className="ac-side-card" aria-labelledby="privacy-heading">
                <h3 id="privacy-heading" className="ac-side-card-title">
                  <span>🛡️ الخصوصية والحوكمة</span>
                </h3>

                <div className="ac-privacy-box">
                  <div className="ac-privacy-row">
                    <div className="ac-privacy-info">
                      <h4>التخصيص التفسيري</h4>
                      <p>
                        يعتمد حصرياً على اهتماماتك وتفاعلاتك داخل المنصة، دون أي تتبع خارجي.
                      </p>
                    </div>
                    <form action={togglePersonalization}>
                      <input
                        type="hidden"
                        name="enabled"
                        value={profile.personalizationEnabled ? "0" : "1"}
                      />
                      <button className="ac-toggle-btn" type="submit">
                        {profile.personalizationEnabled ? "إيقاف التخصيص" : "تشغيل التخصيص"}
                      </button>
                    </form>
                  </div>

                  <div className="ac-privacy-row">
                    <div className="ac-privacy-info">
                      <h4>مسح الإشارات المستنتجة</h4>
                      <p>تفريغ سجل التفاعل المستنتج مع الإبقاء على اهتماماتك المختارة.</p>
                    </div>
                    <form action={clearInferredSignals}>
                      <button className="ac-toggle-btn" type="submit">
                        مسح الإشارات المستنتجة
                      </button>
                    </form>
                  </div>

                  <form action={signOutMember}>
                    <button className="ac-btn-signout" type="submit">
                      تسجيل الخروج من الحساب
                    </button>
                  </form>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
