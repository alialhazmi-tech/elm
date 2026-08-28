# تقرير تطابق ترحيل «العلم»

**القرار: NOT READY FOR M2**

تاريخ القياس: 2026-08-28T05:56:09.205Z

المصدر القديم: https://dash.alelm.net/wp-json/wp/v2 وhttps://alelm.net (قراءة فقط)

الهدف الجديد: https://elm-production-5035.up.railway.app + Neon (قراءة فقط)

## الخلاصة التنفيذية

لا يجوز بدء M-2 أو القطع في الحالة الحالية. REST الحي يحتوي **29,094** مادة منشورة، بينما الهدف يحتوي **500** صفًا مطابق المعرف من أصل **508** صفًا. التصنيفات: EXACT_200=498، VALID_301=0، 404=28594، CONFLICT=2.

فحص HTTP في الوضع **sample**: قيس حيًا 659 رابط مادة على الهدف و160 رابط مادة على الموقع القديم، إضافة إلى 36 صفحة قسم/وسم/صفحة ثابتة على الهدف. الحالات غير المقيسة حيًا موسومة صراحة بأنها مستنتجة من غياب صف الهدف، وليست ادعاء استجابة شبكة فعلية.

## القواطع

- **MISSING_TARGET_STORIES:** 28594 ID منشور في ووردبريس غير موجود في قاعدة الهدف.
- **TARGET_404:** 28594 مادة مصنفة 404 (حيًا أو مستنتجة بوضوح من غياب صف الهدف).
- **URL_CONFLICTS:** 2 تعارض ID/section/slug/canonical/HTTP.
- **LEGACY_SITEMAP_INVALID:** 28660 إدخالًا غير صالح في خرائط الموقع الحية، وأبرزها alElm.netundefined.
- **SITEMAP_FETCH_FAILED:** تعذر جلب 1 ملف خريطة أثناء القياس: https://alelm.net/sitemap-videos.xml.
- **LEGACY_SITEMAP_COVERAGE:** خرائط الموقع الحية قدمت 0 رابط مادة صالحًا مقابل 29094 مادة REST.
- **LEGACY_SPECIAL_URLS:** 21 صفحة قسم/وسم/صفحة ثابتة بلا تطابق 200 أو 301 صالح.
- **ARTICLE_PARAM_CANONICAL_GUARD:** يجب تحويل section/slug غير القانونيين دائمًا إلى رابط المادة المحفوظ.
- **SITEMAP_INCLUDES_STORIES:** خريطة الموقع الجديدة يجب أن تضم كل المواد المنشورة، لا الأقسام والسلاسل فقط.
- **REDIRECT_LAYER_PRESENT:** لا توجد طبقة 301 ظاهرة تحسم الاختلاف بالـ ID.

## مصفوفة الأقسام

| القديم | العدد | الجديد | الإجراء | الحالة |
| --- | --- | --- | --- | --- |
| politics | 4567 | politics | PRESERVE | EXACT |
| current-events | 3732 | current-events | PRESERVE | EXACT |
| economy | 2828 | economy | PRESERVE | EXACT |
| varieties | 2727 | varieties | PRESERVE | EXACT |
| health | 2654 | health | PRESERVE | EXACT |
| technology | 2209 | technology | PRESERVE | EXACT |
| sciences | 1888 | sciences | PRESERVE | EXACT |
| world | 1749 | world | PRESERVE | EXACT |
| sport | 1692 | sport | PRESERVE | EXACT |
| infographics | 1690 | infographics | PRESERVE | EXACT |
| ksa | 1208 | ksa | PRESERVE | EXACT |
| business | 1011 | business | PRESERVE | EXACT |
| art | 615 | art | PRESERVE | EXACT |
| culture | 395 | culture | PRESERVE | EXACT |
| uncategorized | 92 | varieties | 301_REQUIRED | MAPPED_WITH_REDIRECT |
| غير-مصنف | 37 | varieties | 301_REQUIRED | MAPPED_WITH_REDIRECT |

## فحص عقود المشروع

| الفحص | النتيجة | الأهمية | التفصيل |
| --- | --- | --- | --- |
| ARTICLE_ROUTE_PRESENT | true | INFO | مسار المادة الديناميكي يقرأ المادة بالمُعرّف. |
| ARTICLE_PARAM_CANONICAL_GUARD | false | BLOCKER | يجب تحويل section/slug غير القانونيين دائمًا إلى رابط المادة المحفوظ. |
| SITEMAP_INCLUDES_STORIES | false | BLOCKER | خريطة الموقع الجديدة يجب أن تضم كل المواد المنشورة، لا الأقسام والسلاسل فقط. |
| REDIRECT_LAYER_PRESENT | false | BLOCKER | لا توجد طبقة 301 ظاهرة تحسم الاختلاف بالـ ID. |
| ARCHIVE_ID_TEXT_PRIMARY_KEY | true | BLOCKER | stories.id مفتاح نصي أساسي وقادر على حفظ ID ووردبريس حرفيًا. |
| STORY_HREF_PRESERVES_TRIPLE | true | BLOCKER | عقد الرابط الجديد section/id/slug. |

## ملاحظات حرجة مكتشفة حيًا

- العدد الحي تغيّر عن جرد 11 أغسطس؛ أرقام الوثيقة لا تصلح كبوابة قطع دون إعادة جرد.
- خريطة الموقع القديمة أعادت 28,660 رابطًا من نوع `https://alelm.netundefined` وقت القياس.
- جُردت 15 وسوم فعالة و16 قسمًا، ووجد الفحص 21 رابط أرشيف/صفحة خاصة غير سليم على الهدف.
- خريطة الموقع الجديدة في الكود لا تُخرج روابط المواد المنشورة.
- مسار المادة الحالي يجلبها بالـ ID، لكنه لا يحول section/slug الخاطئين إلى الرابط القانوني؛ هذا يخلق 200 على بدائل غير قانونية وcanonical متعارضًا.
- 173 مادة تحمل إشارة مخاطرة وسائط؛ ليست كلها قاطع نشر، لكن unresolved/insecure/external تحتاج معالجة في M-3.

## بوابة M-2

لا يتحول القرار إلى READY FOR M2 إلا بعد: تغطية كل ID منشور، تطابق section/slug أو 301 دائم إلى 200، صفر 404، canonical واحد صحيح، خريطة مواد كاملة، وتوثيق الصفحات/الأنماط غير المقالية. لا يتضمن هذا التدقيق أي ترحيل أو DNS أو حذف أو تعديل إنتاجي.

## المخرجات

- `migration-audit/summary.json`
- `migration-audit/url-parity.csv`
- `migration-audit/section-map.csv`
- `migration-audit/url-patterns.csv`
- `migration-audit/redirects-required.csv`
- `migration-audit/missing.csv`
- `migration-audit/conflicts.csv`
- `migration-audit/media-risk.csv`
