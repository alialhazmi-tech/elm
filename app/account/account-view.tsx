import Image from "next/image";
import { ProfileAvatar } from "@/components/profile-avatar";
import { AvatarUpload } from "@/components/avatar-upload";
import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  Check,
  Clock3,
  ChevronDown,
  Compass,
  Heart,
  LayoutGrid,
  LockKeyhole,
  Mail,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import type {
  AccountTab,
  MemberAccountData,
  MemberSavedStory,
  MemberHistoryItem,
} from "@/lib/membership/account-data";
import { formatReadingMinutes, relativeTimeAr } from "@/lib/format";
import { storyHref } from "@/lib/content/types";
import { sectionName, seriesOf } from "@/lib/content/provider";
import {
  AccountAction,
  DetailsForm,
  EmailVerificationNotice,
  InterestsForm,
  PasswordForm,
} from "./account-forms";
import {
  clearInferredSignals,
  removeLikedStory,
  removeSavedStory,
  signOutMember,
  toggleNewsletter,
  togglePersonalization,
} from "./actions";

const navigation = [
  { id: "overview", label: "نظرة عامة", icon: LayoutGrid },
  { id: "saved", label: "المحفوظات", icon: Bookmark },
  { id: "liked", label: "إعجاباتي", icon: Heart },
  { id: "history", label: "سجل القراءة", icon: Clock3 },
  { id: "interests", label: "اهتماماتي", icon: Compass },
  { id: "settings", label: "إعدادات الحساب", icon: Settings2 },
] as const;
function EmptyState({ kind }: { kind: "saved" | "liked" | "history" }) {
  const Icon =
    kind === "saved" ? Bookmark : kind === "liked" ? Heart : BookOpen;
  return (
    <div className="ac-empty">
      <Icon size={30} strokeWidth={1.4} />
      <h3>
        {kind === "saved"
          ? "مكان للمعرفة التي تستحق العودة"
          : kind === "liked"
            ? "ما يعجبك سيجد مكانه هنا"
            : "رحلتك تبدأ بمادة"}
      </h3>
      <p>
        {kind === "saved"
          ? "اضغط علامة الحفظ داخل أي مادة لتضيفها إلى مكتبتك."
          : kind === "liked"
            ? "اضغط زر الإعجاب داخل المادة، وستجد اختياراتك هنا."
            : "ابدأ القراءة، وسيظهر هنا آخر ما قرأته ومدى تقدمك."}
      </p>
      <Link className="ac-button ac-button-secondary" href="/for-you">
        استكشف مواد لك
        <ArrowLeft size={15} />
      </Link>
    </div>
  );
}
function StoryList({
  items,
  liked = false,
  compact = false,
}: {
  items: MemberSavedStory[];
  liked?: boolean;
  compact?: boolean;
}) {
  if (!items.length) return <EmptyState kind={liked ? "liked" : "saved"} />;
  return (
    <div className="ac-stories">
      {items.map(({ story, savedAt }) => {
        const series = seriesOf(story);
        return (
          <article key={story.id} className="ac-story">
            <Link
              href={storyHref(story)}
              className="ac-story-image"
              tabIndex={-1}
              aria-hidden="true"
            >
              {story.image ? (
                <Image
                  src={story.image}
                  alt=""
                  fill
                  sizes="(max-width:600px) 78px, 108px"
                />
              ) : (
                <BookOpen size={24} />
              )}
            </Link>
            <div className="ac-story-body">
              <span
                className="ac-story-category"
                style={
                  { "--story-color": series?.color } as React.CSSProperties
                }
              >
                {series?.name ?? sectionName(story.section)}
              </span>
              <h3>
                <Link href={storyHref(story)}>{story.title}</Link>
              </h3>
              <span className="ac-story-meta">
                {formatReadingMinutes(story.readingMinutes)}
                <span aria-hidden="true">·</span>
                {liked ? "أعجبتك" : "حفظتها"} {relativeTimeAr(savedAt)}
              </span>
            </div>
            {!compact && (
              <AccountAction
                action={liked ? removeLikedStory : removeSavedStory}
                label={liked ? "إلغاء الإعجاب" : "إزالة الحفظ"}
                className="ac-text-button"
              >
                <input type="hidden" name="storyId" value={story.id} />
              </AccountAction>
            )}
          </article>
        );
      })}
    </div>
  );
}
function HistoryList({ items }: { items: MemberHistoryItem[] }) {
  if (!items.length) return <EmptyState kind="history" />;
  return (
    <div className="ac-history">
      {items.map(({ story, progress, lastVisitAt }) => (
        <article key={story.id} className="ac-history-row">
          <span className="ac-history-icon">
            <BookOpen size={19} />
          </span>
          <div>
            <h3>
              <Link href={storyHref(story)}>{story.title}</Link>
            </h3>
            <small>آخر قراءة {relativeTimeAr(lastVisitAt)}</small>
            <div className="ac-progress-row">
              <div
                className="ac-progress"
                role="progressbar"
                aria-label={`تقدم القراءة: ${story.title}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <span style={{ width: `${progress}%` }} />
              </div>
              <span>{progress}%</span>
            </div>
          </div>
          <Link className="ac-text-button" href={storyHref(story)}>
            {progress >= 90 ? "اقرأ مجددًا" : "تابع القراءة"}
          </Link>
        </article>
      ))}
    </div>
  );
}
function Pagination({
  data,
  tab,
  basePath,
}: {
  data: MemberAccountData;
  tab: AccountTab;
  basePath: string;
}) {
  if (data.pageCount < 2) return null;
  return (
    <nav className="ac-pagination" aria-label="صفحات المكتبة">
      {data.page > 1 ? (
        <Link
          className="ac-button ac-button-secondary"
          href={`${basePath}?tab=${tab}&page=${data.page - 1}`}
        >
          السابق
        </Link>
      ) : (
        <span />
      )}
      <span>
        صفحة {data.page} من {data.pageCount}
      </span>
      {data.page < data.pageCount ? (
        <Link
          className="ac-button ac-button-secondary"
          href={`${basePath}?tab=${tab}&page=${data.page + 1}`}
        >
          التالي
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
function SectionHead({
  title,
  href,
  link = "عرض الكل",
}: {
  title: string;
  href?: string;
  link?: string;
}) {
  return (
    <header className="ac-section-head">
      <h2>{title}</h2>
      {href && (
        <Link href={href}>
          {link}
          <ArrowLeft size={14} />
        </Link>
      )}
    </header>
  );
}
export function AccountView({
  data,
  tab = "overview",
  welcome = false,
  basePath = "/account",
}: {
  data: MemberAccountData;
  tab?: AccountTab;
  welcome?: boolean;
  basePath?: "/account" | "/prototype/account";
}) {
  const { user, profile, stats } = data;
  const joined = user.joinedAt
    ? new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
        month: "long",
        year: "numeric",
        timeZone: "Asia/Riyadh",
      }).format(new Date(user.joinedAt))
    : null;
  const title =
    navigation.find((item) => item.id === tab)?.label ?? "ملفي الشخصي";
  return (
    <main className="ac-shell">
      <div className="ac-container">
        <div className="ac-breadcrumb">
          <Link href="/">العلم</Link>
          <span>/</span>
          <span>ملفي الشخصي</span>
        </div>
        <header className="ac-profile-head">
          <div className="ac-profile-person">
            <div className="ac-avatar" aria-hidden="true">
              <ProfileAvatar name={user.name} image={user.image} size={80} />
            </div>
            <div className="ac-profile-info">
              <p className="ac-profile-greeting">أهلًا بك في العلم</p>
              <h2>{user.name}</h2>
              <bdi dir="ltr">{user.email}</bdi>
            </div>
          </div>
          <div className="ac-profile-status">
            <span className={`ac-member-badge${user.emailVerified ? " is-verified" : ""}`}>
              {user.emailVerified ? <ShieldCheck size={18} /> : <UserRound size={18} />}
              {user.emailVerified ? "بريدك الإلكتروني موثّق" : "عضو في العلم"}
            </span>
            {joined && <span>عضو منذ {joined}</span>}
          </div>
        </header>
        {!user.emailVerified && (
          <div className="ac-verification-banner">
            <EmailVerificationNotice key={user.email} email={user.email} />
          </div>
        )}
        <div className="ac-layout">
          <aside className="ac-sidebar" aria-label="ملف العضو">
            <p className="ac-nav-title">حسابي</p>
            <nav className="ac-nav" aria-label="أقسام حسابي">
              {navigation.map((item) => (
                <Link
                  key={item.id}
                  href={`${basePath}?tab=${item.id}`}
                  aria-current={tab === item.id ? "page" : undefined}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  {data.available &&
                    (item.id === "saved" || item.id === "liked") && (
                      <small>
                        {item.id === "saved"
                          ? stats.savedCount
                          : stats.likedCount}
                      </small>
                    )}
                </Link>
              ))}
            </nav>
            <div className="ac-sidebar-foot">
              <Link href="/for-you">
                <Compass size={17} />
                قراءات مقترحة لك
                <ArrowLeft size={14} />
              </Link>
              <AccountAction
                action={signOutMember}
                label="تسجيل الخروج"
                className="ac-text-button ac-signout-button"
                pendingLabel="جارٍ تسجيل الخروج…"
              />
            </div>
          </aside>
          <div className="ac-content">
            <header className="ac-page-head">
              <div>
                <h1>{tab === "overview" ? "حسابك في لمحة" : title}</h1>
                <p>
                  {tab === "overview"
                    ? "قراءاتك ومحفوظاتك والموضوعات التي تهمّك، في مكان واحد."
                    : tab === "saved"
                      ? "المواد التي اخترت الاحتفاظ بها، في مكان واحد."
                      : tab === "liked"
                        ? "الأفكار والمواد التي لفتت انتباهك."
                        : tab === "history"
                          ? "عُد إلى آخر قراءاتك وتابع الاستكشاف."
                          : tab === "interests"
                            ? "اختر ما تحب متابعته. يمكنك تغيير اختياراتك في أي وقت."
                            : "عدّل بياناتك، واحمِ حسابك، واختر ما يناسبك من إعدادات الخصوصية."}
                </p>
              </div>
              {tab === "overview" && (
                <Link
                  className="ac-button ac-button-secondary"
                  href={`${basePath}?tab=settings`}
                >
                  <UserRound size={16} />
                  تعديل الملف
                </Link>
              )}
            </header>
            {welcome && (
              <p className="ac-welcome" role="status">
                <Check size={17} />
                اكتملت خطوات عضويتك. أهلًا بك في العلم.
              </p>
            )}
            {!data.available ? (
              <section className="ac-section">
                <div className="ac-empty">
                  <BookOpen size={30} />
                  <h2>تعذر تحميل بياناتك الآن</h2>
                  <p>
                    حسابك مسجّل الدخول. أعد المحاولة لاستعادة مكتبتك وإعداداتك.
                  </p>
                  <Link
                    className="ac-button ac-button-secondary"
                    href={`${basePath}?tab=${tab}`}
                  >
                    إعادة المحاولة
                  </Link>
                </div>
              </section>
            ) : (
              <>
                {tab === "overview" && (
                  <>
                    <section className="ac-stats" aria-label="ملخص نشاطك">
                      <div>
                        <BookOpen size={18} />
                        <strong>{stats.articlesRead}</strong>
                        <span>مواد أكملت قراءتها</span>
                      </div>
                      <div>
                        <Clock3 size={18} />
                        <strong>
                          {stats.activeMinutes}
                          <small>دقيقة</small>
                        </strong>
                        <span>دقائق قضيتها في القراءة</span>
                      </div>
                      <div>
                        <Bookmark size={18} />
                        <strong>{stats.savedCount}</strong>
                        <span>في محفوظاتك</span>
                      </div>
                      <div>
                        <Heart size={18} />
                        <strong>{stats.likedCount}</strong>
                        <span>مواد أعجبتك</span>
                      </div>
                    </section>
                    <section className="ac-for-you">
                      <div className="ac-for-you-icon">
                        <Compass size={28} strokeWidth={1.4} />
                      </div>
                      <div>
                        <h2>قراءات تناسب اهتماماتك</h2>
                        <p>
                          {profile.interests.length
                            ? `${profile.interests.length} موضوعات اخترتها تساعدنا في اقتراح قراءات لك.`
                            : "ابدأ باختيار اهتماماتك لنرتّب لك ما يستحق القراءة."}
                        </p>
                      </div>
                      <Link
                        className="ac-button ac-button-primary"
                        href={
                          profile.interests.length
                            ? "/for-you"
                            : `${basePath}?tab=interests`
                        }
                      >
                        {profile.interests.length
                          ? "تصفّح صفحة «لك»"
                          : "اختر اهتماماتك"}
                        <ArrowLeft size={16} />
                      </Link>
                    </section>
                    <div className="ac-overview-grid">
                      <section className="ac-section">
                        <SectionHead
                          title="آخر ما حفظته"
                          href={`${basePath}?tab=saved`}
                        />
                        <StoryList items={data.savedStories} compact />
                      </section>
                      <section className="ac-section ac-interests-summary">
                        <SectionHead
                          title="اهتماماتك"
                          href={`${basePath}?tab=interests`}
                          link="تعديل"
                        />
                        <p>الموضوعات التي تحب أن تعرف عنها أكثر.</p>
                        <div className="ac-interest-tags">
                          {profile.interests.length ? (
                            profile.interests.map((item) => (
                              <span key={item.id}>
                                <i style={{ background: item.color }} />
                                {item.label}
                              </span>
                            ))
                          ) : (
                            <p>لم تختر اهتمامات بعد.</p>
                          )}
                        </div>
                        <div className="ac-personalization-status">
                          <ShieldCheck size={16} />
                          <span>
                            التخصيص{" "}
                            {profile.personalizationEnabled ? "مفعّل" : "متوقف"}
                          </span>
                        </div>
                      </section>
                    </div>
                    <section className="ac-section">
                      <SectionHead
                        title="من سجل قراءاتك"
                        href={`${basePath}?tab=history`}
                      />
                      <HistoryList items={data.recentHistory} />
                    </section>
                    {data.recommendedStories.length > 0 && (
                      <section className="ac-section">
                        <SectionHead
                          title="قد تهمّك هذه القراءات"
                          href="/for-you"
                        />
                        <div className="ac-recommendations">
                          {data.recommendedStories.map((story) => (
                            <article key={story.id}>
                              <span className="ac-story-category">
                                {story.sectionLabel}
                              </span>
                              <h3>
                                <Link href={story.href}>{story.title}</Link>
                              </h3>
                              <p>
                                {story.reason?.text ?? "من أحدث مواد العلم"}
                              </p>
                              <small>
                                {formatReadingMinutes(story.readingMinutes)}
                              </small>
                            </article>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
                {(tab === "saved" || tab === "liked") && (
                  <section className="ac-section">
                    <SectionHead
                      title={
                        tab === "saved"
                          ? `${stats.savedCount} مادة محفوظة`
                          : `${stats.likedCount} مادة أعجبتك`
                      }
                    />
                    <StoryList
                      items={
                        tab === "saved" ? data.savedStories : data.likedStories
                      }
                      liked={tab === "liked"}
                    />
                    <Pagination data={data} tab={tab} basePath={basePath} />
                  </section>
                )}
                {tab === "history" && (
                  <section className="ac-section">
                    <HistoryList items={data.recentHistory} />
                    <Pagination data={data} tab={tab} basePath={basePath} />
                    <p className="ac-section-note">
                      نسبة القراءة توضّح أين توقفت في كل مادة.
                      يمكنك مسح السجل من إعدادات الخصوصية.
                    </p>
                  </section>
                )}
                {tab === "interests" && (
                  <section className="ac-section ac-padded">
                    <InterestsForm
                      initial={profile.interests.map((item) => item.id)}
                    />
                    <p className="ac-section-note">
                      يمكنك اختيار أكثر من موضوع. تبقى اختياراتك محفوظة حتى لو أوقفت
                      اقتراح القراءات حسب اهتماماتك.
                    </p>
                  </section>
                )}
                {tab === "settings" && (
                  <>
                    <div className="ac-settings-grid">
                      <section className="ac-section ac-padded">
                        <SectionHead title="البيانات الشخصية" />
                        <p className="ac-panel-description">اسمك وصورتك كما يظهران في حسابك.</p>
                        <div className="ac-avatar-editor">
                          <AvatarUpload name={user.name} image={user.image} endpoint="/api/account/avatar" />
                        </div>
                        <DetailsForm name={user.name} email={user.email} />
                      </section>
                      <section className="ac-section ac-padded">
                        <SectionHead title="أمان الحساب" />
                        <details className="ac-password-disclosure">
                          <summary>
                            <LockKeyhole size={22} aria-hidden="true" />
                            <span>
                              <strong>تغيير كلمة المرور</strong>
                              <span>اختر كلمة مرور قوية لا تستخدمها في حساب آخر.</span>
                            </span>
                            <ChevronDown size={20} className="ac-disclosure-chevron" aria-hidden="true" />
                          </summary>
                          <PasswordForm />
                        </details>
                      </section>
                    </div>
                    <section className="ac-section ac-padded">
                      <SectionHead title="البريد والخصوصية" />
                      <div className="ac-setting-row">
                        <Mail size={21} />
                        <div>
                          <h3>النشرة البريدية</h3>
                          <p>استقبل النشرة على بريد حسابك. يمكنك إلغاء الاشتراك في أي وقت.</p>
                          <span className="ac-status-pill">
                            {data.newsletterSubscribed ? "مشترك" : "غير مشترك"}
                          </span>
                        </div>
                        <AccountAction
                          action={toggleNewsletter}
                          label={
                            data.newsletterSubscribed
                              ? "إلغاء الاشتراك"
                              : "الاشتراك في النشرة"
                          }
                        >
                          <input
                            type="hidden"
                            name="enabled"
                            value={data.newsletterSubscribed ? "0" : "1"}
                          />
                        </AccountAction>
                      </div>
                      <div className="ac-setting-row">
                        <Sparkles size={21} />
                        <div>
                          <h3>اقتراح قراءات تناسبك</h3>
                          <p>
                            نستخدم الموضوعات التي اخترتها ونشاط قراءتك لاقتراح مواد
                            تهمّك في صفحة «لك».
                          </p>
                          <span className="ac-status-pill">
                            {profile.personalizationEnabled ? "مفعّل" : "متوقف"}
                          </span>
                        </div>
                        <AccountAction
                          action={togglePersonalization}
                          label={
                            profile.personalizationEnabled
                              ? "إيقاف الاقتراحات المخصصة"
                              : "تفعيل الاقتراحات المخصصة"
                          }
                        >
                          <input
                            type="hidden"
                            name="enabled"
                            value={profile.personalizationEnabled ? "0" : "1"}
                          />
                        </AccountAction>
                      </div>
                      <div className="ac-setting-row ac-clear-row">
                        <ShieldCheck size={21} />
                        <div>
                          <h3>مسح سجل القراءة</h3>
                          <p>
                            يحذف سجل قراءتك وما تعلّمناه منه لتخصيص الاقتراحات.
                            لن تُحذف محفوظاتك أو إعجاباتك أو الموضوعات التي اخترتها.
                          </p>
                          <details className="ac-confirm">
                            <summary>
                              مسح سجل القراءة وبيانات التخصيص
                            </summary>
                            <p>
                              هذا الإجراء لا يمكن التراجع عنه. هل ترغب في
                              المتابعة؟
                            </p>
                            <AccountAction
                              action={clearInferredSignals}
                              label="تأكيد المسح"
                              className="ac-button ac-button-danger"
                            >
                              <input type="hidden" name="confirm" value="yes" />
                            </AccountAction>
                          </details>
                        </div>
                      </div>
                      <Link className="ac-policy-link" href="/privacy-policy">
                        اقرأ سياسة الخصوصية
                        <ArrowLeft size={14} />
                      </Link>
                      <div className="ac-settings-signout">
                        <AccountAction
                          action={signOutMember}
                          label="تسجيل الخروج من الحساب"
                          className="ac-text-button ac-signout-button"
                          pendingLabel="جارٍ تسجيل الخروج…"
                        />
                      </div>
                    </section>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
