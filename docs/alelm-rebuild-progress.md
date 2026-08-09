# سجل تنفيذ إعادة بناء العلم

آخر تحديث: 2026-08-09

| Phase | Requirement | Status | Implementation summary | Files changed | Tests / metrics | Risks / blockers | Follow-up |
|---|---|---|---|---|---|---|---|
| M0 | Technical reconnaissance | VERIFIED | المجلد كان فارغًا؛ لا تطبيق أو API أو WP integration أو CI قائم | `docs/gap-analysis.md` | فحص filesystem/Git والمرفقات كاملة | لا وصول للنظام القديم | inventory عند توفير الوصول |
| M0 | Git workflow | VERIFIED | baseline على main وفرع مستقل | Git | branch/log | لا remote | ربط GitHub لاحقًا |
| M0 | Native frontend baseline | VERIFIED | Next 16 App Router + strict TS + OpenNext config | `package.json`, configs | Next build وOpenNext build ناجحان | staging غير متاح | CI integration |
| M0 | Security headers | VERIFIED | CSP/HSTS/MIME/frame/referrer/permissions دون staging/proxy | `next.config.ts` | manifest + HTTP tests ناجحة | nonce CSP لاحقًا | WAF/rate limits |
| M0 | SEO quick fixes | VERIFIED | ar_SA/canonical/Organization/robots/sitemap/OG 1200x630 | `app/*`, `public/og.png` | metadata + dimensions tests ناجحة | author inventory مفقود | NewsArticle/Person في M2 |
| M0 | Home deduplication | VERIFIED | ContentProvider + home-bundle.v1 + dedupe by canonical ID | `lib/content/*`, API route | جميع IDs فريدة في rendered HTML | يحتاج بيانات WP | WordPress adapter |
| M0 | M0 measurement | VERIFIED | CI budget 200KiB وتقارير baseline | `scripts`, `tests`, `docs/metrics` | 172.2KiB gzip؛ PASS | لا RUM/staging | field measurement |
| M0 | Cloudflare/WAF/actual TTFB | BLOCKED | لا تغيير خارجي | - | baseline study only | credentials/domain access | تنفيذ فور الصلاحية |
| M0 | Jaak AlElm | BLOCKED | غير معروض في الواجهة الجديدة لتجنب dead experience | `app/page.tsx` | visual presence absent | content inventory | hide route or populate |
| M1 | Initial RTL visual language | DONE | tokens، RTL، responsive، dark preference، rail للسلاسل | `app/globals.css` | visual QA قيد التنفيذ | ليس Storybook كاملًا | M1 component docs |
| M4 | إيداع وثيقة السياسة التحريرية | VERIFIED | الدستور التحريري مودع في المستودع بمعرفات قواعد ثابتة تطابق الكود؛ يرفع الحاجز الأول في المسار الحرج | `docs/editorial-policy.md` | مراجعة مطابقة للوثيقة الأصلية (مايو 2023) | تعديل الوثيقة يستلزم تعديل القاعدة واختبارها | مراجعة تحريرية لاعتماد الصياغة |
| M4 | M4-T6 Policy Guard rules engine | VERIFIED | 39 قاعدة حتمية (قواميس/أنماط/عدّ) بثلاث شدات، تطبيع عربي، إصلاح آلي، سجل تدقيق، وبوابة منع الاعتماد | `lib/policy/**`, `scripts/policy-check.mjs`, `examples/draft-sample.json` | 24 اختبارًا إيجابيًا وسلبيًا؛ lint وtypecheck نظيفان | لا نموذج لغوي بعد؛ القواعد السياقية تُعلَّم `needsHumanReview` | M4-T7/T8 للطبقة النموذجية والحوكمة |

الحالة `DONE` تعني أن التنفيذ موجود؛ تتحول إلى `VERIFIED` فقط بعد اجتياز جميع بوابات الاختبار ذات الصلة.
