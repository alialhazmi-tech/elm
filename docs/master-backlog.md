# Master Backlog - M0 إلى M5

الأولوية مرتبة بالاعتماديات. كل مهمة تحمل هدفًا، أثرًا، اختبارًا، وتعريف إنجاز قابلًا للتحقق.

## M0 - الإصلاحات الفورية والأساس

### Epic M0-E1: Baseline وأمان الحافة

- **M0-T1 - تأسيس مستودع وفرع تنفيذ.** الهدف: عزل العمل. الملفات: Git/README. الاعتماديات: لا شيء. الاختبار: `git status`. DoD: baseline commit وفرع مستقل. التحقق: اسم الفرع وسجل commit. الحالة: `VERIFIED`.
- **M0-T2 - ترويسات الأمان.** الهدف: CSP بلا staging/proxy، HSTS، MIME، frame، referrer، permissions. الملفات: `next.config.ts`. المخاطر: CSP قد يكسر تكاملات مستقبلية. الاختبار: routes manifest + HTTP response. DoD: الترويسات موجودة ولا تسمح بنطاقات غير معتمدة. الحالة: `IN_PROGRESS`.
- **M0-T3 - Cloudflare edge.** الهدف: CDN/HTTP3/Brotli/WAF/cache rules/purge. الاعتماديات: حساب ونطاق. الاختبار: headers وWebPageTest من الخليج. DoD: تفعيل موثق وقياس TTFB <150ms. الحالة: `BLOCKED`.

### Epic M0-E2: SEO وصور وتجربة الرئيسية

- **M0-T4 - SEO quick fixes.** الهدف: `ar_SA`، وصف معرفي، author identity، Organization، canonical، OG. الاختبارات: build metadata contract. DoD: لا stuffing ولا raw user IDs. الحالة: `IN_PROGRESS`.
- **M0-T5 - image policy.** الهدف: AVIF/WebP وسقف 1920px وبطاقة OG 1200x630. الاختبارات: config + dimensions. DoD: policy وبطاقة مخصصة. الحالة: `DONE`.
- **M0-T6 - home bundle deduplication.** الهدف: المادة تظهر مرة واحدة فقط بين hero والبلوكات. الملفات: `lib/content/*`. الاختبار: IDs فريدة في HTML. DoD: دالة مركزية واختبار إيجابي. الحالة: `IN_PROGRESS`.
- **M0-T7 - Jaak AlElm.** الهدف: منع الصفحة الميتة. الإجراء الحالي: عدم إدراجه في الواجهة الجديدة. DoD النهائي: إخفاء edge route أو تعبئته بعد inventory. الحالة: `BLOCKED`.
- **M0-T8 - before/after measurement.** الهدف: قياس JS/LCP/INP/CLS/TTFB. الاختبارات: CI budget + RUM لاحقًا. DoD: baseline وقياس منشور. الحالة: `IN_PROGRESS`.

## M1 - Design System

### Epic M1-E1: هوية رقمية عربية

- **M1-T1 - tokens والطباعة والشبكة.** المخرجات: ألوان، spacing، typography، light/dark، RTL. الاعتماديات: اعتماد الهوية. الاختبارات: visual/a11y. DoD: tokens موثقة بلا CSS متفرق.
- **M1-T2 - مكتبة المكونات.** Cards/buttons/inputs/nav/media/quotes/data/charts/tables/modals/feedback/loading/error. الاختبارات: unit + axe + visual. DoD: Storybook في الحالتين والاتجاهين.
- **M1-T3 - قوالب السلاسل التسع.** المكونات المميزة حرفيًا وفق الوثيقة. الاختبارات: snapshots وkeyboard. DoD: identity/archive/follow affordance لكل سلسلة.

## M2 - الواجهة وطبقة API

### Epic M2-E1: عقد محتوى محايد

- **M2-T1 - OpenAPI وعقود bundles.** `home-bundle`, `article-bundle`, `seo-bundle`. المخاطر: coupling مع WP. الاختبارات: contract/integration. DoD: WordPress وCMS adapters يحققان العقد نفسه.
- **M2-T2 - WordPress read adapter.** inventory حقيقي مع cache وtimeouts. DoD: staging data بلا كشف أسرار.

### Epic M2-E2: صفحات المنتج

- **M2-T3 - Home production template.** Hero/sلاسل/وراء الخبر/video/podcast/infographic/most-read بلا تكرار.
- **M2-T4 - Article + series templates.** مصادر/كاتب/Schema/related/question/share وقالب مميز لكل سلسلة.
- **M2-T5 - Programs/episodes/media/authors.** players/transcripts/guests/archives/SEO.
- **M2-T6 - Arabic search.** typeahead مصنف + صفحة نتائج، normalization للهمزات والتشكيل و«الـ».
- **M2-T7 - SEO surfaces.** news/video sitemaps، Person/NewsArticle/PodcastEpisode/VideoObject، policy page.

## M3 - التفاعل والنمو

### Epic M3-E1: تفاعل قابل للقياس

- **M3-T1 - analytics event contract.** read-depth/completion/vote/follow/play/subscribe/share مع properties موحدة.
- **M3-T2 - polls + ending question.** حماية rate-limit ونتائج لحظية واختبار رحلة الزائر.
- **M3-T3 - newsletter.** قيمة معلنة، templates، provider، consent، delivery/open/click.
- **M3-T4 - follow/save/accounts/push.** حساب خفيف بلا paywall، selective push، privacy review.

## M4 - «تحرير العلم» وAI والهجرة

### Epic M4-E1: النواة التحريرية

- **M4-T1 - PostgreSQL model.** Article/Series/Program/Episode/Guest/Author/Infographic/Video/Event/Poll/Redirect/SocialPost ككيانات أصلية.
- **M4-T2 - workflow state machines.** proactive وcurrent paths مع منع الانتقالات غير القانونية.
- **M4-T3 - RBAC/2FA/sessions.** least privilege وحماية أقوى للاعتماد والنشر.
- **M4-T4 - immutable audit.** create/edit/approve/reject/schedule/publish/unpublish/delete/override/permission.
- **M4-T5 - Redis/BullMQ.** scheduling/media/newsletter/social/AI/reports مع idempotency/retry/DLQ.

### Epic M4-E2: AI governed layer

- **M4-T6 - Policy Guard rules engine.** Rule/validator/test/severity/audit؛ deterministic أولًا. الحالة: `VERIFIED`. المخرجات: `docs/editorial-policy.md` كمصدر ملزم، و`lib/policy/` بـ39 قاعدة حتمية موزعة على protocol/restricted/editorial/formatting/production، وثلاث شدات (`blocking`/`warning`/`suggestion`)، وتطبيع عربي يقاوم التشكيل واختلاف الألف والهمزات، وإصلاح آلي غير متداخل، وسجل تدقيق ببصمة المنفذ والقواعد القاطعة. الاختبار: `tests/policy-guard.test.mjs` (24 حالة إيجابية وسلبية) ضمن `npm test`. الأداة: `npm run policy:check -- examples/draft-sample.json`. المتبقي: ربطها بواجهة المحرر عند بناء CMS (M4-T1/T2).
- **M4-T7 - Editorial Assistant/transformers.** Suggestions فقط وبوابة بشرية وحدود النصوص.
- **M4-T8 - provider abstraction/governance.** usage/cost/latency/version/budget/privacy/evaluation samples.
- **M4-T9 - semantic layer.** related/duplicate/trend-gap use cases مع corpus evaluation.

### Epic M4-E3: WordPress migration

- **M4-T10 - inventory + mapping.** بصمات وURLs وعلاقات ومؤلفون ووسائط.
- **M4-T11 - repeatable transformer.** HTML إلى blocks مع validation لكل مادة.
- **M4-T12 - rehearsals + diff + incremental sync.** صفر أخطاء قبل القطع.
- **M4-T13 - edge cutover + rollback drill.** archive ثم sections ثم home؛ رجوع فوري لكل مسار.

## M5 - القياس والتشغيل والإطلاق

### Epic M5-E1: جودة وتشغيل مستمر

- **M5-T1 - CI/CD gates.** lint/types/unit/integration/E2E/build/security/performance مع موافقة production.
- **M5-T2 - observability.** Sentry/structured logs/uptime/RUM/queue health/resource saturation/alerts.
- **M5-T3 - backup/restore.** نسخ يومي واختبار استعادة شهري موثق.
- **M5-T4 - launch acceptance.** CWV field green، 100% archive diff، صفر broken links في 10k crawl، GSC، rollback، alerts.
- **M5-T5 - editorial readiness.** parallel pilot بمواد حقيقية، تدريب، دليل استخدام عربي.

## Post Launch Backlog

أي A/B testing أو تخصيص متقدم أو تكامل إضافي غير لازم لبوابة الإطلاق يبقى هنا حتى اكتمال M5.
