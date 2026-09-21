# عقد `/api/mobile/v1` — طلب فريق الويب

الأساس: `https://alelm.net` (محليًا أصل Next). المصادقة للمسارات الخاصة: جلسة العضوية الحالية (Neon Auth) عبر الكوكي، لا `memberId` من العميل.

روابط المواد تبقى `/{section}/{id}/{slug}` حرفيًا — أرشيف الفهرسة مقدس.

لا يُعاد استخدام `/api/content/home` كما هو: حزمة الويب أثقل وتتضمن حقول عرض الويب. الموبايل يحتاج بطاقات بلا `body`.

---

## يُسلَّم الآن — M1 يعتمد عليه

### `GET /api/mobile/v1/home`

عام، قابل للكاش.

**ترويسات**

- `Cache-Control: public, no-cache, must-revalidate`
- `X-Content-Contract: mobile-home.v1`

**جسم الاستجابة**

```json
{
  "contract": "mobile-home.v1",
  "generatedAt": "2026-08-12T20:00:00.000Z",
  "breaking": { "title": "…", "href": "/politics/123/slug", "until": "…" },
  "brief": [{ "title": "…", "href": "…", "color": "#12b5a0", "label": "أبسط" }],
  "hero": { "id": "…", "slug": "…", "section": "…", "href": "/…/…/…", "title": "…", "excerpt": "…", "eyebrow": "…", "readingMinutes": 4, "series": "absat", "format": "news", "image": "https://…", "publishedAt": "…" },
  "minis": [],
  "mosaic": [],
  "dataStory": null,
  "question": { "kick": "لماذا", "title": "…", "text": "…", "href": "…" },
  "videos": [],
  "numbers": [{ "value": "73", "suffix": "%", "label": "…", "href": "…" }],
  "series": [{ "slug": "absat", "name": "أبسط", "description": "…", "color": "#12b5a0" }],
  "mostRead": []
}
```

قواعد البطاقة:

- بلا `body` وبلا HTML.
- `image` مطلق (https) أو `null`.
- `series` slug أو `null`.
- الأرقام في النصوص لاتينية من المصدر.
- لا تكرار `id` بين hero / minis / mosaic / videos / mostRead.

---

## يُسلَّم — M2 المادة والسلاسل · M3 البحث ولك

### `GET /api/mobile/v1/story/:id`

عام، قابل للكاش. `X-Content-Contract: mobile-story.v2`.

الإصدار v2 ينقل بيانات صفحات «جاك العلم» كاملة، لا العنوان والنص والصورة فقط: القارئ
الغامر في التطبيق يبني منها المقارنة والمسار الزمني والقائمة والاقتباس. بلا هذه الحقول
تصل صفحات التقرير فارغة من مادتها.

```json
{
  "contract": "mobile-story.v2",
  "story": { "id": "…", "href": "/…/…/…", "title": "…", "body": "…", "factCheck": null },
  "series": { "slug": "…", "name": "…", "color": "#…" },
  "related": [],
  "nextInSeries": null,
  "jak": { "palette": "economy", "base": "#0b1a33", "base2": "#12284b", "glow": "#f5b92e", "glow2": "#ffd35e" },
  "slides": [
    {
      "id": "…", "type": "comparison", "title": "…", "body": "…",
      "stat": null, "statLabel": null, "image": null,
      "eyebrow": "بنية السوق", "focal": "center", "textSide": "center",
      "sides": [{ "label": "السياحة الداخلية", "value": "61%" }],
      "points": null, "items": null, "quoteBy": null
    }
  ]
}
```

`jak` و`slides` تكونان `null` لأي مادة ليست بشكل `jakalelm`. الطابع اللوني قرار على مستوى
المادة يُقرأ من أول شريحة تحمله، والافتراضي `economy`.

`GET /api/mobile/v1/series` · `GET /api/mobile/v1/series/:slug` — انظر حزمة M2 في المستودع.

### `GET /api/mobile/v1/search?q=`

عام، قابل للكاش. يطبّع الهمزات والتشكيل وينزع «الـ» من كل كلمة قبل المطابقة على العنوان والموجز والكلمات المفتاحية.

**ترويسات:** `Cache-Control: public, no-cache, must-revalidate` · `X-Content-Contract: mobile-search.v1`

```json
{
  "contract": "mobile-search.v1",
  "query": "الرياض",
  "results": [{ "id": "…", "href": "/…/…/…", "title": "…" }],
  "total": 3
}
```

استعلام فارغ يعيد `results: []` و`total: 0` دون خطأ. الحد الأقصى 40 بطاقة.

### `GET /api/mobile/v1/for-you`

جلسة عضوية (Neon Auth عبر الكوكي). بلا جلسة: `401` و`Cache-Control: private, no-store`.

**ترويسات عند النجاح:** `Cache-Control: private, no-store` · `X-Content-Contract: mobile-for-you.v1`

```json
{
  "contract": "mobile-for-you.v1",
  "items": [{ "id": "…", "href": "/…/…/…", "title": "…", "reason": "ظهر لك لأنه يلتقي مع اهتماماتك المختارة." }]
}
```

تطبيق iOS بلا كوكي مشتركة يعامل `401` كزائر: اهتمامات محلية + دعوة انضمام عبر Safari إلى `/join`. لا Bearer في هذا المعلم.

---

## يُطلب لاحقًا (لا تُبنى في العميل قبل العقد)

| المعلم | المسار | ملاحظات |
|--------|---------|----------|
| M3 | `POST /api/mobile/v1/like` | جلسة؛ المعرّف من الخادم |
| M3 | `POST /api/mobile/v1/events` | دفعات قراءة؛ clamp كما في الويب |
| M3 | `GET/POST /api/mobile/v1/closing` | سؤال الختام |
| M4 | `GET /api/mobile/v1/audio/:id` | عنوان بث إن وُجد |

مسارات `/api/me/*` الحالية للويب؛ الموبايل لا يعتمد عليها حتى يُوثَّق Bearer أو جلسة كوكي مشتركة.

## امتداد توافق الويب — 2026-09-06

`GET /api/mobile/v1/home` يضيف `presentation` إلى `mobile-home.v1` دون إزالة الحقول القديمة. يحتوي `briefFrom` و`briefScript` و`newsStrip` و`stream` (river/pulse/panels/infographics) و`seriesDirectory` و`archive`. بطاقات التدفق تستخدم MobileStoryCard دون متن وبصور مطلقة. مصدر التدفق هو `homeStream` المستخدم في الصفحة الرئيسية، واستبعاد التكرار يتبع منطق الويب. `stream` قابل لأن يكون null عند فشل المصدر الإضافي. العملاء القديمة تتجاهل الامتداد؛ العميل الجديد يفك غيابه عند قراءة كاش أو خادم أقدم.

فهرس `/api/mobile/v1/series` يستخدم أعداد `seriesDirectory` الكاملة بدل عدد عناصر صفحة التغذية.

## تحديث الوظائف الأصلية — 2026-09-06

يتجاوز هذا القسم افتراض «لا يعتمد الموبايل على مسارات الويب» الوارد في التوثيق التاريخي أعلاه: التطبيق القائم يستخدم جلسة كوكي HTTPS للعضوية والمحفوظات والاهتمامات. لا تضف Bearer بديلًا دون عقد مصادقة صريح.

`GET /api/mobile/v1/browse?kind=section|series&slug=...&page=1` يعيد `mobile-browse.v1`: `kind`, `slug`, `stories: MobileStoryCard[]`, `total`, `page`, `nextPage: number | null`. يرث حجم الصفحة وتطبيعها وتصفية المواد المنشورة من مزود صفحات الويب. الأقسام أو السلاسل غير المعروفة تعيد 404. هذا المسار إضافة؛ مسارات السلاسل القديمة باقية لتوافق العملاء السابقين.

القارئ يستخدم `GET /api/content/interactions?storyId=...` و`POST /api/content/interactions` مع `{storyId, liked}` أو `{storyId, answer}`. الرد `{liked, closingAnswer, counts}`؛ إرسال التفاعل يستخدم Origin الصحيح وجلسة URLSession المشتركة مع كوكي العضوية أو الزائر. خيارات الاستفتاء: 0 «نعم، أضافت لي سياقًا جديدًا»، و1 «كنت أعرف أغلب ما فيها». لا تُرحّل أصوات PollStore المحلية القديمة ولا تُعرض نتيجة حفظ قبل تأكيد الخادم.

## إضافات التكافؤ للتطبيق الأصلي — 2026-09-10

مسارات **قراءة رقيقة** فوق دوال `lib/*` القائمة بنفس بوابات الشاشات المقابلة. الأخطاء دائمًا `{ "error": "…" }` بالعربية، والطوابع الزمنية ISO كما في القاعدة (قد تكون `null`). كل مسار له اختبار سلوك: `tests/mobile-blocks.test.mjs`، `tests/mobile-story-v3.test.mjs`، و`tests/mobile-tahrir.integration.mjs` (قاعدة معزولة).

### القارئ — `/api/mobile/v1/*` (عام، `Cache-Control: public, no-cache, must-revalidate`)

#### `GET /api/mobile/v1/story/:id` → `X-Content-Contract: mobile-story.v3`

كل حقول v2 باقية (`story.body` نص خالص، `factCheck`، `series`، `related`، `nextInSeries`، `slides`، `jak`)، وأُضيف داخل `story`:

| الحقل | النوع | ملاحظة |
|---|---|---|
| `bodyHtml` | `string` | HTML منقّى بالوسوم المسموحة فقط (`p br strong em u s h2 h3 ul ol li blockquote a`)؛ المتن الإرثي يُحوَّل إلى `<p>` |
| `blocks` | `MobileBlock[]` | تحويل حتمي من `bodyHtml` (`lib/mobile/blocks.ts`) — بلا HTML |
| `videoUrl` | `string \| null` | رابط قياسي (يوتيوب/X/إنستقرام) من الحقل أو من المتن |
| `videoEmbedUrl` | `string \| null` | مشغّل التضمين |
| `videoKind` | `"youtube" \| "x" \| "instagram" \| null` | |
| `keywords` | `[{ keyword: string, href: string }]` | `href` = `/keywords/{encoded}` |
| `links` | `[{ href: string, label: string }]` | روابط المصادر الخارجية في المتن بلا تكرار |
| `updatedAt` | `string \| null` | |
| `seoDescription` | `string \| null` | |

وأُضيف على مستوى الحمولة `podcast: { show, episodes } | null` — غير `null` فقط لمادة بشكل `podcasts` لها برنامج مسجّل في `PODCAST_SHOWS`؛ فشل جلب الخلاصة يعطي `episodes: []`.

```json
{
  "contract": "mobile-story.v3",
  "story": {
    "id": "…", "slug": "…", "section": "…", "href": "/…/…/…", "title": "…", "excerpt": "…", "eyebrow": "…",
    "readingMinutes": 4, "series": null, "format": "news", "image": "https://…", "publishedAt": "…",
    "body": "نص خالص…", "factCheck": null,
    "bodyHtml": "<p>فقرة <strong>مهمة</strong></p><h2>عنوان</h2>",
    "blocks": [
      { "type": "paragraph", "runs": [{ "text": "فقرة " }, { "text": "مهمة", "bold": true }] },
      { "type": "heading", "level": 2, "runs": [{ "text": "عنوان" }] },
      { "type": "list", "ordered": false, "items": [[{ "text": "بند" }]] },
      { "type": "quote", "runs": [{ "text": "اقتباس" }], "align": "center" },
      { "type": "xpost", "postId": "1830000000000000001", "runs": [{ "text": "تغريدة", "href": "https://x.com/i/status/1830000000000000001" }] }
    ],
    "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "videoEmbedUrl": "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&hl=ar",
    "videoKind": "youtube",
    "keywords": [{ "keyword": "الرياض", "href": "/keywords/%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6" }],
    "links": [{ "href": "https://example.org/report", "label": "المصدر" }],
    "updatedAt": "2026-09-10T08:00:00.000Z",
    "seoDescription": null
  },
  "series": null, "related": [], "nextInSeries": null, "slides": null, "jak": null,
  "podcast": {
    "show": { "storyId": "175839", "name": "الغبوق", "cover": "https://…/podcasts/alghabouq.jpg", "accent": "#b35c1e", "youtube": "https://www.youtube.com/c/alelmmedia" },
    "episodes": [{ "title": "…", "audioUrl": "https://…", "mime": "audio/mpeg", "publishedAt": "…", "duration": "23:45", "description": "…", "episode": "13", "season": "1" }]
  }
}
```

عقد الكتل (`MobileBlock`):

- `Run = { text: string, bold?: true, italic?: true, underline?: true, strike?: true, href?: string }` — العلامات تظهر فقط عندما تكون `true`.
- `{ type: "paragraph", runs, align? }` · `{ type: "heading", level: 2 | 3, runs, align? }` · `{ type: "list", ordered: boolean, items: Run[][] }` · `{ type: "quote", runs, align? }` · `{ type: "xpost", postId: string, runs }`.
- `align` يظهر فقط عند وجوده وقيمته `"center" | "left" | "justify"` (اليمين افتراض RTL فلا يُكتب). `<br>` = `\n` داخل `text`. الكيانات مفكوكة. الفقرات الفارغة لا تصل. المتن الإرثي: فقرة لكل سطرين فأكثر.

#### `GET /api/mobile/v1/podcasts` → `mobile-podcasts.v1`

```json
{ "contract": "mobile-podcasts.v1", "shows": [{ "storyId": "175839", "name": "الغبوق", "cover": "https://…", "accent": "#b35c1e", "youtube": "https://www.youtube.com/c/alelmmedia", "href": "/podcasts/175839/…", "episodes": [ /* كما أعلاه */ ] }] }
```

`cover` من البرنامج أو صورة مادته أو `null`؛ `href` رابط مادة البرنامج أو `null` إن لم تكن منشورة.

#### `GET /api/mobile/v1/taxonomy` → `mobile-taxonomy.v1`

```json
{
  "contract": "mobile-taxonomy.v1",
  "sections": [{ "slug": "politics", "name": "سياسة وسياق", "shortName": "سياسة", "color": "#2f7d66" }],
  "series": [{ "slug": "absat", "name": "أبسط", "description": "شرح متدرج للمعقد", "color": "#2d9a8c" }],
  "archivedSeries": [{ "slug": "qalu", "name": "قالوا", "description": "…", "color": "#7c8aa5" }]
}
```

الأقسام الظاهرة فقط (إعداد اللوحة) مرتبة بـ`navPriority` ثم الاسم؛ `color` قد يكون `null`. `archivedSeries` = المتقاعدة الظاهرة في فهرس /series.

#### `GET /api/mobile/v1/keywords/:keyword?page=` → `mobile-keywords.v1`

```json
{ "contract": "mobile-keywords.v1", "keyword": "الرياض", "stories": [ /* MobileStoryCard */ ], "total": 21, "page": 1, "nextPage": 2 }
```

نفس ترقيم صفحة الكلمة في الويب (18/صفحة، الصفحة خارج المدى تُقصّ). كلمة بلا مواد منشورة → `404`.

#### `GET /api/mobile/v1/jak?limit=` → `mobile-jak.v1`

```json
{ "contract": "mobile-jak.v1", "stories": [ /* MobileStoryCard بشكل jakalelm */ ] }
```

`limit` افتراضيًا 40 وحدّه الأقصى 60. التقرير نفسه (الشرائح والطابع) عبر `story/:id`.

### حساب العضو — `/api/me/*` (جلسة العضوية عبر الكوكي؛ `Cache-Control: private, no-store`)

#### `GET /api/me/account?tab=saved|liked|history&page=` → `mobile-account.v1`

بلا جلسة `401`. `tab` غير معروف يعامل كـ`overview` (يعيد أول 3 محفوظات).

```json
{
  "contract": "mobile-account.v1", "memberId": "…", "tab": "saved",
  "user": { "name": "…", "email": "…", "joinedAt": "2026-01-01T00:00:00.000Z", "emailVerified": true, "image": null },
  "stats": { "articlesRead": 0, "activeMinutes": 0, "savedCount": 1, "likedCount": 0, "aiInteractions": 0 },
  "newsletterSubscribed": false, "personalizationEnabled": true,
  "items": [{ "story": { /* MobileStoryCard */ }, "savedAt": "…" }],
  "page": 1, "pageCount": 1
}
```

`items[]`: للمحفوظات والإعجابات `{ story, savedAt }`، ولسجل القراءة `{ story, progress: 0–100, lastVisitAt }`. `joinedAt` و`image` قد يكونان `null`. 12 عنصرًا لكل صفحة.

#### `POST /api/me/newsletter` `{ "subscribed": boolean }` → `{ "ok": true, "subscribed": boolean }`

بلا جلسة `401`؛ جسم غير صالح `400`؛ الاشتراك ببريد غير موثّق `403`. نفس منطق زر النشرة في صفحة الحساب (`lib/membership/newsletter.ts`).

### لوحة التحرير — `/api/tahrir/*` (كوكي `alelm_tahrir`؛ كل الردود `Cache-Control: private, no-store`)

`401` بلا جلسة حية، `403` مع كلمة المرور المؤقتة (عدا `/me`) أو بلا الصلاحية، `{error}` دائمًا. المنطق في `lib/tahrir/app-read.ts`.

**`StoryListRow`** (صف المادة الموحّد في `overview` و`story` و`schedule`):

```json
{
  "id": "…", "title": "…", "status": "review", "statusLabel": "بانتظار الاعتماد",
  "section": "economy", "sectionName": "اقتصاد", "seriesSlug": "absat", "series": { "name": "أبسط", "color": "#2d9a8c" },
  "authorName": "…", "authorId": "…", "assignedTo": null, "format": "news", "isJak": false, "image": "/uploads/…",
  "updatedAt": "…", "publishedAt": null, "scheduledAt": null, "revisionOf": null, "dueAt": null, "returnedAt": null,
  "guard": { "tone": "ok", "label": "سليم" }, "publicHref": null, "canEdit": true,
  "archive": null
}
```

- `guard` (`tone: "ok" | "warn" | "block"`) يُحسب حيث تحسبه الشاشة: قائمة المواد كلها وطابور الاعتماد في النظرة؛ وهو `null` في `latestPublished/latestDraft/scheduled` والجدولة.
- `series` و`archive` (`{ at, actor, reason }` للمؤرشفة فقط) و`publicHref` (للمنشورة فقط) قابلة لـ`null`. `image` مسار كما في القاعدة (نسبي أو مطلق).
- `canEdit` بحسب `canEditStory` للفاعل الحالي.

| المسار | البوابة | الاستجابة |
|---|---|---|
| `GET /api/tahrir/me` | جلسة (تُقبل كلمة المرور المؤقتة وغياب MFA) | `{ actor: { userId, username, displayName, avatarUrl: string\|null, role, roleLabel, permissions: string[], mustChangePassword, mfaEnabled, mfaRequired }, governance: { editorialGuard, requireImageRights } }` |
| `GET /api/tahrir/overview` | جلسة | `{ today: { dayKey, startIso, endIso }, counts: {[status]: number}, todayCount, perDay: [{ day: "YYYY-MM-DD", count }], review: StoryListRow[6], latestPublished: [12], latestDraft: [5], scheduled: [40], seriesDistribution: [{ seriesSlug, total, week }], media: { all, ok, pending }, nextScheduledAt: string\|null }` |
| `GET /api/tahrir/story?status=&p=&q=&series=` | جلسة | `{ rows: StoryListRow[], total, page, perPage: 30, totalPages, counts: {[status]: number, active}, filters: { status: string\|null, q: string, series: string\|null } }` — `status` غير معروف = كل النشطة؛ `p` خارج المدى يُقصّ |
| `GET /api/tahrir/story/:id` | جلسة + `canEditStory` (وإلا `403`؛ مفقودة `404`) | `{ story: { id, version, revisionOf, status, title, excerpt, body, section, slug, seriesSlug, image, format, pinned: boolean, breakingUntil, publishedAt, updatedAt, scheduledAt, seoTitle: string, seoDescription: string, keywords: string[], videoUrl, authorName, authorId, assignedTo, dueAt, returnedAt }, archiveEvent: { at, actor, reason }\|null, capabilities: { canEdit, canSubmit, canApprove, canSchedule, canArchive, canRestore, canDelete, canAssign }, historyHref }` — `body` HTML مخزّن كما هو؛ `canApprove` = `story.publish` (كما في المحرر)؛ `canDelete` = مسودة |
| `GET /api/tahrir/tasks?filter=all\|assigned\|returned\|own&page=` | جلسة | `{ filter, rows: [{ id, title, status, statusLabel, assignedTo, authorId, dueAt, returnedAt, revisionOf, overdue: boolean, canEdit }], page, hasMore }` (30/صفحة) |
| `GET /api/tahrir/taxonomy` | جلسة | `{ sections: [{ slug, name, shortName, color: string\|null }], series: [{ slug, name, color, archived }], formats: [{ id, label }], visibility: {[kind:slug]: boolean}\|null }` — `visibility` لمن يملك `ai.settings` فقط |
| `GET /api/tahrir/media?f=all\|ok\|pending&p=&q=` | `media.upload` | `{ filter, q, items: [{ id, url (مطلق), filename, mime, bytes, width: number\|null, height: number\|null, rightsCleared: boolean, flags: string, uploadedBy, createdAt, aiGenerated: boolean }], counts: { all, ok, pending }, page, perPage: 24, total }` |
| `GET /api/tahrir/audit?limit=` | `audit.view` | `{ rows: [{ id, at, actor, action, storyId: string\|null, detail, actorName: string\|null, actorAvatarUrl: string\|null, storyTitle: string\|null }], loadedAt: number }` (حد 200) |
| `GET /api/tahrir/stats` | `stats.view` | `{ counts, perDay, seriesDistribution: [{ seriesSlug, total, week }], formatDistribution: [{ format, count, label }], topAuthors: [{ authorName, count }], readingTime: { quick, medium, long } }` |
| `GET /api/tahrir/schedule` | `story.schedule` | `{ scheduled: StoryListRow[] (مرتبة بالموعد، حتى 100), nextScheduledAt: string\|null, automatic: boolean }` |
| `GET /api/tahrir/series` | جلسة | `{ distribution: [{ seriesSlug, total, week }], proposals: [{ id, name, valueCase, gapCase, impactCase, proposedBy, status, createdAt }], rows: [{ slug, name, description, color, hidden: boolean }] }` |
| `GET /api/tahrir/story/history?id=` | جلسة + `canEditStory` | `{ versions: [{ id, version, actor, createdAt, title: string\|null }], story: { id, status, version, revisionOf, format }, canRestore: boolean }` |

## تصحيحات المراجعة السلوكية — 2026-09-10 (مساءً)

- `GET /api/mobile/v1/story/:id` (`mobile-story.v3`): `videoUrl/videoEmbedUrl/videoKind` تُملأ **لمواد شكل `videos` فقط** كما في صفحة الويب
  (`app/[section]/[id]/[slug]/page.tsx:189`)؛ رابط يوتيوب داخل متن خبر يبقى رابطًا ضمن `links`. أُضيف `story.shareUrl`
  (رابط المشاركة بإصدار البطاقة عبر `refreshedShareUrl`) ليطابق ما يشاركه الويب.
- `GET /api/mobile/v1/search?q=&page=`: ترقيم كما في `/search` — 18 نتيجة للصفحة حتى 200، مع `total` و`page` و`pageCount`
  و`nextPage`. العملاء القديمة تقرأ `results` كما كانت (الصفحة الأولى).
- `GET /api/mobile/v1/home` (`series`) و`GET /api/mobile/v1/series` (`series`): مرشّحان بإخفاء التصنيف من «تحرير العلم»
  (`loadPublicTaxonomy`) كما الرئيسية وصفحة `/series`.
- `POST /api/content/listen`: التطبيق يستخدمه لموجز المادة (`kind:"story"`) وموجز الرئيسية بمشغّل واحد؛ النص المقروء هو
  `story.excerpt` فقط — ثبت بالنسخ النصي لصوت الإنتاج.
- روابط iOS العالمية: `public/.well-known/apple-app-site-association` بترويسة `application/json` (next.config). ضع معرّف فريق Apple في الملف قبل التفعيل.

