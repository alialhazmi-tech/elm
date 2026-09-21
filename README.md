# منصة العلم

منصة عربية لـ [alelm.net](https://alelm.net): موقع عام، ولوحة «تحرير العلم»، وتطبيق iOS.

- **الويب:** Next.js 16 (App Router) + React 19 + TypeScript
- **القاعدة:** Postgres عبر Drizzle (`db/schema.ts` و`drizzle/`)
- **التطبيق:** SwiftUI في `ios/`، هدف النشر iOS 17

## التشغيل المحلي

يتطلب Node.js 22.13 أو أحدث.

```bash
npm install
cp .env.example .env.local
# املأ DATABASE_URL لقاعدة Postgres محلية، أو اتركه فارغًا ليعمل الموقع من البذرة
npm run dev
```

بدون `DATABASE_URL` يعمل الموقع من `lib/content/seed.ts`. المتغيرات المطلوبة للتشغيل الكامل موضحة في `.env.example`.

```bash
npm run db:migrate              # عرض خطة الترحيلات
npm run db:migrate -- --apply   # تطبيقها على القاعدة المحلية فقط
npm run db:seed                 # زرع السلاسل والمواد الأساسية
```

`npm run db:push` يرفض أي مضيف غير localhost.

## التحقق

```bash
npm test
# اختبارات التكامل تحتاج قاعدة معزولة:
TEST_DATABASE_URL=postgresql://USER@localhost:5432/alelm_test npm run test:integration
```

## تطبيق iOS

```bash
open ios/Elm.xcodeproj
```

اختر فريق التوقيع في Xcode، ثم ابنِ على محاكي iOS 17 أو أحدث. ضع معرّف الفريق في `ios/ExportOptions.plist` و`public/.well-known/apple-app-site-association` بدل `TEAMID`. عقد الواجهة في `docs/ios/API_MOBILE_V1.md`.

## حارس السياسة

الدستور في `docs/editorial-policy.md`، والتنفيذ في `lib/policy/`.

```bash
npm run policy:check -- examples/draft-sample.json
```
