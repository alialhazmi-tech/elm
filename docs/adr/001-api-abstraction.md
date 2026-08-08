# ADR-001: طبقة محتوى محايدة بين الواجهة والمصدر

## Context

WordPress جسر مؤقت، بينما الواجهة يجب ألا تعرف REST fields أو taxonomies الخاصة به. تغيير المصدر إلى «تحرير العلم» يجب ألا يعيد بناء المنتج.

## Decision

تعتمد الواجهة على عقود domain (`ContentProvider`) وbundles مجمعة versioned. أول عقد منفذ هو `home-bundle.v1`. المزود المحلي الحالي fixture للاختبار فقط؛ سيضاف WordPress adapter ثم CMS adapter بالعقد نفسه.

## Alternatives

- استدعاء WordPress مباشرة من المكونات: أسرع مؤقتًا لكنه يثبت coupling مرفوضًا.
- GraphQL موحد الآن: يضيف طبقة وتشغيلًا قبل معرفة inventory؛ يؤجل ما لم تثبت حاجة واضحة.

## Consequences

- اختبار deduplication والسياسات بعيدًا عن المصدر.
- يلزم contract testing لكل adapter.
- أي حقل جديد يمر بإصدار عقد واضح بدل تسريب تفاصيل المصدر.
