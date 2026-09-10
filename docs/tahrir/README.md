# لوحة «تحرير العلم» — اللوحة اليوم

آخر تحديث: 2026-09-09. هذه هي خريطة اللوحة كما هي في `main` بعد الدمجات #71–#148، وتُحدَّث مع كل PR يمسّ اللوحة.
الوثيقة الحاكمة للتصميم وقرارات النقل إلى Shadcn: [`../tahrir-shadcn-kit.md`](../tahrir-shadcn-kit.md). أعراف العمل: [`../../AGENTS.md`](../../AGENTS.md).

## 1. المعمارية — من المسار إلى الطبقة

| المسار (`app/tahrir/(app)/…`) | الشاشة | مكوّنات العميل (`components/tahrir/…`) | المنطق (`lib/tahrir/…` وغيرها) | API (`app/api/tahrir/…`) |
|---|---|---|---|---|
| `/` | نظرة اليوم | `overview/*` (رأس، بلاطات، انتباه، لوحات، صف المادة، الخط الزمني) | `service.ts` (`statusCounts`, `publishedPerDay`, …) | — |
| `/tasks` | مهامي | — (خادمي) | `editorial-team.ts`, `access.ts` | — |
| `/stories` | المواد | `stories/{toolbar,stories-table,story-actions,types}`, `pagination`, `story-timeline` | `service.ts` (`listPageForReview`, `countPage`, `latestArchiveEvents`), `lib/policy` | `story`, `story/archive`, `story/restore`, `story/[id]/timeline` |
| `/editor/[id]` | المحرر (Tiptap) | `editor/*` (editor-client, rich-body, details/seo/guard/ai panels, full-edit, team-panel, …) | `workflow.ts`, `write-policy.ts`, `story-audit.ts`, `lib/ai/editorial.ts`, `lib/policy` | `story`, `story/submit`, `story/publish`, `story/schedule`, `story/history`, `story/[id]/{team,presence,timeline}`, `guard`, `ai/assist`, `media` |
| `/history/[id]` | سجل النسخ | `history-restore` | `workflow.ts` (`restoreStoryVersion`) | `story/history` |
| `/schedule` | الجدولة | `schedule-refresh` | `service.ts`; الحلقة `scripts/scheduler-loop.mjs` | `tick` |
| `/jak`, `/jak/[id]` | جاك العلم (شرائح) | `jak/*`, `select-field` | `jak.ts`, `lib/ai/jak.ts` | `jak/{plan,slide-op,slides}` |
| `/series` | السلاسل والمقترحات | `series/series-client` | `lib/content/series`, `service.ts` | `series/{proposals,visibility}` |
| `/taxonomy` | التصنيفات والأقسام | `taxonomy-client` | `lib/content/taxonomy*` | `taxonomy` |
| `/media` | مكتبة الوسائط | `media/media-client`, `segmented-filter`, `pagination` | `service.ts` (`listMediaPage`, `countMedia`), `lib/storage` | `media`, `media/rights` |
| `/infographics` | استوديو الإنفوجرافيك | `infographic/*` | `lib/ai/infographic*.ts` | `infographic/{generate,generate-images}` |
| `/ai-images` | توليد الصور | `ai/ai-images-client` | `lib/ai/images.ts`, `image-model.ts` | `ai/image` |
| `/ai-settings` | إعدادات الذكاء | `ai/ai-settings-client` | `lib/ai/settings.ts`, `usage.ts`, `pricing.ts` | `ai/settings` |
| `/settings` | إعدادات النظام (بوابات النشر) | `settings/system-settings-client` | `lib/policy/configured.ts` | `settings` |
| `/stats` | الإحصاءات | `overview/bars` | `service.ts` | — |
| `/audit` | سجل التدقيق | `audit-browser` | `audit-data.ts`, `audit-presentation.ts` | — |
| `/members`, `/admin-accounts` | الأعضاء والحسابات الإدارية | `audience-table`, `members/members-client` | `admin.ts`, `lib/membership/admin` | `admin/members/*`, `audience/[id]/status` |
| `/roles` | الأدوار والصلاحيات | `roles/roles-matrix` | `admin.ts`, `permissions.ts` | `admin/roles/*` |
| `/profile`, `/profile/saved` | ملفي الشخصي والمحفوظات | `editor-profile-form`, `saved-stories-list` | `lib/personalization/saved` | `account/{profile,saved}` |
| `/security` | أمان الحساب (كلمة المرور، MFA) | `account/{password-form,mfa-form}` | `mfa.ts`, `totp.ts`, `crypto.ts` | `account/{password,mfa}` |
| `/help` | دليل الاستخدام والجولة | `help-tour` | `editorial-tour.ts` | — |
| `/tahrir/login`, `/tahrir/password` | الدخول وتغيير كلمة المرور المؤقتة | `login-form`, `account/password-form` | `auth.ts`, `rate-limit.ts` | `login`, `logout` |
| `/tahrir/recover` | استعادة كلمة مرور الإدارة والتحرير بالبريد | `recover/recovery-form` | `password-recovery.ts`, `password-recovery-token.ts` | Server Actions في `recover/actions.ts` |

الطبقات المشتركة:

- **الهيكل:** `app/tahrir/layout.tsx` (Tailwind مستقل `shadcn.css`، `ThemeProvider`، `ActiveThemeProvider`، `DirectionProvider dir="rtl"`، `TooltipProvider`، Sonner) ثم `(app)/layout.tsx` (يحلّ الفاعل من القاعدة عند كل طلب، `SidebarProvider`، `AppSidebar` يمينًا، `SiteHeader`).
- **التنقل:** `components/tahrir/nav.ts` هو المصدر الوحيد للمجموعات والفتات وعناوين التبويب (`navGroupsFor`, `isNavActive`, `pageTitleFor`)؛ لوحة الأوامر `command-palette.tsx` (⌘K بـ`event.code`).
- **الوصول:** `lib/tahrir/access.ts` (`loadActor`, `requireActor`, `requirePermission`) يقرأ الجلسة من كوكي `alelm_tahrir` (`crypto.ts`) ويحلّ الدور والاستثناءات من القاعدة؛ التعليق وتغيير الدور يسريان على الطلب التالي.
- **النقل من المتصفح:** `lib/tahrir/client-api.ts` (`apiCall`) لكل مكوّنات اللوحة عدا المحرر (بثّ NDJSON وقفل الإصدار في `editor-client.tsx`).
- **العرض المشترك:** `badges.tsx` (الحارس/الحالة/السلسلة برموز `--t-*`)، `pagination.tsx`، `segmented-filter.tsx`، `select-field.tsx`، `lib/format.ts` (`formatRiyadh*`, أرقام لاتينية دائمًا).
- **القاعدة:** Drizzle فوق `@neondatabase/serverless` (HTTP)، الجداول في `db/schema.ts`، الترحيلات المرقّمة في `drizzle/` تُطبَّق بـ`scripts/migrate-db.mjs --apply` (لا `db:push` خارج localhost).

## 2. الأدوار وكتالوج الصلاحيات

الكتالوج في الشيفرة (`lib/tahrir/permissions.ts`: ماذا يمكن فعله) والتوزيع في القاعدة (`roles`, `role_permissions`, `user_permissions`: من يملك ماذا). الصلاحية الشاملة `*` لمسؤول النظام وحده ولا تُستثنى. الاستثناءات الفردية (`allow`/`deny`) تُطبَّق فوق الدور بـ`resolvePermissions`.

| المجموعة | المفاتيح |
|---|---|
| المواد | `story.create`, `story.edit.own`, `story.edit.any`, `story.submit`, `story.approve`, `story.publish`, `story.schedule`, `story.archive`, `story.restore` |
| المحتوى | `jak.manage`, `series.propose`, `series.decide`, `series.visibility`, `media.upload`, `media.rights` |
| الذكاء الاصطناعي | `ai.assist`, `ai.image`, `ai.infographic`, `ai.settings` (تشمل إعدادات النظام وبوابات النشر) |
| المنصة | `stats.view`, `audit.view` |
| الإدارة | `users.view`, `users.manage`, `users.suspend`, `roles.manage` |

الأدوار النظامية الأربعة (لا تُحذف، تُزرع مرة ثم تُحرَّر من المصفوفة):

| الدور | المعرّف | الافتراضي |
|---|---|---|
| مسؤول النظام | `admin` | `*` |
| رئيس التحرير | `chief` | كل شيء عدا `users.manage`, `users.suspend`, `roles.manage` |
| مدير التحرير | `managing_editor` | الإنشاء والتحرير الكامل والاعتماد والنشر والجدولة والأرشفة، جاك العلم، الوسائط وحقوقها، أدوات الذكاء، الإحصاءات والتدقيق |
| محرر | `editor` | الإنشاء وتحرير موادّه والرفع للاعتماد، جاك العلم، اقتراح سلسلة، رفع الوسائط، أدوات الذكاء، الإحصاءات |

الدور القديم `approver` يُحوَّل إلى `managing_editor` (`LEGACY_ROLE_MAP`). إخفاء بنود التنقل بحسب الصلاحية تحسين تجربة فقط؛ الفحص الملزم في كل مسار API.

## 3. دورة حياة المادة

```
draft ──(story.submit)──▶ review ──(story.approve + الحارس)──▶ published
  ▲                          │                                   │
  │        (إعادة بسبب)◀─────┘        (story.schedule)──▶ scheduled ──(tick)──▶ published
  │                                                                │
  └────────────(story.restore: «استعادة كمسودة»)──── archived ◀────┘ (story.archive بسبب إلزامي)
```

- **الحالات** (`lib/tahrir/service.ts`): `draft`, `review`, `scheduled`, `published`, `archived`. النشطة الأربع تُعدّ في الشريط الجانبي؛ المؤرشفة تبويب مستقل بسبب وتاريخ ومنفّذ.
- **الحفظ وقفل الإصدار:** كل حفظ/تقديم/اعتماد/جدولة يحمل `expectedVersion`؛ التعارض يعيد 409 ويُبقي التعديل المحلي (`workflow.ts` → `lockStory`). الحفظ التلقائي للمسودات من المتصفح (`use-draft-autosave.ts`) مع نسخة استرداد محلية 7 أيام (`use-draft-recovery.ts`).
- **مسودات التعديل (revisions):** حفظ مادة منشورة، أو مجدولة دون صلاحية الجدولة، ينشئ مسودة تعديل مستقلة (`revision_of`)؛ النص العام لا يتغير حتى الاعتماد. اعتماد التعديل يأخذ لقطة نسخة سابقة (`snapshotQuery`) ثم يدمج.
- **تعديل المجدول:** يُملأ الموعد المحفوظ بتوقيت الرياض عند فتح المحرر. زر «حفظ التعديلات» لمن يملك `story.schedule` يحدّث الخبر نفسه مع إبقاء الموعد كاملًا؛ «تعديل الموعد» يحدّث المحتوى والموعد معًا. المساران يدويان عبر `story` باستخدام `updateScheduled` و`rescheduleAt` الاختياري، مع فحص الحارس والصلاحية وقفل النسخة ولقطة قبل التعديل وتدقيق `scheduled:update` في معاملة واحدة. إذا نشر المجدول الخبر أثناء التحرير يُرفض التحديث القديم؛ لا يُعاد إلى الجدولة تلقائيًا.
- **سجل النسخ:** `/tahrir/history/[id]` يعرض النسخ ويستعيد نسخة كمسودة جديدة (`restoreStoryVersion`). يبدأ السجل من تفعيل الترحيل ولا يسترجع تاريخًا لم يُسجَّل.
- **إجراءات المجدول:** لا يظهر «اعتماد ونشر» أو «إرسال للاعتماد» في محرر المادة المجدولة؛ يحفظ المعتمد المحتوى عبر «حفظ التعديلات» ويغيّر وقت النشر عبر «تعديل الموعد» في التفاصيل.
- **بوابات الحارس:** `lib/policy` (محرك قواعد حتمي من الدستور التحريري) يفحص العنوان والمتن ومخرجات الذكاء؛ المخالفة القاطعة تمنع الإرسال/الجدولة/النشر من الخادم عندما تكون بوابة «حارس السياسة التحريرية» مفعّلة، وبوابة «اشتراط توثيق حقوق الصورة» مستقلة عنها (`/tahrir/settings`). الحارس الحي في المحرر يعمل كل 600ms ويعرض «انتقل للموضع».
- **الجدولة:** لا نشر عند فتح اللوحة. `POST /api/tahrir/tick` بسر `CRON_SECRET` ينشر المستحق؛ `scripts/start-server.mjs` يشغّل حلقة داخلية كل 5 ثوانٍ في الإنتاج (`ALELM_SCHEDULER_INTERVAL_MS`)، ويمكن تشغيلها خارجيًا. الإصدار المتعارض يعود للمراجعة ويخرج من الطابور.
- **التدقيق:** كل إجراء يُسجَّل باسم المنفّذ ووقته (`story-audit.ts`) ويُقرأ من `/tahrir/audit` ومن «السجل الزمني» لكل مادة (`story-timeline.ts`) بتفاصيل قبل/بعد.

## 4. فريق التحرير

- **مهامي:** موادّي والمسندة إليّ في المسودة/المراجعة/الجدولة، الأقدم في موعد التسليم أولًا.
- **الإسناد وموعد التسليم:** من داخل المادة بعد حفظها (`story.edit.any`)؛ الإسناد يمنح تحرير هذه المادة لمن يملك `story.edit.own`.
- **ملاحظات المراجعة والإعادة:** آخر 50 ملاحظة على أصل المادة؛ الإعادة تتطلب `story.approve` وسببًا واضحًا وتعيد المادة `draft` مع رفع الإصدار.
- **التنبيهات الداخلية** (`notifications.tsx`) للمؤلف والمسؤول؛ لا بريد.
- **حضور المحررين:** نبض كل 30 ثانية وانتهاء بعد 75 ثانية؛ تنبيه إرشادي، وقفل الإصدار هو الحماية الملزمة.
- **الجولة التعريفية:** ست خطوات بحسب الصلاحيات (`editorial-tour.ts`)، لا تنشئ ولا تنشر.
التفاصيل والتحقق: [`editorial-onboarding.md`](editorial-onboarding.md).

### واجهات القراءة للتطبيق (2026-09-10)

مسارات GET رقيقة تعيد بيانات الشاشات نفسها للتطبيق الأصلي — المنطق في `lib/tahrir/app-read.ts`، البوابة أول سطر، وكل رد `Cache-Control: private, no-store`. العقد الكامل بأمثلة JSON في [`../ios/API_MOBILE_V1.md`](../ios/API_MOBILE_V1.md) (قسم 2026-09-10)، والاختبار `tests/mobile-tahrir.integration.mjs`.

| المسار | البوابة | يقابل الشاشة |
|---|---|---|
| `GET /api/tahrir/me` | `requireActor` (تُقبل كلمة المرور المؤقتة وغياب MFA) | الهوية والصلاحيات + بوابتا النشر |
| `GET /api/tahrir/overview` | `requireActor` | نظرة اليوم |
| `GET /api/tahrir/story?status=&p=&q=&series=` | `requireActor` | المواد (30/صفحة) |
| `GET /api/tahrir/story/[id]` | `requireActor` + `canEditStory` (403) | المحرر (قراءة فقط) |
| `GET /api/tahrir/tasks?filter=&page=` | `requireActor` | مهامي |
| `GET /api/tahrir/taxonomy` | `requireActor` (`visibility` لمن يملك `ai.settings`) | التصنيفات |
| `GET /api/tahrir/media?f=&p=&q=` | `media.upload` | الوسائط (24/صفحة) |
| `GET /api/tahrir/audit?limit=` | `audit.view` | سجل التدقيق |
| `GET /api/tahrir/stats` | `stats.view` | الإحصاءات |
| `GET /api/tahrir/schedule` | `story.schedule` | الجدولة |
| `GET /api/tahrir/series` | `requireActor` | السلاسل والمقترحات |
| `GET /api/tahrir/story/history?id=` | `requireActor` + `canEditStory` | سجل النسخ |

## 5. الوسائط

مرقّمة على الخادم (24 لكل صفحة، `listMediaPage` + `countMedia`)، مرشّح الحقوق (`all/ok/pending`) والبحث والصفحة في الاستعلام. الرفع حتى 8MB (PNG/JPEG/WebP) إلى مسار UUID في S3، والحقوق تُوثَّق أو تُسحب بـ`media.rights`؛ بوابة «اشتراط توثيق الحقوق» تمنع نشر مادة بصورة غير موثقة. الشاشات التي تحتاج مصغّرات فقط تستدعي `listRecentMedia` بحدّ 6–8.

## 6. أدوات الذكاء

- **المزوّد:** `lib/ai/provider-config.ts` (OpenRouter عند وجود المفتاح، وإلا Anthropic/Gemini مباشرة)؛ النماذج الأربعة (`editorial`, `light`, `fast`, `image`) من `/tahrir/ai-settings` مع نبرة العلم فوق الدستور.
- **في المحرر:** اقتراح العناوين، «قبل القراءة»، تحسين الفقرات، التدقيق، التصنيف، SEO والكلمات المفتاحية، التوليد الشامل المبثوث (NDJSON)، توليد الملحقات — كلها تمر على الحارس قبل العرض.
- **جاك العلم:** خطة شرائح من التقرير + عمليات الشريحة الواحدة بمدقق أرقام صارم.
- **الإنفوجرافيك والصور:** استوديو تفاعلي (تضمين iframe) وتوليد صور بثلاثة أنماط.
- **الكلفة:** حجز ذري قبل الطلب ثم تسوية (`lib/ai/usage.ts`)؛ سقوف يومية/شهرية من الإعدادات.

## 7. الإعدادات والمنصة

- `/tahrir/settings`: بوابتا النشر (الحارس، حقوق الصور) — تُفرضان من الخادم في الإرسال والجدولة والنشر.
- `/tahrir/taxonomy`: إظهار/إخفاء الأقسام والسلاسل من القوائم والتوليد.
- **المظهر:** ثماني لوحات + «هوية العلم» افتراضية، الوضع الداكن بمفتاح `alelm-theme` المشترك مع الموقع، كوكيز `tahrir_theme_*` تُقرأ على الخادم.
- **ألوان المحرر:** `app/tahrir/editor-colors.css` يفصل ورقة الكتابة والحقول عن أرضية العمل، ويجمع إعدادات التفاصيل في أقسام بخلفيات هادئة وعناوين موحّدة وحدود محايدة خفيفة، دون خطوط زخرفية ملوّنة. الحفظ كحلي، الإرسال أزرق، والاعتماد بلون الهوية؛ التبويب النشط مداد، والمسار النشط في التنقل بلون اللوحة الأساسي. الحالات والأخطاء والتركيز تعتمد الرموز الدلالية في الوضعين وجميع اللوحات. الألوان لا تغيّر الحفظ أو الصلاحيات أو بوابات النشر.
- **الأمان:** جلسات موقّعة بإصدار (`sessionVersion` يُبطل الجلسات عند تغيير كلمة المرور/التعليق)، MFA اختياري TOTP بسر مشفّر AES-GCM (`TAHRIR_MFA_KEY`)، حدّ معدل في `rate-limit.ts` (انظر R-11 في [`../risk-register.md`](../risk-register.md)).
- **نسيان كلمة مرور الإدارة:** `/tahrir/login` يربط إلى `/tahrir/recover`. الإرسال يستخدم `ACCOUNT_EMAIL_ENABLED=true` و`RESEND_API_KEY` و`AUTH_SECRET` بطول 32 محرفًا على الأقل، إلى بريد الحساب المخزّن فقط. الرد عام للحساب الموجود وغير الموجود والمعلّق، والعمل بعد الرد يمنع كشف الحساب من زمن الإرسال. سقف الطلب 3 للحساب و20 للشبكة خلال 15 دقيقة، وسقف الاستهلاك 10 للرابط و20 للشبكة. الرابط صالح 15 دقيقة ومربوط بهوية الحساب وتجزئة كلمته ونسخة الجلسة؛ الاستهلاك يحدّث الكلمة ويزيد نسخة الجلسة ويكتب `users:recover-password` ذريًا. لا يتغير الدور أو التعليق أو MFA، ولا يصدر الرابط جلسة دخول. هذه آلية مستقلة عن Neon Auth للقرّاء ولا تحتاج ترحيل قاعدة. الحساب الذي لا يملك بريدًا صالحًا يحتاج مسؤولًا مخوّلًا. الاختبارات: `staff-recovery.test.mjs` و`staff-recovery.integration.mjs`.

## 8. ما وصل بين #71 و#148

| PR | الفرع | الخلاصة |
|---|---|---|
| #71 | feat/tahrir-rbac | نظام الأدوار والصلاحيات: كتالوج 25 صلاحية وتوزيع في القاعدة ومصفوفة قابلة للتحرير. |
| #72 | feat/tahrir-card-contrast | تباين البطاقات: `bg-card` بإطار وظل بدل `bg-muted/40`. |
| #73 | feat/tahrir-members-roles-ui | ترتيب شاشتي الأعضاء والصلاحيات وسويتش التعليق وأزرار الإجراءات. |
| #74 | feat/tahrir-overview-stats-panels | لوحات المسودات والجدولة وتوزيع الأشكال وأعلى الكُتّاب في النظرة والإحصاءات. |
| #75 | chore/wp-sync-2026-09-02 | تقارير المزامنة التزايدية من ووردبريس (بلا كود). |
| #76 | feat/video-stories | مواد الفيديو: رابط يوتيوب من الموقع القديم ومشغّل مضمّن. |
| #77 | feat/video-stories | مواد الفيديو + تنعيم كروت الأقسام في الرئيسية. |
| #78 | feat/home-hero-brief-softness | الرئيسية: تنعيم الصدارة وموجز العلم الصوتي والسلاسل. |
| #79 | feat/tahrir-overview-redesign | إعادة توزيع «نظرة اليوم» على مكوّنات `overview/*` المشتركة. |
| #80 | fix/motion-craft-pass | تمريرة إتقان الحركة على الواجهة العامة والإنفوجرافيك. |
| #81 | feat/restore-mustajid-home | الرئيسية: استعادة التصميم السابق وشريط «مستجد». |
| #82 | feat/restore-mustajid-home | الرئيسية: أرضية مصبوغة تكسر البياض التام. |
| #83 | feat/calm-editorial-home | الرئيسية: أسئلة دوّارة وموجات صوت وارتفاع ناعم. |
| #84 | codex/homepage-visual-hierarchy | الرئيسية: تنظيم الهرمية والألوان. |
| #85 | feat/home-soft-v3 | الرئيسية الناعمة v3: اللون هو السلسلة والمسطرة على الجوال. |
| #86 | codex/tahrir-video-system-controls | إظهار مواد «مرئي» ومفتاح الفيديو وحقل الرابط في المحرر. |
| #87 | codex/home-neutral-lead-dividers | تهدئة ألوان الرئيسية وإزالة سؤال الأسبوع. |
| #88 | codex/footer-info-pages-headline-font | صفحات التعريف في الفوتر واعتماد Alexandria للعناوين. |
| #89 | codex/rotating-news-strip-footer-copy | شريط الأخبار الدوّار ونصوص الفوتر. |
| #90 | feat/color-harmony | تنسيق الألوان: كحلي أهدأ وطيف معدني للسلاسل. |
| #91 | feat/warm-paper-and-logo-fix | خلفية الورق الدافئ وضبط أبعاد اللوقو. |
| #92 | codex/platform-stabilization | تثبيت النشر: مسودات التعديل، قفل الإصدار، سجل النسخ، الجدولة بمفتاح، MFA، حجز كلفة الذكاء، OpenRouter. |
| #93 | codex/missing-article-page | صفحة «المادة غير موجودة» و404 بالعربية. |
| #94 | codex/fix-public-story-read | إصلاح 404 كاذب للمواد المنشورة بعد مخطط سير العمل. |
| #95 | codex/share-preview-metadata | بيانات المعاينة وصور المشاركة بالهوية. |
| #96 | codex/share-origin-fallback | نطاق المشاركة الاحتياطي أثناء نقل الدومين. |
| #97 | codex/batched-dashboard-fixes | جاهزية قاعدة اللوحة وصور المشاركة بأبعادها. |
| #98 | codex/footer-social-links | تخطيط السلاسل على الجوال وروابط الفوتر. |
| #99 | codex/google-tag-manager | تثبيت GTM ولوقو شفاف في الهيدر. |
| #100 | codex/article-insights-mobile-theme | مؤشرات القراءة لكل الزوار وتسريع اللوحة والوضع الليلي على الجوال. |
| #101 | codex/reading-proxy-origin | تسجيل القراءة خلف وسيط Railway (ثقة العناوين). |
| #102 | codex/member-profile-public-cache | عضوية القرّاء عبر Neon Auth والكاش مع تحديث المحتوى بعد النشر. |
| #103 | codex/profiles-audience-admin | توحيد صور الملفات وإدارة الجمهور والحسابات الإدارية. |
| #104 | codex/profile-field-alignment | رسائل العضوية العربية وتحسين الملف والتنقل. |
| #105 | codex/admin-account-role-order | تفاعلات المقال العامة وترتيب تنقل الإدارة. |
| #106 | codex/admin-password-guidance | توضيح حد 10 خانات في تغيير كلمة المرور الإدارية. |
| #107 | codex/admin-article-saving | حفظ المواد للحسابات الإدارية ومحفوظاتها. |
| #108 | codex/editor-field-generation | إصلاح حجز التوليد الذكي والحفظ التلقائي وملحقات المادة. |
| #109 | codex/editor-ai-response-errors | رسائل فشل توليد الملحقات في Safari. |
| #110 | codex/editor-video-posts-and-fields | فيديو التغريدة وتضمينها في المتن وتحسين حقول المحرر. |
| #111 | codex/temporarily-remove-login-lockout | إزالة مؤقتة لقفل الدخول بعد المحاولات الفاشلة (خطر مفتوح R-11). |
| #112 | codex/case-insensitive-usernames | دخول غير حساس لحالة الأحرف وتفرّد اسم المستخدم. |
| #113 | codex/restore-editor-share-link | إعادة «رابط المحرر للزملاء» وزر نسخه. |
| #114 | codex/activate-publishing-scheduler | تفعيل النشر المجدول تلقائيًا في الإنتاج (حلقة loopback مصادَقة). |
| #115 | codex/humain-summary-audio | الاستماع للموجز بصوت HUMAIN مع كاش للصوت. |
| #116 | codex/professional-editorial-summaries | تحسين الموجز ومشغّل الصوت وتثبيت أدوات تحرير النص. |
| #117 | codex/restore-matha-baad-series | إظهار «ماذا بعد» وتحرير الروابط وتحسين النشرة الصوتية. |
| #118 | codex/header-mobile-navigation | توحيد الهيدر والفوتر وتحسين تنقل الجوال. |
| #119 | codex/neon-performance-20260905 | أداء Neon: بحث العناوين وصيانة الجداول. |
| #120 | codex/fix-public-sharing-legacy-redirects | نطاق المشاركة العام وتحويلات الروابط القديمة. |
| #121 | codex/restore-social-short-links | استعادة الروابط القصيرة المنشورة على X. |
| #122 | codex/image-display-and-discovery | أحجام الصور وتسليمها ومعاينات Google. |
| #123 | codex/legacy-numeric-urls | استعادة الروابط الرقمية المفهرسة في Google. |
| #124 | codex/compact-article-header | استعادة الصدارة وتقليص رأس المقال. |
| #125 | codex/fix-avatar-upload-delay | تسريع رفع صورة الملف ومعالجة أخطاء المهلة. |
| #126 | codex/fix-x-sharing-cards | بطاقات X للمقالات وإزالة هوامش الصور. |
| #127 | codex/fix-x-image-cache-paths | أسماء ملفات مُصدَّرة لصور بطاقات X. |
| #128 | codex/share-card-pages | مسارات مشاركة بإصدار لبطاقات X. |
| #129 | codex/full-article-summary | إظهار الملخص التحريري كاملًا تحت العنوان. |
| #130 | codex/profile-design-verification-alert | مقروئية الملف وإبراز توثيق البريد. |
| #131 | codex/account-logout | زر الخروج بالأحمر في قائمة الحساب. |
| #132 | codex/search-navigation-performance | تسريع البحث العربي وقياس توقيت التنقل من المتصفح. |
| #133 | codex/home-brief-pronunciation | تشكيل «الخَبَر» في الموجز الصوتي. |
| #134 | codex/home-brief-intro-wording | صياغة مقدمة الموجز الصوتي. |
| #135 | codex/reader-summary-three-points | ملخص القارئ في ثلاث نقاط مرقّمة. |
| #136 | codex/ghabouq-audio-logo | حلقات الغبوق الصوتية وغلاف البودكاست. |
| #137 | codex/instagram-video-and-today-order | فيديوهات إنستقرام وترتيب جدول اليوم بالأحدث أولًا. |
| #138 | codex/fix-editor-image-upload | إعادة محاولة رفع الصور في المحرر ومؤشر التقدم. |
| #139 | codex/ghabouq-missing-episodes | إضافة حلقتين إلى صوتيات الغبوق. |
| #140 | codex/reader-sharing-title | عنوان القارئ في مشاركة المقال. |
| #141 | codex/search-console-indexing | استعادة اكتشاف المقالات القديمة وخريطة الفيديو. |
| #142 | codex/editorial-team-onboarding | تعاون المحررين: مهامي، الإسناد، الملاحظات، الحضور، الجولة. |
| #143 | codex/assignment-feedback | تأكيد نجاح الإسناد وإبراز تنبيهات المهام. |
| #144 | codex/story-timeline | السجل الزمني التفصيلي للمادة (لوحة جانبية). |
| #145 | codex/story-timeline-list | فتح السجل الزمني من قائمة المواد. |
| #146 | codex/article-publication-timestamps | تاريخ ووقت النشر وآخر تحديث في تفاصيل المادة. |
| #147 | codex/editorial-generation-taxonomy | إصلاح موجز التوليد (280 حرفًا) واستعادة النماذج المباشرة وإدارة ظهور التصنيفات. |
| #148 | codex/editorial-summary-model-quality | نموذج التحرير لكل موجز وحفظ عدّاد المصادر. |

## 9. أعراف الواجهة (ملخص)

- RTL منطقي (`ps-/pe-/ms-/me-/start-/end-`)، `DirectionProvider` في الغلاف، الألواح الجانبية تُفتح يسارًا (الشريط يمين).
- الألوان الدلالية من `--t-ok/--t-warn/--t-block/--t-sug` وخلفياتها؛ لا `emerald/amber/red` خامًا.
- الجداول على الجوال: الأعمدة الثانوية تختفي تحت `md:` وتظهر شارات تحت العنوان، وأزرار الصف 36px، وحاويات `overflow-x-auto` بتلاشٍ عند الحافة (`scroll-fade-x`).
- الأرقام لاتينية دائمًا؛ التواريخ بتوقيت الرياض عبر `formatRiyadh*`.
- الحركة تحترم `prefers-reduced-motion` (كتلة عامة في `shadcn.css`).

### تصحيحات 2026-09-10 (مراجعة التطبيق)

- `POST /api/tahrir/story` يحمي مواد «جاك العلم»: لمادة قائمة بشكل `jakalelm` يُتجاهل `body` القادم من أي عميل ويُثبَّت
  الشكل (الشرائح مصدر الإسقاط عبر `jak/slides`)، وتحويل مادة قائمة إلى `jakalelm` يرد 409.
- `GET /api/tahrir/story/[id]` يعيد `capabilities.canReturn` (= `story.approve` ومادة في الاعتماد) — الإعادة للمحرر لا تتبع `story.publish`.
- `GET /api/tahrir/taxonomy` لا يعرض `jakalelm` ضمن `formats` (يُنشأ من محرره فقط)، و`GET /api/tahrir/series` يعيد `archived` و`count` لكل صف.
