import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { extractNumbers, unverifiedNumbers, normalizeSlide, validateJakPlan } from "../lib/ai/jak.ts";
import {
  imageGenerationPrompt,
  imageGenerationSize,
  isLandscapeReport,
  projectSlides,
  reportLayoutIssues,
} from "../lib/tahrir/jak.ts";
import { runPolicyGuard } from "../lib/policy/index.ts";
import { editorHref } from "../lib/tahrir/routes.ts";
import { parseInteractionImages } from "../lib/ai/images.ts";
import { DEFAULT_IMAGE_MODEL, normalizeImageModel } from "../lib/ai/image-model.ts";

const SOURCE =
  "ارتفعت مساهمة الاقتصاد الرقمي إلى 15% بنهاية 2025، وبلغت تغطية الجيل الخامس 73% من المدن، " +
  "وتضاعف الاستثمار من 1.2 مليار ريال في 2019 إلى 3.9 مليار في 2026.";

test("استخراج الأرقام يطبّع الهندية واللاتينية والفواصل", () => {
  assert.deepEqual(extractNumbers("بلغت ٧٣% عام 2025 و1,200 وحدة"), ["73", "2025", "1200"]);
});

test("مدقق الأرقام: الموجود في المصدر يمر وغير الموجود يُكشف", () => {
  assert.deepEqual(unverifiedNumbers("تغطية 73% بنهاية 2025", SOURCE), []);
  assert.deepEqual(unverifiedNumbers("قفزة 88% غير مسبوقة", SOURCE), ["88"]);
});

test("الخطة تُسقط شريحة برقم مخترع وتبقي الصادقة — مع سبب الإسقاط", () => {
  const plan = validateJakPlan(
    {
      title: "قفزة الاقتصاد الرقمي",
      excerpt: "خمس سنوات غيّرت الخريطة",
      slides: [
        { type: "stat", stat: "73%", statLabel: "تغطية الجيل الخامس من المدن", sourceContext: "بلغت تغطية الجيل الخامس 73%" },
        { type: "stat", stat: "99%", statLabel: "رقم مخترع لم يرد في المصدر" },
        { type: "text", title: "الرقمنة صارت بنية", body: "مساهمة الاقتصاد الرقمي بلغت 15% بنهاية 2025." },
      ],
    },
    SOURCE,
  );
  assert.equal(plan.slides.length, 2);
  assert.equal(plan.dropped.length, 1);
  assert.match(plan.dropped[0].reason, /99/);
});

test("نوع الشريحة المجهول يُسقط بنيويًا لا يمر", () => {
  const plan = validateJakPlan(
    { slides: [{ type: "megaslide", title: "غريب" }, { type: "fact", title: "حقيقة من المصدر" }] },
    SOURCE,
  );
  assert.equal(plan.slides.length, 1);
  assert.equal(plan.dropped[0].reason, "نوع شريحة غير معروف");
});

test("خطة بلا أي شريحة صالحة ترفض بخطأ واضح", () => {
  assert.throws(() => validateJakPlan({ slides: [{ type: "stat", stat: "500%" }] }, SOURCE), /شريحة صالحة/);
});

test("التطبيع يقص الحقول ويحصر الأنماط ويرمم بيانات الأنواع", () => {
  const slide = normalizeSlide({
    type: "comparison",
    title: "م".repeat(300),
    imageStyle: "neon",
    sides: [{ label: "2019", value: "1.2" }, { label: "2026", value: "3.9" }, { label: "زائد", value: "7" }],
  });
  assert.equal(slide.title.length, 140);
  assert.equal(slide.imageStyle, "real");
  assert.equal(slide.data.sides.length, 2);
});

test("التطبيع يحفظ بيانات التقرير الأفقية المرسلة داخل data", () => {
  const slide = normalizeSlide({
    type: "stat",
    title: "ثروة المؤسسة",
    data: {
      canvas: "landscape",
      template: "stats",
      focalPoint: "left",
      textSafeArea: "right",
      eyebrow: "بالأرقام",
      blocks: [
        { value: "15", label: "مليار دولار", title: "التوقعات", body: "خلال الدورة الحالية" },
        { value: "13", label: "مليار دولار", title: "المستهدف", body: "إجمالي الإيرادات" },
        { value: "2.69", label: "مليار دولار", title: "التسويق", body: "إيرادات متوقعة" },
      ],
    },
  });
  assert.equal(slide.data.canvas, "landscape");
  assert.equal(slide.data.template, "stats");
  assert.equal(slide.data.blocks.length, 3);
  assert.ok(isLandscapeReport([slide]));
  assert.deepEqual(reportLayoutIssues(slide), []);
});

test("مدقق التقرير يرفض رقمًا داخل وحدات القالب لم يرد في المصدر", () => {
  const parsed = {
    slides: [{
      type: "stat",
      title: "لوحة الأرقام",
      canvas: "landscape",
      template: "stats",
      blocks: [
        { value: "73", label: "%", title: "التغطية", body: "من المدن" },
        { value: "999", label: "مليار", title: "رقم غير موثق", body: "غير موجود" },
        { value: "15", label: "%", title: "المساهمة", body: "من الاقتصاد" },
      ],
    }],
  };
  assert.throws(() => validateJakPlan(parsed, SOURCE), /شريحة صالحة/);
});

test("فحص ازدحام التقرير يطلب ثلاث وحدات ويكشف النص الطويل", () => {
  const slide = normalizeSlide({
    type: "list",
    title: "شبكة أفكار",
    data: {
      canvas: "landscape",
      template: "grid",
      blocks: [{ title: "فكرة", body: "ن".repeat(131) }],
    },
  });
  const issues = reportLayoutIssues(slide);
  assert.ok(issues.some((issue) => issue.includes("3 وحدات")));
  assert.ok(issues.some((issue) => issue.includes("130")));
});

test("إسقاط الشرائح نصًا يتجاهل المخفية ويشمل بيانات الأنواع", () => {
  const text = projectSlides([
    { id: "1", type: "stat", title: "", body: "", stat: "73%", statLabel: "تغطية المدن", image: null, imageStyle: null, imagePrompt: "", sourceContext: "", hidden: false, data: null },
    { id: "2", type: "text", title: "مخفية", body: "لا تظهر", stat: "", statLabel: "", image: null, imageStyle: null, imagePrompt: "", sourceContext: "", hidden: true, data: null },
    { id: "3", type: "comparison", title: "المقارنة", body: "", stat: "", statLabel: "", image: null, imageStyle: null, imagePrompt: "", sourceContext: "", hidden: false, data: { sides: [{ label: "2019", value: "1.2" }, { label: "2026", value: "3.9" }] } },
  ]);
  assert.match(text, /73% — تغطية المدن/);
  assert.match(text, /2019: 1.2 مقابل 2026: 3.9/);
  assert.ok(!text.includes("مخفية"));
});

test("السطح البصري يعفي من حد كلمات المتن ولا يعفي من بقية القواعد", () => {
  const short = { title: "عنوان معرفي واضح", body: "متن قصير من شرائح." };
  const asText = runPolicyGuard({ ...short, surface: "text" });
  const asDesign = runPolicyGuard({ ...short, surface: "design" });
  assert.ok(asText.findings.some((finding) => finding.ruleId === "BODY-WORD-RANGE"));
  assert.ok(!asDesign.findings.some((finding) => finding.ruleId === "BODY-WORD-RANGE"));
});

test("حفظ شرائح جاك يستخدم batch المتوافق مع neon-http دون معاملة تفاعلية", async () => {
  const source = await readFile(new URL("../lib/tahrir/jak.ts", import.meta.url), "utf8");
  const replaceSlidesBody = source.slice(source.indexOf("export async function replaceSlides"));
  assert.match(replaceSlidesBody, /await db\.batch\(/);
  assert.doesNotMatch(replaceSlidesBody, /await db\.transaction\(/);
});

test("صور التقرير تُولد كمشاهد غامرة تملأ الإطار بمساحة هادئة للنص", () => {
  const slide = normalizeSlide({
    type: "hero",
    imagePrompt: "Saudi digital economy skyline",
    data: { canvas: "landscape", template: "cover", focalPoint: "left", textSafeArea: "right" },
  });
  assert.equal(imageGenerationSize(slide), "cover");
  assert.match(imageGenerationPrompt(slide), /16:9 cinematic full-bleed/);
  assert.match(imageGenerationPrompt(slide), /full-bleed scene filling the entire frame/);
  assert.match(imageGenerationPrompt(slide), /subject on the left/);
  // الصورة تصير الصفحة، فتُطلب مساحة هادئة في جهة النص لا لوح جانبي
  assert.match(imageGenerationPrompt(slide), /negative space on the right third/);
  assert.match(imageGenerationPrompt(slide), /no embedded text/);
});

test("قالب التقرير يجعل الصورة خلفية الصفحة كاملة والنص فوقها بسكريم اتجاهي", async () => {
  const component = await readFile(new URL("../app/_components/jak-report.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  // الصورة تملأ الصفحة: لا لوح جانبي بعرض محدد
  assert.match(component, /className="jak-report-bg"/);
  assert.match(styles, /\.jak-report-bg \{ object-fit: cover; z-index: 0; \}/);
  assert.doesNotMatch(styles, /\.jak-report-art/);

  // سكريم اتجاهي يضمن تباين النص مهما كانت الصورة فاتحة
  assert.match(component, /className="jak-report-scrim"/);
  assert.match(styles, /\.has-art\.safe-right \.jak-report-scrim/);
  assert.match(styles, /\.has-art\.safe-left \.jak-report-scrim/);

  // الصفحة بلا صورة (أو بصورة فشل تحميلها) تسقط إلى لوح البيانات لا إلى فراغ
  assert.match(component, /hasArt \? "has-art" : "no-art"/);
  // الشكل يُحسم من وجود الصورة لا من اكتمال تحميلها — لا وميض لوح بيانات قبل الترطيب
  assert.match(component, /Boolean\(slide\.image\) && !artFailed/);
  assert.match(component, /onError=\{\(\) => setArtFailed\(true\)\}/);
  assert.doesNotMatch(component, /onLoad=/);
  assert.match(styles, /\.jak-report-page\.kind-data \{/);
  assert.match(styles, /\.jak-report-page\.no-art \.jak-report-bg \{ visibility: hidden; \}/);
});

test("مادة جاك تفتح محرر جاك وبقية المواد تفتح المحرر العام", () => {
  assert.equal(editorHref({ id: "jak-1", format: "jakalelm" }), "/tahrir/jak/jak-1");
  assert.equal(editorHref({ id: "news-1", format: "news" }), "/tahrir/editor/news-1");
});

test("إعداد Imagen القديم يُهاجر إلى نموذج الصور الحالي", () => {
  assert.equal(normalizeImageModel("imagen-3.0-generate-002"), DEFAULT_IMAGE_MODEL);
  assert.equal(normalizeImageModel("imagen-4.0-generate-001"), DEFAULT_IMAGE_MODEL);
  assert.equal(normalizeImageModel("gemini-3.1-flash-lite-image"), "gemini-3.1-flash-lite-image");
});

test("قارئ interactions يستخرج الصورة المختصرة دون تكرارها من الخطوات", () => {
  const images = parseInteractionImages({
    output_image: { data: "abc", mime_type: "image/jpeg" },
    steps: [{ type: "model_output", content: [{ type: "image", data: "abc", mime_type: "image/jpeg" }] }],
  });
  assert.deepEqual(images, [{ base64: "abc", mime: "image/jpeg" }]);
});

test("تباين التقرير مضمون: العناوين بيضاء صراحةً ولا تباعد بين الحروف العربية", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const block = styles.slice(styles.indexOf("جاك العلم — التقرير البصري الأفقي"));

  // القاعدة العامة h1..h4 تفرض لون الحبر الداكن، فاللون الأبيض يجب أن يُكتب صراحةً
  for (const selector of [
    ".jak-report-copy h1",
    ".jak-report-copy h2",
    ".jak-report-dashboard-head h2",
    ".jak-report-block h3",
    ".kind-quote blockquote",
  ]) {
    const rule = block.slice(block.indexOf(selector), block.indexOf(selector) + 200);
    assert.match(rule, /color: #fff/, `${selector} بلا لون أبيض صريح`);
  }

  // العربية تنقطع حروفها مع letter-spacing
  assert.doesNotMatch(block, /letter-spacing/);
});

test("أرقام التقرير تصعد عند ظهور الصفحة والقيمة النهائية في HTML الخادم", async () => {
  const component = await readFile(new URL("../app/_components/jak-report.tsx", import.meta.url), "utf8");
  const motion = await readFile(new URL("../app/_components/jak-report-motion.tsx", import.meta.url), "utf8");

  assert.match(component, /data-countup=\{number\}/);
  assert.match(component, /<StatValue value=\{block\.value\} \/>/);
  assert.match(component, /<StatValue value=\{slide\.stat\} \/>/);
  assert.match(motion, /IntersectionObserver/);
  assert.match(motion, /prefers-reduced-motion/);
  // السنة تصعد من نافذة قصيرة قبلها لا من الصفر
  assert.match(motion, /target >= 1900 && target <= 2100/);
});
