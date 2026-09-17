# رفع تطبيق العلم إلى TestFlight — 2026-09-17

الحالة: المشروع يُبنى نظيفًا بإعداد Release لجهاز iOS فعلي (Xcode 27، SDK iOS 27) وبإعداد Debug على المحاكي.
ما يلي هو ما جُهِّز في المستودع وما يبقى على المالك في App Store Connect.

## الهوية

| البند | القيمة |
|---|---|
| Bundle ID | `net.alelm.app` |
| الفريق | `CBU7MJEC5R` (Sabq eBusiness Est.) |
| الإصدار / البناء | `MARKETING_VERSION = 1.0.0` · `CURRENT_PROJECT_VERSION = 2` (البناء 1 رُفع سابقًا؛ App Store Connect يرفض تكرار الرقم، فارفع الرقم قبل كل رفع أو مرّر `BUILD_NUMBER`) |
| الحد الأدنى | iOS 17.0، iPhone وiPad |
| الفئة | Magazines & Newspapers |
| التشفير | `ITSAppUsesNonExemptEncryption = NO` (HTTPS فقط) |
| الاتجاه | RTL ثابت، الاسم المعروض «العلم» |

## أصل الإنتاج

منذ نقل النطاق يعيد أصل Railway المباشر `403 الوصول غير مسموح` لكل الطلبات، بينما `https://alelm.net` (خلف Cloudflare)
يخدم `/api/mobile/v1/*` والصور والعضوية. لذلك `URLConstants.productionAPI` صار `https://alelm.net`؛ الأصل القديم بقي
في `ElmLinks.isElmHost` حتى تُفتح روابط المشاركة القديمة أصليًا. التطوير المحلي كما هو عبر `ELM_API_ORIGIN`.

## الأيقونة

`ios/scripts/make-app-icon.py` يولّد ثلاث نسخ 1024×1024 في `AppIcon.appiconset` من الشعار الرسمي (`OfficialLogo`):

- **فاتح**: الكلمة البيضاء على تدرّج كحلي `#1a4282 → #12284b` مع شرطة ذهبية `#cf9a16` (لغة «الطبعة التحريرية»).
- **داكن** (iOS 18+): تدرّج أعمق `#12284b → #0b1322` وذهب `#e0ad2b`.
- **ملوّن** (iOS 18+): الكلمة رمادية على خلفية شفافة؛ النظام يضيف الخلفية والصبغة.

المعاينة بالمقاسات: `docs/ios/screenshots/app-icon-preview.png`. لتغيير التصميم عدّل السكربت وأعد تشغيله (يحتاج Pillow).

## بيان الخصوصية (`PrivacyInfo.xcprivacy`)

- لا تتبّع ولا نطاقات تتبّع.
- واجهات تحتاج سببًا: `UserDefaults` (CA92.1) و**طوابع الملفات** (C617.1) لأن `ImageStore.diskData` يقرأ `modificationDate` لكاش الصور.
- البيانات المجمّعة (مرتبطة بالمستخدم، بغرض وظيفة التطبيق، بلا تتبّع): البريد، الاسم، معرّف المستخدم، بيانات استخدام أخرى
  (إشارات القراءة والإعجابات). يجب أن تطابق بطاقة الخصوصية في App Store Connect هذه القائمة.

## الأرشفة والرفع

```sh
ios/scripts/archive.sh            # أرشفة فقط
ios/scripts/archive.sh --upload   # أرشفة ثم رفع بحسب ios/ExportOptions.plist
```

`ExportOptions.plist`: طريقة `app-store-connect`، وجهة `upload`، توقيع تلقائي، رفع الرموز. بديل ذلك من Xcode:
Product → Archive → Distribute App → TestFlight & App Store.

## ما يبقى على المالك (خارج المستودع)

1. **App Store Connect**: إنشاء سجل التطبيق على `net.alelm.app` (الاسم «العلم»، اللغة الأساسية العربية)، وتعبئة بطاقة الخصوصية
   بما يطابق البيان أعلاه.
2. **الشهادات**: أول أرشفة بتوقيع تلقائي تنشئ شهادة Apple Distribution وملف الاستفراد؛ تحتاج تسجيل Apple ID للفريق في Xcode
   أو مفتاح API (`ASC_KEY_ID/ASC_ISSUER_ID/ASC_KEY_PATH`).
3. **قدرة Associated Domains** على معرّف التطبيق (الاستحقاق `applinks:alelm.net` موجود في `Elm.entitlements`، وملف
   `/.well-known/apple-app-site-association` يُخدم من `alelm.net` بالمعرّف `CBU7MJEC5R.net.alelm.app`).
4. **حساب اختبار** للمراجعين الخارجيين في TestFlight (العضوية على Neon Auth تشترط HTTPS فلا تُختبر إلا ضد الإنتاج).
5. **لقطات الشاشة ووصف المتجر** عند الانتقال من TestFlight الداخلي إلى المراجعة.

## ما لم يُدّعَ

WidgetKit وStoreKit وإشعارات الدفع خارج هذا الإصدار (انظر `HANDOFF.md`). تحذيرات Swift 6 الست (`SendableClosureCaptures`)
في مخازن الصوت والقراءة لا تمنع البناء ولا الرفع.
