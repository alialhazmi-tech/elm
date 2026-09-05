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
