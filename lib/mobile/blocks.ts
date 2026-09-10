/**
 * متن المادة → كتل حتمية للتطبيق الأصلي — وحدة نقية بلا اعتماديات.
 *
 * المدخل هو HTML المنقّى من `sanitizeBodyHtml` (p/br/strong/em/u/s/h2/h3/ul/ol/li/blockquote/a
 * مع `style="text-align:…"` و`data-x-post`)، أو النص الإرثي بلا وسوم (فقرات مفصولة بسطرين).
 * الناتج لا يحمل HTML إطلاقًا: كل كتلة تحمل «مقاطع» نصية بعلامات تنسيق منطقية يُصيّرها
 * SwiftUI بـ AttributedString مباشرة. الوسوم غير المعروفة تُسقط ويبقى نصها.
 */

export type MobileRun = {
  text: string;
  bold?: true;
  italic?: true;
  underline?: true;
  strike?: true;
  href?: string;
};

export type MobileBlockAlign = "center" | "left" | "justify";

export type MobileBlock =
  | { type: "paragraph"; runs: MobileRun[]; align?: MobileBlockAlign }
  | { type: "heading"; level: 2 | 3; runs: MobileRun[]; align?: MobileBlockAlign }
  | { type: "list"; ordered: boolean; items: MobileRun[][] }
  | { type: "quote"; runs: MobileRun[]; align?: MobileBlockAlign }
  | { type: "xpost"; postId: string; runs: MobileRun[] };

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  laquo: "«",
  raquo: "»",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  copy: "©",
  reg: "®",
  trade: "™",
  times: "×",
  zwnj: "‌",
  zwj: "‍",
  rlm: "‏",
  lrm: "‎",
};

/** يفكّ الكيانات المسماة والرقمية (`&#8230;` و`&#x27;`)؛ المجهول يبقى كما هو. */
export function decodeEntities(text: string): string {
  if (!text.includes("&")) return text;
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X";
      const code = hex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()];
    return named ?? match;
  });
}

/** هل المتن HTML من محرر اللوحة أم نص فقرات إرثي؟ (نفس اختبار `looksLikeHtml` بلا استيراد.) */
export function bodyLooksLikeHtml(body: string): boolean {
  return /<(p|h2|h3|ul|ol|li|blockquote|strong|em|u|s|a|br|b|i|div)\b/i.test(body);
}

type Mark = { tag: "strong" | "em" | "u" | "s" | "a"; href?: string };

type OpenBlock =
  | { kind: "paragraph"; runs: MobileRun[]; align?: MobileBlockAlign }
  | { kind: "heading"; level: 2 | 3; runs: MobileRun[]; align?: MobileBlockAlign }
  | { kind: "quote"; runs: MobileRun[]; align?: MobileBlockAlign }
  | { kind: "xpost"; postId: string; runs: MobileRun[] }
  | { kind: "item"; runs: MobileRun[] };

type OpenList = { ordered: boolean; items: MobileRun[][] };

const TAG_TOKEN = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^"'>]|"[^"]*"|'[^']*')*)\/?>/g;
const INLINE_ALIASES: Record<string, Mark["tag"]> = { strong: "strong", b: "strong", em: "em", i: "em", u: "u", s: "s", a: "a" };

function alignOf(attrs: string): MobileBlockAlign | undefined {
  const match = /text-align\s*:\s*(center|left|justify)/i.exec(attrs);
  return match ? (match[1].toLowerCase() as MobileBlockAlign) : undefined;
}

function hrefOf(attrs: string): string | undefined {
  const match = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
  const url = decodeEntities((match?.[1] ?? match?.[2] ?? "").trim());
  return /^(https?:\/\/|\/)[^\s"'<>]*$/i.test(url) ? url : undefined;
}

function xPostOf(attrs: string): string | undefined {
  const match = /(?:^|\s)data-x-post\s*=\s*(?:"([1-9][0-9]{0,19})"|'([1-9][0-9]{0,19})')/i.exec(attrs);
  return match?.[1] ?? match?.[2];
}

function sameMarks(a: MobileRun, b: MobileRun): boolean {
  return a.bold === b.bold && a.italic === b.italic && a.underline === b.underline && a.strike === b.strike && a.href === b.href;
}

function runFor(text: string, marks: Mark[]): MobileRun {
  const run: MobileRun = { text };
  for (const mark of marks) {
    if (mark.tag === "strong") run.bold = true;
    else if (mark.tag === "em") run.italic = true;
    else if (mark.tag === "u") run.underline = true;
    else if (mark.tag === "s") run.strike = true;
    else if (mark.tag === "a" && mark.href && !run.href) run.href = mark.href;
  }
  return run;
}

/** يقصّ الفراغ من طرفي الكتلة ويسقط المقاطع الفارغة؛ null إذا لم يبق نص. */
function finalizeRuns(runs: MobileRun[]): MobileRun[] | null {
  const kept = runs.filter((run) => run.text.length > 0);
  if (kept.length === 0) return null;
  const first = kept[0];
  first.text = first.text.replace(/^[\s\n]+/, "");
  const last = kept[kept.length - 1];
  last.text = last.text.replace(/[\s\n]+$/, "");
  const nonEmpty = kept.filter((run) => run.text.length > 0);
  return nonEmpty.length > 0 && nonEmpty.some((run) => run.text.trim().length > 0) ? nonEmpty : null;
}

/** يحوّل HTML منقّى إلى كتل؛ الفقرات الفارغة تُسقط والنص الطليق خارج الوسوم يصبح فقرة. */
export function htmlToBlocks(html: string): MobileBlock[] {
  const blocks: MobileBlock[] = [];
  const marks: Mark[] = [];
  const lists: OpenList[] = [];
  let open: OpenBlock | null = null;

  const closeBlock = () => {
    if (!open) return;
    const block = open;
    open = null;
    const runs = finalizeRuns(block.runs);
    if (block.kind === "item") {
      const list = lists[lists.length - 1];
      if (list && runs) list.items.push(runs);
      return;
    }
    if (block.kind === "xpost") {
      blocks.push({ type: "xpost", postId: block.postId, runs: runs ?? [] });
      return;
    }
    if (!runs) return;
    if (block.kind === "paragraph") blocks.push({ type: "paragraph", runs, ...(block.align ? { align: block.align } : {}) });
    else if (block.kind === "heading") blocks.push({ type: "heading", level: block.level, runs, ...(block.align ? { align: block.align } : {}) });
    else blocks.push({ type: "quote", runs, ...(block.align ? { align: block.align } : {}) });
  };

  const appendText = (raw: string, fromBr = false) => {
    let text = fromBr ? raw : decodeEntities(raw).replace(/[ \t\r\n\f]+/g, " ");
    if (!fromBr && text.trim() === "" && !open) return; // فراغ بين الكتل
    if (!open) {
      if (fromBr) return; // فاصل أسطر خارج أي كتلة
      open = { kind: "paragraph", runs: [] };
    }
    const runs = open.runs;
    const last = runs[runs.length - 1];
    if (fromBr) {
      if (last) last.text = last.text.replace(/[ \t]+$/, "");
      else if (runs.length === 0) return; // فاصل في بداية الكتلة
    } else if (last && last.text.endsWith("\n")) {
      text = text.replace(/^[ \t]+/, "");
    }
    if (!text) return;
    const run = runFor(text, marks);
    if (last && sameMarks(last, run)) last.text += text;
    else runs.push(run);
  };

  let cursor = 0;
  TAG_TOKEN.lastIndex = 0;
  for (let match = TAG_TOKEN.exec(html); match; match = TAG_TOKEN.exec(html)) {
    if (match.index > cursor) appendText(html.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    const closing = match[0].startsWith("</");
    const tag = match[1].toLowerCase();
    const attrs = match[2] ?? "";

    if (tag === "br") {
      if (!closing) appendText("\n", true);
      continue;
    }
    const inline = INLINE_ALIASES[tag];
    if (inline) {
      if (closing) {
        for (let index = marks.length - 1; index >= 0; index -= 1) {
          if (marks[index].tag === inline) {
            marks.splice(index, 1);
            break;
          }
        }
      } else {
        marks.push(inline === "a" ? { tag: "a", href: hrefOf(attrs) } : { tag: inline });
      }
      continue;
    }
    if (tag === "ul" || tag === "ol") {
      if (closing) {
        closeBlock();
        const list = lists.pop();
        if (!list) continue;
        const parent = lists[lists.length - 1];
        if (parent) parent.items.push(...list.items);
        else if (list.items.length > 0) blocks.push({ type: "list", ordered: list.ordered, items: list.items });
      } else {
        // قائمة متداخلة داخل عنصر: يُغلق العنصر الجاري وتُدمج عناصرها في القائمة الأم.
        closeBlock();
        lists.push({ ordered: tag === "ol", items: [] });
      }
      continue;
    }
    if (tag === "li") {
      closeBlock();
      if (!closing && lists.length > 0) open = { kind: "item", runs: [] };
      continue;
    }
    if (tag === "p" || tag === "div") {
      if (open && open.kind === "item") {
        // Tiptap يلفّ محتوى العنصر بفقرة؛ فقرة ثانية داخل العنصر تصبح سطرًا جديدًا.
        if (!closing && open.runs.length > 0) appendText("\n", true);
        continue;
      }
      closeBlock();
      if (!closing) open = { kind: "paragraph", runs: [], align: alignOf(attrs) };
      continue;
    }
    if (tag === "h2" || tag === "h3") {
      closeBlock();
      if (!closing) open = { kind: "heading", level: tag === "h2" ? 2 : 3, runs: [], align: alignOf(attrs) };
      continue;
    }
    if (tag === "blockquote") {
      closeBlock();
      if (closing) continue;
      const postId = xPostOf(attrs);
      open = postId ? { kind: "xpost", postId, runs: [] } : { kind: "quote", runs: [], align: alignOf(attrs) };
      continue;
    }
    // وسم غير معروف: يُسقط ويبقى نصه.
  }
  if (cursor < html.length) appendText(html.slice(cursor));
  closeBlock();
  while (lists.length > 0) {
    const list = lists.pop()!;
    const parent = lists[lists.length - 1];
    if (parent) parent.items.push(...list.items);
    else if (list.items.length > 0) blocks.push({ type: "list", ordered: list.ordered, items: list.items });
  }
  return blocks;
}

/** النص الإرثي: فقرات من سطرين فأكثر، والسطر المفرد داخل الفقرة يبقى `\n`. */
export function plainTextToBlocks(text: string): MobileBlock[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/[ \t]+/g, " ").split("\n").map((line) => line.trim()).filter(Boolean).join("\n"))
    .filter(Boolean)
    .map((paragraph) => ({ type: "paragraph" as const, runs: [{ text: paragraph }] }));
}

/** المتن المخزن كما هو (HTML منقّى أو نص إرثي) → كتل. */
export function bodyToBlocks(body: string): MobileBlock[] {
  return bodyLooksLikeHtml(body) ? htmlToBlocks(body) : plainTextToBlocks(body);
}
