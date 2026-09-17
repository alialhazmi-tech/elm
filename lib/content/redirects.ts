/**
 * طبقة تحويلات 301 للروابط القديمة — شرط بقاء الأرشيف والفهرسة (M-2).
 *
 * المصدر: migration-audit/redirects-required.csv من تدقيق التطابق. أرشيفات الوسوم
 * القديمة /tag/... تتحول إلى صفحات السلاسل، وقسما «غير مصنف» إلى منوعات.
 * أما المواد بقسم/سلاج خاطئ فيحسمها حارس canonical بالمعرّف داخل مسار المقال نفسه.
 *
 * وحدة نقية بلا اعتماديات: يقرؤها next.config.ts وتختبرها بوابة node:test مباشرة.
 */

export type LegacyRedirect = {
  source: string;
  destination: string;
  permanent: true;
  has?: { type: "query"; key: string; value: string }[];
};

const redirect = (source: string, destination: string): LegacyRedirect => ({
  source,
  destination,
  permanent: true,
});

/** روابط WordPress الرقمية المفهرسة تصل إلى محلل المعرّف قبل مسار القسم.
 * إعادة كتابة داخلية فقط؛ المحلل يعيد 301 مباشرة إلى canonical المنشور.
 */
export const LEGACY_STORY_REWRITES = [
  { source: "/:id(\\d+)", destination: "/legacy/:id" },
  // WordPress also published /ID/slug and AMP aliases; resolve by ID, never by slug.
  { source: "/:id(\\d+)/:slug", destination: "/legacy/:id" },
  { source: "/:id(\\d+)/:slug/amp", destination: "/legacy/:id" },
  // ووردبريس ألحق بالمادة مسارات فرعية: feed وcontact وprint وembed وترقيم التعليقات.
  // المعرّف وحده يحسم الوجهة، فأي ذيل بعد السلاج يعود إلى المحلل نفسه بدل 404.
  { source: "/:id(\\d+)/feed", destination: "/legacy/:id" },
  { source: "/:id(\\d+)/:slug/:tail*", destination: "/legacy/:id" },
  // أرشيف وسم بذيل (ترقيم أو feed) — الوسم وحده يحدد الوجهة.
  { source: "/tag/:tag/:tail*", destination: "/tag/:tag" },
];

/** أقسام الموقع كما ظهرت في روابط ووردبريس القديمة.
 * مكرّرة هنا عمدًا: هذه الوحدة نقية بلا اعتماديات (يقرؤها next.config قبل أي حزم)،
 * واختبار الوحدة يثبّت تطابقها مع SECTIONS فلا تفترقان بصمت.
 */
export const LEGACY_SECTION_SLUGS = [
  "politics", "economy", "technology", "sciences", "health", "sport", "culture",
  "world", "business", "varieties", "current-events", "ksa", "art",
  "infographics", "videos",
];

/** وسم السلسلة القديم (بصيغتي الشرطة والشرطة السفلية) → صفحة السلسلة. */
export const TAG_TO_SERIES: Record<string, string> = {
  "أبسط": "absat",
  "أغرب": "aghrab",
  "افهمها-صح": "efhamha-sah",
  "افهمها_صح": "efhamha-sah",
  "بالأرقام": "bel-arqam",
  "بالتاريخ": "bel-tarikh",
  "شخصيات": "shakhsiat",
  "لماذا": "limatha",
  "ماذا-لو": "matha-law",
  "ماذا_لو": "matha-law",
  "قالوا": "qalu",
  "تقارير": "taqarir",
  "موثق": "muwaththaq",
  "ماذا-بعد": "matha-baad",
  "ماذا_بعد": "matha-baad",
  "العلم-في-المونديال": "elm-mondial",
  "العلم_في_المونديال": "elm-mondial",
};

/** بحث ووردبريس القديم: `/?s=` في الجذر وفي صفحات ترقيم النتائج. */
const LEGACY_SEARCH_REDIRECTS: LegacyRedirect[] = [
  {
    source: "/",
    has: [{ type: "query", key: "s", value: "(?<term>.+)" }],
    destination: "/search?q=:term",
    permanent: true,
  },
  {
    source: "/page/:page(\\d+)",
    has: [{ type: "query", key: "s", value: "(?<term>.+)" }],
    destination: "/search?q=:term",
    permanent: true,
  },
];

/** أرشيفات ووردبريس: /category/{قسم} وترقيم /page/{رقم} في الأقسام والجذر.
 * الترقيم عندنا معامل `?p=`، والأرشيف بلا بادئة category.
 */
const LEGACY_ARCHIVE_REDIRECTS: LegacyRedirect[] = [
  ...LEGACY_SECTION_SLUGS.flatMap((slug) => [
    redirect(`/category/${slug}`, `/${slug}`),
    redirect(`/category/${slug}/page/:page(\\d+)`, `/${slug}?p=:page`),
    redirect(`/category/${slug}/feed`, `/${slug}`),
    redirect(`/${slug}/page/:page(\\d+)`, `/${slug}?p=:page`),
    redirect(`/${slug}/feed`, `/${slug}`),
  ]),
  // قسما «غير مصنف» ببادئة category أيضًا.
  redirect("/category/uncategorized", "/varieties"),
  redirect("/category/غير-مصنف", "/varieties"),
  // ترقيم الصفحة الرئيسية القديم — لا مقابل له، والوجهة الطبيعية الرئيسية.
  redirect("/page/:page(\\d+)", "/"),
];

/** أرشيف وسائط ووردبريس — لم يُنقل، والصور ما زالت تُخدم من المضيف القديم.
 * خلاصات RSS الجذرية (/feed و/comments/feed) تبقى 404 عمدًا: قرار موثق في
 * docs/seo/search-console-2026-09-08.md بعدم تحويل الخلاصات إلى الرئيسية.
 */
const LEGACY_MEDIA_REDIRECTS: LegacyRedirect[] = [
  redirect("/wp-content/uploads/:path*", "https://dash.alelm.net/wp-content/uploads/:path*"),
];

export const LEGACY_REDIRECTS: LegacyRedirect[] = [
  // البحث أولًا: `/` و`/page/N` لهما قاعدتان أعم بعدهما.
  ...LEGACY_SEARCH_REDIRECTS,
  redirect("/sitemap_index.xml", "/sitemap.xml"),
  // دليل «جاك العلم» كان على مسار الصيغة نفسها في الموقع القديم.
  redirect("/jakalelm", "/jak"),
  ...LEGACY_ARCHIVE_REDIRECTS,
  ...LEGACY_MEDIA_REDIRECTS,
  // أرشيفات الوسوم القديمة → صفحات السلاسل.
  ...Object.entries(TAG_TO_SERIES).map(([tag, slug]) =>
    redirect(`/tag/${tag}`, `/series/${slug}`),
  ),
  // «غير مصنف» بنسختيه كان قسمًا في القديم — مواده محفوظة تحت منوعات.
  redirect("/غير-مصنف", "/varieties"),
  redirect("/uncategorized", "/varieties"),
  // روابط المواد الثنائية والثلاثية تحسمها مسارات المقال بالمعرّف مباشرة،
  // دون تحويل وسيط إلى منوعات قد لا يكون القسم الفعلي للمادة.
];

/** Root query permalinks must run before the static homepage. */
export const LEGACY_QUERY_REWRITES = [
  { source: "/", has: [{ type: "query" as const, key: "p", value: "(?<legacyId>\\d+)" }], destination: "/legacy/:legacyId" },
];
