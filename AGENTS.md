<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# قواعد العمل في مستودع «العلم»

Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind v4 + shadcn (`components/ui`) + Drizzle فوق
`@neondatabase/serverless` (HTTP؛ `db.batch([...])` هي وسيلة المعاملات الوحيدة) + Tiptap 3. لوحة التحرير تعيش في
`app/tahrir` و`components/tahrir` و`lib/tahrir` و`app/api/tahrir`. لغة المنتج عربية: كل نصوص الواجهة عربية،
الأرقام لاتينية (`nu-latn`)، والاتجاه RTL. الخريطة الكاملة للوحة في `docs/tahrir/README.md`.

## البوابة قبل أي PR

```bash
npm run lint && npm run typecheck && npm run build:gate \
  && NEXT_DIST_DIR=.next-gate npm run test:unit \
  && NEXT_DIST_DIR=.next-gate npm run budget
TEST_DATABASE_URL=postgresql://USER@localhost:5432/alelm_test_x npm run test:integration
```

- تُشغَّل **بالتتابع**؛ lint/typecheck بالتوازي مع `build:gate` يعطي أخطاء وهمية في `.next-gate/types`.
- ميزانية JS: الرئيسية 200 KiB gzip ومحرر `/tahrir/editor/[id]` بسقفه في `scripts/check-performance-budget.mjs` — لا تُرفع.
- بعض اختبارات التكامل تحتاج `.next-gate` مبنيًا؛ شغّلها بعد `build:gate`.

## قاعدة البيانات

- **ممنوع `db:push` على أي مضيف غير محلي.** `npm run db:push` يمرّ على `scripts/guard-db-push.mjs` الذي يرفض أي
  `DATABASE_URL` ليس `localhost`/`127.0.0.1`. الإنتاج يُرحَّل بترحيلات مرقّمة في `drizzle/` عبر
  `npm run db:migrate -- --apply` باتصال مباشر (`DATABASE_URL_UNPOOLED`)، انظر `npm run db:push:prod`.
- الترحيلات إضافية ومتكرّرة التنفيذ (`IF NOT EXISTS`)؛ الرقم التالي يُؤخذ من آخر ملف في `drizzle/`.
- الطوابع الزمنية نص ISO بالتوقيت العالمي (`Z`) وتُقارن نصًا؛ العرض بتوقيت الرياض عبر `formatRiyadh*` في `lib/format.ts`.
- `.env.local` قد يحمل قاعدة الإنتاج للبناء فقط؛ اختبارات التكامل على `TEST_DATABASE_URL` محلية معزولة.

## الاختبارات

- المشغّل `node --test tests/*.test.mjs` (لا vitest ولا jest). Node يقرأ TypeScript مباشرة، فالاختبارات تستورد
  ملفات `.ts` بامتدادها.
- **ممنوع اختبارات عقد جديدة تقرأ مصدر المكوّنات** (`assert.match(source, /regex/)`). اكتب اختبار سلوك: دوال نقية،
  هيكل هوكات (نمط `tests/draft-autosave.test.mjs`)، أو تكامل على `TEST_DATABASE_URL` (`tests/workflow.integration.mjs`).
- **كل مسار API جديد أو معدّل يلزمه اختبار سلوك** (تكامل على القاعدة المحلية أو اختبار وحدة للمنطق المستخرج).
- اختبارات العقد القديمة تنكسر عند إعادة الهيكلة؛ حافظ على مقصدها وحدّث موضعها أو حوّلها إلى سلوك — لا تحذف تأكيدًا لتخضير البوابة.

## مسارات API ومكوّنات العميل

- أول سطر في أي مسار جديد: `requireActor`/`requirePermission` من `lib/tahrir/access.ts`، والأخطاء عبر
  `writeError`/`adminErrorResponse`. لا تستورد `db` في مكوّنات العميل.
- طلبات العميل داخل اللوحة عبر `apiCall` من `lib/tahrir/client-api.ts` (JSON، مهلة، رسائل عربية، لا رمي).
  المحرر له نقله الخاص ولا يُمس.

## RTL والأصناف

- في `components/tahrir` و`components/ui` الأصناف الاتجاهية الفيزيائية (`ml- mr- pl- pr- left- right- text-left`) ممنوعة
  إلا عندما تُقرن بـ`data-side`؛ استعمل `ps- pe- ms- me- start- end- text-start`.
- الشجرة ملفوفة بـ`DirectionProvider dir="rtl"`، فلا تمرّر `dir="rtl"` يدويًا لمكوّنات Radix.
- الألوان الدلالية من رموز `.th` (`--t-ok/--t-warn/--t-block/--t-sug` وخلفياتها) لا من أصناف Tailwind الخام
  (`emerald-*`, `amber-*`, `red-*`) حتى تعمل في اللوحات الثماني والوضع الداكن.
- البطاقات فوق الأرضية الداكنة تحتاج `bg-card` صريحة. الحركة تحترم `prefers-reduced-motion` (كتلة عامة في `shadcn.css`).

## فخاخ lint/TS (كلها تُسقط البوابة)

- `react-hooks/set-state-in-effect`: لا `setState` داخل `useEffect`؛ استعمل `useSyncExternalStore` أو معالجات الأحداث.
- `react-hooks/refs`: لا تقرأ `props.x` حين يُمرَّر ref عبر props — مرّر دوال.
- `no-irregular-whitespace`: لا محارف تحكم عربية مخفية داخل regex؛ استعمل `\uXXXX`.
- jsx-a11y: لا `onClick` على `div/span` بلا `role`+`tabIndex`+`onKeyDown`؛ كل زر أيقونة يحتاج `aria-label`.
- أيقونات lucide مخفية عن قارئ الشاشة افتراضيًا؛ ضع `<span className="sr-only">` للنص المقروء.
- `Button asChild` يأخذ ابنًا واحدًا بالضبط. `Card` لا تقبل `asChild`.
- Tiptap: عدّ الكلمات من `onCreate/onUpdate` لا `useEditorState`؛ محتوى `<li>` ملفوف بـ`<p>`.
- `ThemeConfig` مشتق من `DEFAULT_THEME as const` ويحتاج `-readonly`.

## Git وحجم العمل

- رسائل التزام عربية بصيغة conventional: `feat(tahrir): …`، `fix(tahrir): …`، `perf(tahrir): …`، `docs(tahrir): …`.
- PR واحد ≈ ≤20 ملفًا وموضوع واحد؛ الأكبر يُقسَّم. كل PR يحدّث الوثائق ذات الصلة (`docs/tahrir/README.md` للوحة،
  `docs/platform-stabilization.md` للسلوك التشغيلي، `docs/risk-register.md` للمخاطر).
- لا `db:push` ولا نشر ولا دمج من الوكيل؛ الدمج يُطلق النشر على Railway وهو قرار المالك.
