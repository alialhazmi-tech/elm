# مساحة «تحرير العلم» داخل تطبيق iOS — 2026-09-10

لوحة التحرير كاملة داخل التطبيق بحسب صلاحيات الحساب، بلا WebView. المدخل من تبويب «حسابي» → «الدخول إلى لوحة
التحرير»؛ تُعرض فوق تبويبات القارئ (`fullScreenCover`) بتبويبات على الآيفون (نظرة اليوم، المواد، مهامي، الوسائط،
المزيد) وبشريط جانبي `NavigationSplitView` على الآيباد. الجلسة كوكي `alelm_tahrir` (12 ساعة) في
`HTTPCookieStorage.shared`؛ لا كلمة مرور تُخزَّن على الجهاز، ويُحفظ اسم المستخدم الأخير فقط.

## الملفات

| الملف | الدور |
|---|---|
| `Services/ElmHTTP.swift` | نقل مشترك: جلسة واحدة تشارك الكوكي، ترويسة `Origin`، `ElmAPIError` بعربية موحّدة تميّز 401/403/409/422/429 |
| `Services/Staff/StaffModels.swift` | نماذج عقود `app/api/tahrir/*` بفكّ متسامح (`decodeIfPresent`) |
| `Services/Staff/StaffAPI.swift` | كل المسارات: الجلسة، القراءة (me/overview/story/tasks/media/taxonomy/audit/stats/schedule/series/history/notifications/team/timeline)، الكتابة (save/submit/publish/schedule/archive/restore/team/presence/media/rights/guard/assist/proposals/visibility/settings/admin) |
| `Services/Staff/StaffSessionStore.swift` | مراحل الجلسة (`signedOut/needsCode/mustChangePassword/mfaRequired/active`)، الاستعادة، الدخول برمز التحقق، الخروج، وانتهاء الجلسة أثناء العمل (`expire`) |
| `Services/Staff/StaffEditorMarkup.swift` | بلوكات قابلة للتحرير ↔ HTML المنقّى (`**غامق**` `*مائل*` `++تسطير++` `~~مشطوب~~` `[نص](رابط)`) |
| `Services/ArticleBlocks.swift` | نموذج البلوكات، محلل HTML محلي مطابق للخادم، و`ArticleBodyView` |
| `Screens/Staff/StaffWorkspace.swift` | الهيكل والتبويبات/الشريط الجانبي، `StaffSection` (المصدر الوحيد للتنقل والصلاحيات)، «المزيد»، الدليل |
| `Screens/Staff/StaffLoginScreen.swift` | الدخول، رمز التحقق، تغيير كلمة المرور المؤقتة، بوابة إلزام MFA |
| `Screens/Staff/StaffOverviewScreen.swift` | نظرة اليوم |
| `Screens/Staff/StaffStoriesScreen.swift` | المواد: تبويبات الحالة، بحث، سلسلة، ترقيم 30/صفحة، مادة جديدة |
| `Screens/Staff/StaffStoryScreen.swift` | صفحة المادة والإجراءات + المعاينة بقارئ التطبيق |
| `Screens/Staff/StaffEditorScreen.swift` | المحرر: عنوان/موجز/متن ببلوكات، التفاصيل، SEO، الحارس الحي، الحفظ التلقائي، الاسترداد المحلي، قفل الإصدار |
| `Screens/Staff/StaffAIPanel.swift` | مساعد الذكاء (عناوين/موجز/تدقيق/تحسين/SEO) |
| `Screens/Staff/StaffMediaScreen.swift` | المكتبة، الرفع، الحقوق، ومنتقي الصورة للمحرر |
| `Screens/Staff/StaffTeamScreens.swift` | الفريق والملاحظات، السجل الزمني، سجل النسخ |
| `Screens/Staff/StaffTasksScreen.swift` · `StaffNotificationsScreen.swift` · `StaffScheduleScreen.swift` | مهامي، التنبيهات (ETag)، الجدولة |
| `Screens/Staff/StaffPlatformScreens.swift` | السلاسل والمقترحات، سجل التدقيق، الإحصاءات، إعدادات النظام والتصنيفات |
| `Screens/Staff/StaffAdminScreens.swift` | الحسابات الإدارية، الأدوار والصلاحيات، ملفي، التحقق بخطوتين |
| `Screens/Staff/StaffComponents.swift` | `StaffFormat` (الرياض، أرقام لاتينية)، الشارات، الصفوف، الحقول، الأزرار، الحالات |

## قواعد العمل المحفوظة

- كل إجراء يحمل `expectedVersion`؛ 409 يظهر كتعارض صريح مع خيارين: «تحميل نسخة الخادم» أو «الاحتفاظ بنسختي» (يعيد جلب
  الإصدار الجديد ثم يحفظ تعديلاتك فوقه بـ`expectedVersion` الجديد) — لا حفظ بلا إصدار (الخادم يرفضه دائمًا).
- مواد «جاك العلم» للقراءة فقط في التطبيق (تُحرَّر شرائحها من الويب)؛ الخادم يحمي متنها وشكلها أيضًا.
- مادة منشورة يعدّلها المعتمد: «تحديث المادة» = حفظ مسودة تعديل ثم نشرها فورًا (كما الويب)؛ و«تحويل إلى مسودة» يسحبها من الموقع.
- الإعادة للمحرر تتبع `capabilities.canReturn` (= `story.approve` ومادة في الاعتماد).
- اقتراحات الذكاء للمتن تُطبَّق على الفقرات فقط (العناوين والقوائم والاقتباسات تبقى)، وحزمة SEO لا تُطبَّق إن لم تجتز الحارس.
- 422 من الحارس تُعرض برسائل المخالفات (`findings[].message`) لا بمعرّفات القواعد فقط.
- الحفظ التلقائي للمسودات فقط كل ثانيتين بعد التوقف عن الكتابة، ويتوقف عند الخطأ حتى ينجح حفظ يدوي.
  نسخة استرداد محلية 7 أيام في `UserDefaults` (`elm.staff.recovery.<id>`) تُعرض عند الفتح إن كانت أحدث من الخادم.
- حفظ مادة منشورة/مجدولة ينشئ مسودة تعديل بمعرّف جديد؛ المحرر يتبنّى المعرّف والإصدار من الرد.
- إخفاء الأقسام بحسب الصلاحية تحسين تجربة؛ الفحص الملزم على الخادم (403 تُعرض كما هي).
- انتهاء الجلسة أثناء العمل (401 من أي مسار أو من `restore()` عند العودة للمقدمة) يُبقي الشاشات ومسوداتها تحت
  شاشة الدخول مع تنبيه، ولا يمسح شيئًا.
- الحضور: نبضة كل 30 ثانية عند فتح المحرر؛ الخروج من المحرر يزيل الحضور.

## التحقق الآلي بلا نقر (DEBUG فقط)

```
xcrun simctl launch --terminate-running-process <sim> net.alelm.app \
  -elmStaffUser admin_ios -elmStaffPass … -elmStaffSection stories -elmStaffStory <id> -elmStaffAction publish
```
الإجراءات: `submit | publish | archive | restore | return | edit | upload | open | keepmine | unpublish`،
و`-elmStaffPanel details|seo|guard` يفتح تبويب المحرر، و`-elmMarkupSelfTest 1` يشغّل فحص جولة الترميز (يطبع PASS/FAIL في السجل)،
و`-elmStaffFresh 1` يمسح الكوكي لتصوير
الدخول، و`-elm.onboarding.v2 1` يتخطى الترحيب على محاكٍ جديد. مع `SIMCTL_CHILD_ELM_API_ORIGIN=http://127.0.0.1:3106`
يعمل كل شيء على القاعدة المحلية المعزولة (انظر `scripts/neon-local-proxy.mjs`).

## فخاخ مثبتة

1. تحديث `version`/`status` من رد الحفظ يحرّك `onChange(of: draft)` فيُعاد الحفظ بلا نهاية — قارن `contentSignature` فقط.
2. لا وصول إلى التحديد النصي في `TextField` بـSwiftUI؛ أزرار «غامق/رابط» تُدرج الرموز في نهاية البلوك.
3. `NavigationLink(value:)` يتطلب `Hashable` على نموذج الصف؛ كل نماذج الصفوف `Hashable`.
4. `let body` داخل `View` يتعارض مع `var body` — استُخدم `bodyText`.
5. الكوكي تبقى بين إطلاقات المحاكي؛ اختبار شاشة الدخول يحتاج `-elmStaffFresh 1`.

## المؤجل

التوليد الشامل المبثوث (NDJSON)، استوديو الإنفوجرافيك، توليد الصور، تحرير شرائح جاك، إعدادات الذكاء، إدارة جمهور القرّاء.
