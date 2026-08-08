# المسار الحرج والاعتماديات

## المسار الحرج

1. **صلاحيات القراءة + وثيقة السياسة**: بدونها لا يمكن inventory أو Policy Guard موثوق.
2. **Inventory ثابت للروابط والمحتوى**: يبني خرائط البيانات وعقد API وقاعدة المطابقة.
3. **API contracts + Design System**: يفصلان الواجهة عن WordPress ويمنعان إعادة البناء مرتين.
4. **قوالب الواجهة الأساسية**: Home/Article/Series/Programs/Authors/Search مع SEO.
5. **CMS schema + workflow + RBAC/audit**: شرط إدخال مواد حقيقية بأمان.
6. **Migration rehearsals + automated diff**: شرط القطع دون فقد الأرشيف أو الترتيب.
7. **Edge cutover + rollback drill**: قبل أي تحويل دائم.
8. **Field metrics + GSC + backup/restore + training**: بوابة إطفاء WordPress.

## مسارات يمكن تشغيلها بالتوازي

- M0 security/SEO/performance budgets مع M1 tokens والهوية.
- CMS data modeling مع Frontend API contracts بعد تثبيت inventory.
- Policy Guard deterministic rules مع migration tooling بعد وصول وثيقة السياسة.
- Observability/CI من اليوم الأول، ثم توسعتها مع كل خدمة.

## الاعتماديات الخارجية

- Cloudflare account/domain/WAF/R2.
- WordPress read access، database export، media origin، sitemaps.
- GitHub repository وبيئات Staging/Production.
- editorial policy source ومالك منتج تحريري.
- analytics/email/search/AI providers وprivacy approvals.
