# منصة العلم

الأساس التقني لإعادة بناء «العلم» كمنصة إعلام ومعرفة عربية مملوكة بالكامل.

## الحالة الحالية

- المرحلة النشطة: `M0` - الإصلاحات الفورية والأساس القابل للقياس.
- الواجهة: Next.js 16 App Router وReact Server Components وTypeScript صارم.
- النشر المستهدف: Cloudflare Workers عبر OpenNext. لا يوجد نشر إنتاجي آلي.
- مصدر المحتوى الحالي: مزود تطوير محلي خلف عقد `ContentProvider` إلى أن تتوفر قراءة WordPress.

## التشغيل المحلي

```bash
npm install
npm run dev
```

## بوابات الجودة

```bash
npm test
npm run cf:build
```

يتضمن `npm test` فحص الأنواع، lint، البناء، عقود SEO والأمان، منع تكرار مواد الرئيسية، وميزانية JavaScript المضغوط (200KB للصفحة الرئيسية).

> **آمن أثناء التطوير.** `npm test` يبني في `.next-gate` عبر `NEXT_DIST_DIR`، فلا يمس
> `.next` الذي يستخدمه `next dev`. يمكن تشغيل البوابة والخادم معًا دون أن تنكسر الصفحة.

## حارس السياسة التحريرية

الدستور التحريري مودع في [`docs/editorial-policy.md`](docs/editorial-policy.md)، ومنه اشتُق محرك
القواعد في `lib/policy/` — 39 قاعدة حتمية بلا نموذج لغوي، بثلاث شدات:

| الشدة | الأثر |
|---|---|
| `blocking` | يمنع طلب الاعتماد (مثل «العاهل السعودي»، MBS، العنوان فوق 10 كلمات، صورة بلا حقوق) |
| `warning` | يصل إلى المعتمد البشري ولا يمنع (مثل مصدر خارج القائمة، مناسبة قومية) |
| `suggestion` | إصلاح آلي بنقرة (الأرقام العربية-الهندية، علامات التاريخ، اختصار الوحدات والألقاب) |

```bash
npm run policy:check -- examples/draft-sample.json          # تقرير عربي؛ خروج 1 عند مخالفة قاطعة
npm run policy:check -- draft.json --fix                    # يطبّق التصحيحات الآلية ويطبع المسودة
npm run policy:check -- draft.json --json                   # مخرج JSON للأتمتة وCI
```

القواعد التي تحتاج حكمًا سياقيًا (اللاءات الخمس، خداع العناوين، تطابق الصورة بالاسم) تُعلَّم
`needsHumanReview` فتصل إلى المعتمد بدل أن تمر صامتة. **الحارس يفحص ولا ينشر — بوابة الاعتماد بشرية دائمًا.**

## وثائق التنفيذ

- `docs/master-backlog.md`
- `docs/gap-analysis.md`
- `docs/critical-path.md`
- `docs/risk-register.md`
- `docs/alelm-rebuild-progress.md`

لا تُنفذ الهجرة أو تهيئة Cloudflare أو ربط Production دون صلاحيات وبيانات معتمدة.
