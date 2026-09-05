# معاينات مشاركة العلم

الرئيسية تستخدم بطاقة العلم عبر المسار `/brand/share.jpg` بحجم 1200×630. الأخبار تستخدم صورتها وعنوان SEO والوصف، وتعود إلى بطاقة العلم إن لم يوجد رابط صورة صالح. تُجهز Open Graph وTwitter بعنوان ووصف وصورة متطابقة، مع اسم الموقع واللغة ورابط المشاركة الكامل. الأقسام والسلاسل والكلمات المفتاحية تستخدم بيانات الصفحة وبطاقة العلم.

بعد انتقال الموقع إلى `https://alelm.net`، الأولوية لـ`SHARING_ORIGIN` عند ضبطه، ثم `NEXT_PUBLIC_SITE_URL`، وإلا يستخدم نطاق العلم العام `https://alelm.net`. وجود `RAILWAY_PUBLIC_DOMAIN` لا يغيّر نطاق المشاركة. لمعاينة على نطاق مستقل، اضبط `SHARING_ORIGIN` صراحةً في بيئة المعاينة فقط.

متغيرات الإنتاج:

```dotenv
SHARING_ORIGIN=https://alelm.net
NEXT_PUBLIC_SITE_URL=https://alelm.net
```

يجب ضبط القيم قبل البناء وإعادة النشر لأن بيانات بعض الصفحات تُبنى مسبقًا. `SHARING_ORIGIN` هو التصحيح المباشر لبيانات المشاركة؛ `NEXT_PUBLIC_SITE_URL` يثبت الأصل الاحتياطي ويستخدمه عقد الجوّال أيضًا. لا تغيّر متغير `RAILWAY_PUBLIC_DOMAIN` الذي تديره Railway، ولا تغيّر هذه القيم DNS. يظل أصل Railway محميًا بترويسة `X-Robots-Tag: noindex, nofollow`، وتعلن روابط canonical نطاق العلم.

التحقق: اطلب الصفحة بهوية `WhatsApp` و`facebookexternalhit` و`Twitterbot`، وافحص وجود البيانات داخل `<head>`، ثم اطلب عنوان `og:image` وتأكد من 200 ونوع `image/*`. Next.js يتعرف على هذه الزواحف افتراضيًا؛ لم نلغِ بث الصفحات للمستخدمين. لا يثبت هذا اختبار واجهة واتساب نفسها أو توقيت تحديث معاينة محفوظة لديه.

المراجع: [Open Graph](https://ogp.me/)، [Next.js metadata](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)، [Railway variables](https://docs.railway.com/variables/reference).

فحص قابل لإعادة التشغيل: `node scripts/verify-sharing.mjs https://your-public-site` يفحص الرئيسية وخبرًا فعليًا وقسمًا وفهرس السلاسل وسلسلة، بهويات الزواحف الثلاث؛ ويرفض رابط صورة يعيد HTML حتى لو كانت حالته 200. هذا فحص قراءة فقط.

## تحويلات الأرشيف وNext 16.3.0

الإصدار المثبّت يكرر `Location` عند أول توليد لتحويل ISR؛ قد تجمعه الوسائط في وجهة من نوع `/target, /target` تنتهي إلى 404. يطبّق `postinstall` تصحيحًا محدودًا لقالب إعادة إرسال الترويسات، باستخدام `NodeNextResponse.appendHeader` الذي يمنع تكرار القيمة نفسها ويحفظ القيم المختلفة. لا يتغير مسار المقال أو مخطط القاعدة أو تخزين ISR.

التصحيح في `scripts/patch-next-redirect-headers.mjs` مقيد بالإصدار `16.3.0` ويفشل عند اختلاف الإصدار أو بنية القالب ليُلزم المراجعة عند الترقية. مرجع العطل والإصلاح المقترح: [Next.js #95913](https://github.com/vercel/next.js/pull/95913). يُحذف التصحيح بعد توفر إصدار رسمي يجتاز `node tests/canonical-redirects.integration.mjs` بدونه. الاختبار يشغّل خادم إنتاج ويفحص الترويسات الخام للتحويلين 307 و308 في الطلب الأول، ومن التخزين، وبعد إعادة التوليد؛ وهو جزء من فحص التكامل في CI.
