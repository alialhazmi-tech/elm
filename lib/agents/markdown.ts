import { looksLikeHtml, sanitizeBodyHtml, textToHtml } from "../content/html.ts";
import { htmlToBlocks, type MobileBlock, type MobileRun } from "../mobile/blocks.ts";
import { storyHref, type HomeData } from "../content/types.ts";
import { AGENT_SITE } from "./discovery.ts";

export function markdownText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/([`*_{}[\]<>#|~])/g, "\\$1")
    .replace(/^(\s*)([-+] |\d+\. )/gm, "$1\\$2");
}

function href(value: string): string | null {
  try {
    const url = new URL(value, AGENT_SITE);
    return ["https:", "http:"].includes(url.protocol) ? url.href.replace(/[()]/g, (char) => char === "(" ? "%28" : "%29") : null;
  } catch { return null; }
}

function runs(items: MobileRun[]): string {
  return items.map((run) => {
    let text = markdownText(run.text);
    if (run.bold) text = `**${text}**`;
    if (run.italic) text = `*${text}*`;
    if (run.strike) text = `~~${text}~~`;
    const target = run.href ? href(run.href) : null;
    return target ? `[${text}](${target})` : text;
  }).join("");
}

function block(value: MobileBlock): string {
  switch (value.type) {
    case "heading": return `${"#".repeat(value.level)} ${runs(value.runs)}`;
    case "list": return value.items.map((item, index) => `${value.ordered ? `${index + 1}.` : "-"} ${runs(item).replace(/\n/g, "\n  ")}`).join("\n");
    case "quote": return runs(value.runs).split("\n").map((line) => `> ${line}`).join("\n");
    case "image": return `![${markdownText(value.alt)}](${href(value.src)})${value.caption ? `\n\n${markdownText(value.caption)}` : ""}`;
    case "xpost": return `${runs(value.runs)}\n\n[المنشور على X](https://x.com/i/status/${value.postId})`.trim();
    default: return runs(value.runs);
  }
}

export function bodyMarkdown(body: string | null | undefined): string {
  const raw = body ?? "";
  return htmlToBlocks(looksLikeHtml(raw) ? sanitizeBodyHtml(raw) : textToHtml(raw)).map(block).join("\n\n");
}

type ArticleText = {
  title: string; description: string; url: string; body: string | null;
  publishedAt: string | null; updatedAt: string | null; videoUrl: string | null;
  factCheck: unknown;
};

/** Only the two public editorial statements may leave this free-form JSON field. */
export function publicFactCheck(value: unknown): { rumor: string; truth: string } | null {
  if (!value || typeof value !== "object") return null;
  const fact = value as { rumor?: unknown; truth?: unknown };
  return typeof fact.rumor === "string" && typeof fact.truth === "string"
    ? { rumor: fact.rumor, truth: fact.truth } : null;
}

export function articleMarkdown(article: ArticleText): string {
  const parts = [`# ${markdownText(article.title)}`, `المصدر: [العلم](${article.url})`,
    `تاريخ النشر: ${article.publishedAt}`];
  if (article.updatedAt && article.publishedAt && Date.parse(article.updatedAt) > Date.parse(article.publishedAt)) parts.push(`تاريخ التحديث: ${article.updatedAt}`);
  if (article.description) parts.push(markdownText(article.description));
  const text = bodyMarkdown(article.body);
  if (text) parts.push(text);
  const fact = publicFactCheck(article.factCheck);
  if (fact) parts.push(`## الشائعة\n\n${markdownText(fact.rumor)}\n\n## الحقيقة\n\n${markdownText(fact.truth)}`);
  const video = article.videoUrl ? href(article.videoUrl) : null;
  if (video) parts.push(`[المادة المرئية](${video})\n\nهذا النص لا يتضمن تفريغًا تلقائيًا للفيديو.`);
  if (!text) parts.push("لا يتوفر متن نصي إضافي لهذه المادة؛ راجع الصفحة الأصلية والوسائط المنشورة فيها.");
  return parts.join("\n\n") + "\n";
}

export function homeMarkdown(home: HomeData): string {
  const selected = [home.hero, ...home.minis, home.dataStory, ...home.mosaic, ...home.videos, ...home.mostRead];
  const seen = new Set<string>();
  const parts = ["# العلم", `منصة إعلام ومعرفة سعودية — [الموقع الرسمي](${AGENT_SITE}/)`,
    "## مختارات الرئيسية"];
  for (const story of selected) {
    if (!story || seen.has(story.id)) continue;
    seen.add(story.id);
    parts.push(`### [${markdownText(story.title)}](${new URL(storyHref(story), AGENT_SITE).href})\n\n${markdownText(story.excerpt)}`);
  }
  parts.push(`## متابعة المحتوى\n\n- [أحدث المواد — RSS](${AGENT_SITE}/rss.xml)\n- [دليل المحتوى](${AGENT_SITE}/llms.txt)\n- [البحث والقراءة عبر API](${AGENT_SITE}/docs/content-api.md)`);
  return parts.join("\n\n") + "\n";
}
