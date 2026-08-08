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

## وثائق التنفيذ

- `docs/master-backlog.md`
- `docs/gap-analysis.md`
- `docs/critical-path.md`
- `docs/risk-register.md`
- `docs/alelm-rebuild-progress.md`

لا تُنفذ الهجرة أو تهيئة Cloudflare أو ربط Production دون صلاحيات وبيانات معتمدة.
