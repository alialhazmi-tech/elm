/**
 * حفظ التنسيق عند تطبيق نص مقترح من الذكاء (تحرير شامل، تدقيق) على متن HTML.
 *
 * عقد الذكاء يعيد نصًا خالصًا؛ فبدل استبدال المتن بفقرات عارية نُعيد:
 *  - التغريدات المضمّنة (blockquote[data-x-post]) في نهاية المتن بترتيبها الأصلي،
 *  - الروابط التي ما زال نص رابطها يظهر حرفيًا في النص الجديد (على أول ظهور)،
 *  - العناوين الفرعية التي جاءت فقرةً مطابقة نصًا في المقترح.
 * القوائم تُعدّ مفقودة دائمًا لأن بنية بنودها لا تُستنتج من نص خالص.
 * وحدة نقية: تُختبر كدوال خالصة وتُستدعى من الواجهة فقط.
 */

import { stripHtmlToText } from "../../content/html.ts";

export interface LinkEntry {
  href: string;
  text: string;
}

export interface HeadingEntry {
  level: 2 | 3;
  text: string;
}

export interface FormattingInventory {
  links: LinkEntry[];
  headings: HeadingEntry[];
  lists: number;
  xPosts: string[];
}

export interface FormattingLoss {
  links: { total: number; preserved: number; lost: number };
  headings: { total: number; preserved: number; lost: number };
  lists: number;
  xPosts: { total: number; preserved: number };
  /** لا شيء يُفقد ولا شيء يُعاد ترتيبه — لا داعي للتنبيه. */
  none: boolean;
}

const X_POST = /<blockquote\b[^>]*\bdata-x-post\s*=\s*"([1-9][0-9]{0,19})"[^>]*>[\s\S]*?<\/blockquote>/gi;
const LINK = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const HREF = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const HEADING = /<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
const LIST = /<(ul|ol)\b/gi;

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();
const innerText = (html: string) => collapse(stripHtmlToText(`<p>${html}</p>`));

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (text: string) => escapeHtml(text).replace(/"/g, "&quot;");

/** ما يحمله المتن الحالي من تنسيق يهم المحرر. */
export function formattingInventory(html: string): FormattingInventory {
  const xPosts: string[] = [];
  const withoutPosts = html.replace(X_POST, (_match, id: string) => {
    xPosts.push(id);
    return "";
  });
  const links: LinkEntry[] = [];
  for (const match of withoutPosts.matchAll(LINK)) {
    const href = (HREF.exec(match[1])?.[1] ?? HREF.exec(match[1])?.[2] ?? "").trim();
    const text = innerText(match[2]);
    if (href && text) links.push({ href, text });
  }
  const headings: HeadingEntry[] = [];
  for (const match of withoutPosts.matchAll(HEADING)) {
    const text = innerText(match[2]);
    if (text) headings.push({ level: match[1] === "2" ? 2 : 3, text });
  }
  const lists = (withoutPosts.match(LIST) ?? []).length;
  return { links, headings, lists, xPosts };
}

interface Segment {
  text: string;
  href?: string;
}

interface Paragraph {
  lines: Segment[][];
  heading: 2 | 3 | null;
}

function paragraphsFrom(text: string): Paragraph[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.split("\n").map(collapse).filter(Boolean))
    .filter((lines) => lines.length > 0)
    .map((lines) => ({ lines: lines.map((line) => [{ text: line }]), heading: null }));
}

/** يضع رابطًا على أول ظهور حرفي لنص الرابط في مقطع خالٍ من الروابط. */
function placeLink(paragraphs: Paragraph[], link: LinkEntry): boolean {
  for (const paragraph of paragraphs) {
    for (const line of paragraph.lines) {
      for (let index = 0; index < line.length; index += 1) {
        const segment = line[index];
        if (segment.href) continue;
        const at = segment.text.indexOf(link.text);
        if (at < 0) continue;
        const before = segment.text.slice(0, at);
        const after = segment.text.slice(at + link.text.length);
        const replacement: Segment[] = [];
        if (before) replacement.push({ text: before });
        replacement.push({ text: link.text, href: link.href });
        if (after) replacement.push({ text: after });
        line.splice(index, 1, ...replacement);
        return true;
      }
    }
  }
  return false;
}

function placeHeading(paragraphs: Paragraph[], heading: HeadingEntry): boolean {
  const target = paragraphs.find(
    (paragraph) => paragraph.heading === null && paragraph.lines.length === 1 && paragraph.lines[0].length === 1 && paragraph.lines[0][0].text === heading.text,
  );
  if (!target) return false;
  target.heading = heading.level;
  return true;
}

const renderSegment = (segment: Segment) =>
  segment.href ? `<a href="${escapeAttr(segment.href)}">${escapeHtml(segment.text)}</a>` : escapeHtml(segment.text);

const xPostHtml = (id: string) =>
  `<blockquote data-x-post="${id}"><a href="https://x.com/i/status/${id}" target="_blank" rel="noopener noreferrer">عرض التغريدة على X</a></blockquote>`;

function plan(html: string, newText: string): { html: string; loss: FormattingLoss } {
  const inventory = formattingInventory(html);
  const paragraphs = paragraphsFrom(newText);
  const headingsPreserved = inventory.headings.filter((heading) => placeHeading(paragraphs, heading)).length;
  const linksPreserved = inventory.links.filter((link) => placeLink(paragraphs, link)).length;

  const body = paragraphs
    .map((paragraph) => {
      const tag = paragraph.heading ? `h${paragraph.heading}` : "p";
      const content = paragraph.lines.map((line) => line.map(renderSegment).join("")).join("<br>");
      return `<${tag}>${content}</${tag}>`;
    })
    .join("");
  const posts = inventory.xPosts.map(xPostHtml).join("");

  const loss: FormattingLoss = {
    links: { total: inventory.links.length, preserved: linksPreserved, lost: inventory.links.length - linksPreserved },
    headings: { total: inventory.headings.length, preserved: headingsPreserved, lost: inventory.headings.length - headingsPreserved },
    lists: inventory.lists,
    xPosts: { total: inventory.xPosts.length, preserved: inventory.xPosts.length },
    none: false,
  };
  loss.none = loss.links.lost === 0 && loss.headings.lost === 0 && loss.lists === 0 && loss.xPosts.total === 0;
  return { html: body + posts, loss };
}

/** ما سيُفقد أو يُعاد ترتيبه لو طُبّق هذا النص على المتن الحالي — يُعرض قبل زر «طبّق». */
export function formattingLoss(html: string, newText: string): FormattingLoss {
  return plan(html, newText).loss;
}

/** يطبّق النص الجديد على المتن مع الحفاظ على الروابط والعناوين المطابقة والتغريدات. */
export function applyTextPreservingFormatting(html: string, newText: string): string {
  return plan(html, newText).html;
}

/** جملة عربية للتنبيه؛ فارغة حين لا فقد. */
export function formattingLossLabel(loss: FormattingLoss): string {
  const parts: string[] = [];
  if (loss.links.lost > 0) parts.push(`${loss.links.lost} من ${loss.links.total} روابط تُفقد (بقيت ${loss.links.preserved})`);
  else if (loss.links.total > 0) parts.push(`الروابط الـ${loss.links.total} محفوظة`);
  if (loss.headings.lost > 0) parts.push(`${loss.headings.lost} من ${loss.headings.total} عناوين فرعية تُفقد`);
  else if (loss.headings.total > 0) parts.push(`العناوين الفرعية الـ${loss.headings.total} محفوظة`);
  if (loss.lists > 0) parts.push(`${loss.lists} قوائم تتحول إلى فقرات`);
  if (loss.xPosts.total > 0) parts.push(`${loss.xPosts.total} تغريدات تُعاد في نهاية المتن`);
  return parts.join(" · ");
}

export interface TextRun {
  /** موضع بداية عقدة النص في مستند ProseMirror. */
  pos: number;
  text: string;
}

/**
 * يجد مدى نص عبر عقد نصية متجاورة (العلامات تقسم النص إلى عقد متتابعة مواضعها متلاصقة).
 * لا يعبر حدود الكتل: فجوة في المواضع تبدأ سلسلة جديدة.
 */
export function findTextRange(runs: TextRun[], needle: string): { from: number; to: number } | null {
  if (!needle) return null;
  let chain: TextRun[] = [];
  const search = (): { from: number; to: number } | null => {
    if (chain.length === 0) return null;
    const joined = chain.map((run) => run.text).join("");
    const index = joined.indexOf(needle);
    return index < 0 ? null : { from: chain[0].pos + index, to: chain[0].pos + index + needle.length };
  };
  for (const run of runs) {
    const previous = chain[chain.length - 1];
    if (previous && previous.pos + previous.text.length !== run.pos) {
      const found = search();
      if (found) return found;
      chain = [];
    }
    chain.push(run);
  }
  return search();
}
