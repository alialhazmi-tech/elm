import { stripHtmlToText } from "@/lib/content/html";

type SpokenItem = { title: string; excerpt?: string };
const INTRO = "أهلًا بكم في موجز العلم. في هذه الجولة، نرافقكم عبر مختارات من موادنا، من الخَبَر إلى ما وراءه.";
const OUTRO = "كانت هذه جولتكم مع موجز العلم. للاطلاع على التفاصيل والسياق الكامل، اضغطوا على عناوين المواد في هذه القائمة. شكرًا لاستماعكم.";
const clean = (text: string) => stripHtmlToText(`<p>${text}</p>`).replace(/\s+/gu, " ").trim();
const sentence = (text: string) => /[.!؟?]$/u.test(text) ? text : `${text}.`;
const comparable = (text: string) => text.replace(/[\p{P}\p{Z}\p{M}]/gu, "");

/** نص واحد للمشغل وللنسخة المقروءة؛ لا يعيد صياغة الوقائع ولا يخترع سياقًا. */
export function homeBriefScript(items: SpokenItem[]): string {
  const stories = items.slice(0, 5).map(item => {
    const title = clean(item.title);
    const excerpt = clean(item.excerpt ?? "");
    // لا نقرأ مقتطفًا مقطوعًا، ولا نقتطع منه جملة قد تفصل الخبر عن قيده أو مصدره.
    const useful = excerpt && Array.from(excerpt).length <= 240 && !/(?:…|\.{2,})$/u.test(excerpt) &&
      comparable(excerpt) !== comparable(title);
    return { title, excerpt: useful ? excerpt : "" };
  }).filter(item => item.title);
  if (!stories.length) return "";
  const compose = () => [INTRO, ...stories.map((item, index) => {
    const transition = index === 0 ? "نبدأ مع:" : index === stories.length - 1 ? "ونختتم مختاراتنا مع:" : ["", "وفي مادة أخرى:", "ومن مختاراتنا أيضًا:", "ونتوقف كذلك عند:"][index];
    return `${transition} ${sentence(item.title)}${item.excerpt ? ` ${sentence(item.excerpt)}` : ""}`;
  }), OUTRO].join("\n\n");
  // نحافظ على العناوين والمقدمة والخاتمة، ونحذف الموجز الإضافي كاملًا عند بلوغ سقف الصوت.
  while (Array.from(compose()).length > 2000) {
    const longest = stories.reduce((a, b) => a.excerpt.length >= b.excerpt.length ? a : b);
    if (!longest.excerpt) break;
    longest.excerpt = "";
  }
  return compose();
}
