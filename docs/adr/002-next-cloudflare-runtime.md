# ADR-002: Next.js أصلي مع OpenNext على Cloudflare Workers

## Context

الخطة تلزم أحدث Next.js مستقر مناسب وApp Router وRSC، مع Cloudflare كطبقة Edge. المستودع كان فارغًا، وstarter أولي استخدم vinext beta، وهو ليس Next.js الرسمي ولا يطابق قرار الخطة الإنتاجي.

## Decision

استخدام Next.js 16.3.0 المثبت بإصدار محدد، وتكييف Cloudflare عبر `@opennextjs/cloudflare` 1.20.2. التطوير والبناء الأساسيان بأوامر Next الرسمية، وبناء adapter بوابة مستقلة. لا deploy تلقائيًا.

## Alternatives

- vinext beta: preview سريع، لكنه انحراف معماري ومخاطرة إنتاجية غير مبررة.
- استضافة Node تقليدية خلف Cloudflare: ممكن، لكنه يفقد قرب التنفيذ من edge ويضيف تشغيل خادم دائم.

## Consequences

- App Router وRSC وISR تبقى وفق Next الرسمي.
- يجب اختبار `cf:build` في CI ومراقبة توافق adapter.
- R2 incremental cache وproduction bindings مؤجلة حتى اعتماد حساب Cloudflare.
