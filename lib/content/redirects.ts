/**
 * طبقة تحويلات 301 للروابط القديمة — شرط بقاء الأرشيف والفهرسة (M-2).
 *
 * المصدر: migration-audit/redirects-required.csv من تدقيق التطابق. أرشيفات الوسوم
 * القديمة /tag/... تتحول إلى صفحات السلاسل، وقسما «غير مصنف» إلى منوعات.
 * أما المواد بقسم/سلاج خاطئ فيحسمها حارس canonical بالمعرّف داخل مسار المقال نفسه.
 *
 * وحدة نقية بلا اعتماديات: يقرؤها next.config.ts وتختبرها بوابة node:test مباشرة.
 */

export type LegacyRedirect = {
  source: string;
  destination: string;
  permanent: true;
};

const redirect = (source: string, destination: string): LegacyRedirect => ({
  source,
  destination,
  permanent: true,
});

/** وسم السلسلة القديم (بصيغتي الشرطة والشرطة السفلية) → صفحة السلسلة. */
export const TAG_TO_SERIES: Record<string, string> = {
  "أبسط": "absat",
  "أغرب": "aghrab",
  "افهمها-صح": "efhamha-sah",
  "افهمها_صح": "efhamha-sah",
  "بالأرقام": "bel-arqam",
  "بالتاريخ": "bel-tarikh",
  "شخصيات": "shakhsiat",
  "لماذا": "limatha",
  "ماذا-لو": "matha-law",
  "ماذا_لو": "matha-law",
  "قالوا": "qalu",
  "تقارير": "taqarir",
  "موثق": "muwaththaq",
  "ماذا-بعد": "matha-baad",
  "ماذا_بعد": "matha-baad",
  "العلم-في-المونديال": "elm-mondial",
  "العلم_في_المونديال": "elm-mondial",
};

export const LEGACY_REDIRECTS: LegacyRedirect[] = [
  // أرشيفات الوسوم القديمة → صفحات السلاسل.
  ...Object.entries(TAG_TO_SERIES).map(([tag, slug]) =>
    redirect(`/tag/${tag}`, `/series/${slug}`),
  ),
  // «غير مصنف» بنسختيه كان قسمًا في القديم — مواده محفوظة تحت منوعات.
  redirect("/غير-مصنف", "/varieties"),
  redirect("/uncategorized", "/varieties"),
  // روابط المواد الثنائية والثلاثية تحسمها مسارات المقال بالمعرّف مباشرة،
  // دون تحويل وسيط إلى منوعات قد لا يكون القسم الفعلي للمادة.
];
