# منصة العلم

إعادة بناء [alelm.net](https://alelm.net) كمنصة إعلام ومعرفة سعودية مملوكة بالكامل —
نظام مخصص بلا ووردبريس، بواجهة «المنشور» وحارس سياسة تحريرية حتمي.

## المكدس

- **الواجهة:** Next.js 16 App Router + React Server Components + TypeScript صارم (React 19).
- **قاعدة البيانات:** Neon Postgres عبر `@neondatabase/serverless` (سائق HTTP متوافق مع
  Cloudflare Workers) + Drizzle ORM. المخطط في `db/schema.ts` (سلاسل + مواد).
- **النشر المستهدف:** Cloudflare Workers عبر OpenNext (`npm run cf:build` / `cf:preview`).
  لا يوجد نشر إنتاجي آلي بعد.
- **التصميم:** «المنشور» — بنتو الرئيسية، موجز العلم، حزام السلاسل الثماني بألوان الطيف،
  «اسأل العلم»، لوح «بالأرقام» — تحت هيدر ثابت بتدرج المداد ولوجوتايب «العلم»
  (Noto Kufi 900)، وخطا Alexandria/Readex Pro، مع وضع داكن محفوظ.

## التشغيل المحلي

```bash
npm install
cp .env.example .env.local   # ثم املأ DATABASE_URL
npm run dev
```

بدون `DATABASE_URL` يعمل الموقع من البذرة المحلية (سقوط آمن). للتحقق من مصدر المحتوى:

```bash
curl -sI localhost:3000/api/content/home | grep -i x-content-source   # db أو seed
curl -s localhost:3000/api/mobile/v1/home | head                      # عقد تطبيق iOS
```

## قاعدة البيانات

```bash
npm run db:push   # مزامنة المخطط إلى Neon
npm run db:seed   # زرع/تحديث upsert — 8 سلاسل و37 مادة من أرشيف alelm.net
```

المزود `lib/content/provider.ts` يقرأ من القاعدة أولًا بكاش 60 ثانية، ويسقط إلى
`lib/content/seed.ts` عند غيابها. الأسرار في `.env.local` فقط — لا تُرفع أبدًا.

## بوابات الجودة

```bash
npm test          # lint + typecheck + بناء معزول + 29 اختبارًا + ميزانية JS
npm run cf:build  # تحقق توافق OpenNext/Workers
```

- **آمنة أثناء التطوير:** البوابة تبني في `.next-gate` عبر `NEXT_DIST_DIR` فلا تمس
  `.next` الذي يستخدمه `next dev` — شغّلهما معًا بلا خوف.
- لتشغيل الاختبارات منفردة: `NEXT_DIST_DIR=.next-gate npm run test:unit` — اختبارات
  العقد تقرأ ناتج البناء، وتشغيلها على مجلد dev يفشل زورًا.
- العقود المفحوصة: `lang="ar" dir="rtl"`، ترويسات الأمان وCSP صارم في الإنتاج،
  تفرد مواد الرئيسية، عدسات السلاسل = 8، حجم HTML، ميزانية 200KiB مضغوطة للرئيسية.

## حارس السياسة التحريرية

الدستور التحريري مودع في [`docs/editorial-policy.md`](docs/editorial-policy.md)، ومنه اشتُق
محرك القواعد في `lib/policy/` — **39 قاعدة حتمية بلا نموذج لغوي**، بثلاث شدات:

| الشدة | الأثر |
|---|---|
| `blocking` | يمنع طلب الاعتماد (مثل «العاهل السعودي»، MBS، العنوان فوق 10 كلمات، صورة بلا حقوق) |
| `warning` | يصل إلى المعتمد البشري ولا يمنع (مثل مصدر خارج القائمة، مناسبة قومية) |
| `suggestion` | إصلاح آلي بنقرة (تحويل الأرقام إلى لاتينية، صيغة التاريخ، اختصار الوحدات والألقاب) |

```bash
npm run policy:check -- examples/draft-sample.json   # تقرير عربي؛ خروج 1 عند مخالفة قاطعة
npm run policy:check -- draft.json --fix             # يطبّق التصحيحات الآلية ويطبع المسودة
npm run policy:check -- draft.json --json            # مخرج JSON للأتمتة وCI
```

القواعد التي تحتاج حكمًا سياقيًا (اللاءات الخمس، خداع العناوين، تطابق الصورة بالاسم)
تُعلَّم `needsHumanReview` فتصل إلى المعتمد بدل أن تمر صامتة.
**الحارس يفحص ولا ينشر — بوابة الاعتماد بشرية دائمًا.**

## بنية المشروع

```
app/                    الصفحات: الرئيسية، [section]/[id]/[slug]، series/، search/
  _components/          الهيدر والفوتر، البطاقات، مستكشف السلاسل، الاستفتاء، الثيم
  api/content/home/     تغذية الرئيسية (مع ترويسة X-Content-Source)
db/ + drizzle.config.ts مخطط Drizzle واتصال Neon
lib/content/            المزود db-first، البذرة، تعريف السلاسل الثماني
lib/policy/             محرك حارس السياسة وقواعده وقواميسه
scripts/                db-seed، policy-check، ميزانية الأداء
tests/                  عقد المنصة + اختبارات الحارس (29)
docs/                   الدستور التحريري ووثائق التنفيذ
ios/                    تطبيق العلم (SwiftUI) — M0 رموز وخطوط وتبويبات
```

## وثائق التنفيذ

- [`docs/master-backlog.md`](docs/master-backlog.md) — سجل الأعمال الرئيسي (M0–M5)
- [`docs/gap-analysis.md`](docs/gap-analysis.md) — تحليل الفجوات
- [`docs/critical-path.md`](docs/critical-path.md) — المسار الحرج
- [`docs/risk-register.md`](docs/risk-register.md) — سجل المخاطر
- [`docs/alelm-rebuild-progress.md`](docs/alelm-rebuild-progress.md) — سجل التقدم
- [`docs/ios/HANDOFF.md`](docs/ios/HANDOFF.md) — حزمة تسليم تطبيق iOS (M0–M6)

> لا تُنفذ الهجرة أو تهيئة Cloudflare أو أي ربط إنتاجي دون صلاحيات وبيانات معتمدة من المالك.
