# تحليل الفجوات - منصة العلم

تاريخ الفحص: 2026-08-09. المجلد كان فارغًا قبل التأسيس؛ لذلك «الحالة السابقة» تعني عدم وجود كود أو إعدادات أو بيانات يمكن فحصها. الأرقام التاريخية (657KB JavaScript، 601KB HTML، TTFB 560-900ms) من الدراسة المرفقة وليست قياسًا لهذا المستودع.

| Requirement | Current State | Gap | Phase | Priority | Dependencies | Risk |
|---|---|---|---|---|---|---|
| مستودع وفرع عمل مستقل | تم تأسيس Git وفرع `feat/alelm-platform-rebuild` | لا يوجد remote أو CI خارجي | M0 | P0 | صلاحية GitHub | منخفض |
| Next.js App Router وTypeScript صارم | Next.js 16.3.0 وRSC وstrict TS | التحقق الإنتاجي على Cloudflare لم يكتمل | M0/M2 | P0 | حساب Cloudflare | متوسط |
| Cloudflare CDN/WAF/HTTP3/Brotli | إعداد OpenNext محلي فقط | لا يمكن التحقق أو التفعيل دون الحساب والنطاق | M0 | P0 | Cloudflare access | مرتفع |
| CSP وHSTS وترويسات الأمان | مطبقة في `next.config.ts` بلا نطاقات staging أو proxies | nonce-based CSP وWAF وrate limiting لاحقًا | M0/M4 | P0 | نموذج auth وedge | متوسط |
| SEO الوصفي | `ar_SA` وcanonical وOrganization وOG مخصص وrobots/sitemap | بيانات المقال/الكاتب وخرائط الأخبار والفيديو تنتظر المحتوى | M0/M2 | P0 | inventory + authors | مرتفع |
| صور WebP/AVIF وسقف 1920px | policy في Next Image config وبطاقة OG 1200x630 | لا توجد مكتبة وسائط أو صور WordPress لفحصها | M0/M4 | P1 | media inventory + R2 | متوسط |
| منع تكرار الرئيسية | عقد home bundle ومنطق dedupe مركزي | يحتاج بيانات WordPress الفعلية واختبارًا عليها | M0 | P0 | read API | منخفض |
| Jaak AlElm | غير معروض في الواجهة الجديدة | قرار التعبئة أو الإخفاء في الإنتاج يحتاج inventory | M0 | P1 | WordPress access | منخفض |
| قياس قبل/بعد | بوابة budget قيد التنفيذ؛ baseline الدراسة محفوظ | لا RUM ولا قياس شبكة خليجي حالي | M0/M5 | P0 | بيئة منشورة + analytics | مرتفع |
| Design System عربي RTL | tokens وRTL وdark preference ونمط أولي للسلاسل | Storybook، AA audit والقوالب الثمانية الكاملة لم تكتمل | M1 | P1 | اعتماد الهوية/Figma | متوسط |
| API محايدة | `ContentProvider` و`home-bundle.v1` | WordPress adapter وOpenAPI وarticle/SEO bundles غير منفذة | M2 | P0 | WordPress credentials | مرتفع |
| صفحات المنتج | Home تأسيسية فقط | article/series/program/episode/media/author/search | M2 | P0 | API contracts + DS | مرتفع |
| التفاعل القابل للقياس | غير منفذ عمدًا | polls/newsletter/follow/save/push/accounts/events | M3 | P1 | analytics + privacy + auth | متوسط |
| PostgreSQL + Redis + queues | غير موجود | schema وcache وBullMQ وworkers | M4 | P0 | infra decisions/secrets | مرتفع |
| CMS «تحرير العلم» | غير موجود | entities/workflows/RBAC/2FA/audit | M4 | P0 | وثيقة السياسة + فريق التحرير | حرج |
| Policy Guard وAI | محرك القواعد الحتمي منفذ ومختبر (39 قاعدة) والدستور مودع | يتبقى provider abstraction وحوكمة الكلفة وevals للقواعد السياقية | M4 | P0 | مزود النماذج + عينات تقييم | متوسط |
| البحث العربي والدلالي | غير موجود | normalization/index/pgvector/use-case evals | M4 | P1 | content corpus + search choice | متوسط |
| هجرة WordPress 1:1 | غير موجود | inventory/mapping/transform/validation/rehearsal/cutover | M4 | P0 | DB/API/media access | حرج |
| Observability وbackup/restore | Cloudflare observability flag فقط | Sentry/logging/alerts/backups/restore drill | M5 | P0 | production infra + channels | مرتفع |
| Launch gate | غير مجتاز | CWV field data، 10k crawl، rollback، training، GSC | M5 | P0 | كل المسار الحرج | حرج |

## Decision Required

1. توفير وصول قراءة إلى `dash.alelm.net`/WordPress وخرائط الموقع وبيئة nginx/Cloudflare.
2. ~~إيداع وثيقة «الآلية العامة وسياسة التحرير لمشروع العلم»~~ — **مغلق (2026-08-09)**: الدستور مودع في
   `docs/editorial-policy.md` ومشتق منه محرك القواعد. المتبقي: مراجعة تحريرية تعتمد الصياغة وتضبط
   الحالات المختلف عليها (المناسبات القومية، حدود «سمو»، سقف «عاجل» اليومي).
3. اعتماد مالك المنتج التحريري، الأدوار الفعلية، وقنوات الاعتماد والتنبيه.
4. تحديد مزود التحليلات والبريد والبحث بعد مقارنة متطلبات الخصوصية والتشغيل.
5. اعتماد مزود النماذج اللغوية وحدود الكلفة قبل تفعيل القواعد السياقية (اللاءات الخمس، خداع العناوين)
   التي تُعلَّم اليوم `needsHumanReview` وتصل إلى المعتمد البشري.
