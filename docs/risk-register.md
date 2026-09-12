# سجل المخاطر والعوائق

| ID | الحالة | الخطر/العائق | الاحتمال | الأثر | التخفيف | المطلوب |
|---|---|---|---|---|---|---|
| R-15 | MITIGATED IN CODE | فقد مشاهدات GA4 بسبب انتظار حاوية GTM حدث Pageview الذي لا يرسله الموقع | مؤكد في الفحص السابق للإصلاح | مرتفع | إرسال الحدث المطابق للحاوية عند التحميل والتنقل مع منع التكرار وحماية المسارات الحساسة؛ إبقاء قياس History التلقائي معطّلًا | نشر الكود ثم التحقق من طلب واحد لكل مشاهدة في الشبكة وDebugView؛ لا تفسَّر الأرقام المتأثرة كهبوط مؤكد للجمهور |
| R-14 | MITIGATED IN CODE | فقد محاور أساسية في موجز شديد القصر أو غياب مواد بحث بسبب الاقتصار على العنوان | متوسط | متوسط | مجال حتى 500 حرف مع تعليمات تغطية المصدر؛ بحث موحّد للعربية والمحتوى وترتيب بالصلة واختبارات سلوك | مراجعة جودة المخرجات تحريريًا؛ التحقق من تكلفة بناء فهرس 0016 على نسخة إنتاج قبل تطبيقه |
| R-13 | MITIGATED IN CODE | ربط ظهور التثبيت والجدولة بالنشر الفوري يخفيهما عن محرر ممنوع من النشر، أو يدفع إلى منحه صلاحيات أوسع | متوسط | مرتفع | `story.pin` مستقل، والجدولة تتبع `story.schedule` في الواجهة وAPI؛ ترحيل إضافي للدور مع إبقاء الاستثناءات وبوابات الحارس والنشر الفوري | تطبيق `0015_editor_pin_schedule` والتحقق من الصلاحيات الفعلية بعد النشر |
| R-01 | BLOCKED | فقد ترتيب البحث أثناء الهجرة | متوسط | حرج | 1:1 URLs، crawl/diff، قطع مساري، مراقبة GSC | WordPress + GSC access |
| R-02 | BLOCKED | لا يمكن قياس M0 على الموقع الفعلي | مؤكد | مرتفع | حفظ baseline الدراسة، تجهيز بوابة محلية، قياس فور توفير staging | Cloudflare/nginx access |
| R-03 | OPEN | Scope تضخم CMS | متوسط | مرتفع | backlog مقفل وPost Launch منفصل | product governance |
| R-04 | BLOCKED | قواعد Policy Guard بلا مصدر تحريري كامل | مؤكد | حرج | لا اختراع؛ deterministic rules بعد استلام الوثيقة | ملف السياسة الرسمي |
| R-05 | OPEN | إنذارات AI كاذبة أو provider lock-in | متوسط | متوسط | severity، human override audited، provider abstraction، monthly eval | AI/provider decision |
| R-06 | OPEN | اختراق لوحة التحرير | منخفض/متوسط | حرج | RBAC، TOTP، secure sessions، audit، panel isolation | identity architecture |
| R-11 | MITIGATED | تخمين كلمات مرور اللوحة: حظر تكرار محاولات الدخول أُزيل في #111 (5 سبتمبر 2026) «مؤقتًا بطلب الإدارة» وبقي الدخول بلا سقف | مرتفع | حرج | أُعيد الحظر: 10 محاولات للحساب و40 للشبكة كل 15 دقيقة، رمز MFA الخاطئ يُحتسب، الدخول الناجح يصفّر نافذة الحساب فقط، الرفض 429 مع Retry-After، تعطل الحاجز يغلق الدخول (503)، وكل فشل يُدوَّن في سجل التدقيق بلا كلمات مرور. الاختبار: `tests/workflow.integration.mjs` | لا يُزال ثانية إلا بقرار موثّق هنا وبديل مكافئ |
| R-12 | MITIGATED IN CODE | إساءة استخدام استعادة حساب إداري أو إعادة استخدام الرابط | متوسط | حرج | HMAC بسياق مستقل عن الجلسة، صلاحية 15 دقيقة، رد عام، حد معدل مشترك، استهلاك ذري مع إبطال الجلسات والتدقيق، إبقاء MFA وحالة الحساب، منع متتبع GTM وno-referrer/no-store لصفحة الاستعادة | التحقق من وصول البريد عند النشر؛ اختبارات محلية لا تثبت تسليم الإنتاج |
| R-07 | OPEN | تضخم JavaScript من التفاعل | متوسط | مرتفع | RSC أولًا وCI budget 200KB compressed | budget gate |
| R-08 | BLOCKED | عدم تطابق author identities والـSchema | مرتفع | مرتفع | author inventory وربط legacy usernames بملفات حقيقية | editorial directory |
| R-09 | OPEN | OpenNext/Cloudflare adapter regression | منخفض/متوسط | مرتفع | native Next build أولًا، adapter build gate، version pinning، rollback | staging worker |
| R-10 | BLOCKED | لا يمكن اختبار backup/restore أو cutover | مؤكد حاليًا | حرج | rehearsal في staging قبل production | databases/buckets/environments |

لا توجد أسرار في المستودع. لا يوجد نشر Production أو تغيير DNS ضمن العمل الحالي.
