/**
 * متن غني آمن — منقٍّ يعيد بناء الوسوم من الصفر (لا يمرر أي attribute من الإدخال).
 *
 * العقد: المتن المخزن إما نص فقرات (إرث ووردبريس والبذرة) أو HTML من محرر اللوحة.
 * التنقية تجري عند الحفظ وعند العرض كليهما — القاعدة لا تُعامل كمصدر موثوق.
 * وحدة نقية بلا اعتماديات: تستوردها الواجهة والخادم وسكربتات Node سواء.
 */

/** الوسوم المسموحة في متن المادة — كل ما عداها يُسقط ويبقى نصه. */
const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s",
  "h2", "h3", "ul", "ol", "li", "blockquote", "a",
]);

/** وسوم يُسقط محتواها بالكامل لا وسمها فقط. */
const DROP_CONTENT = /<(script|style|iframe|object|embed|svg|math)\b[\s\S]*?<\/\1\s*>/gi;

const TAG_ALIASES: Record<string, string> = { b: "strong", i: "em", div: "p" };

const TOKEN = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^"'>]|"[^"]*"|'[^']*')*)\/?>/g;

const escapeText = (text: string) => text.replace(/</g, "&lt;");

function openTag(tag: string, attrs: string): string {
  if (tag === "blockquote") {
    const post = /(?:^|\s)data-x-post\s*=\s*(?:"([1-9][0-9]{0,19})"|'([1-9][0-9]{0,19})')(?=\s|$)/i.exec(attrs);
    if (post) return `<blockquote data-x-post="${post[1] ?? post[2]}">`;
  }
  if (tag === "a") {
    const href = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
    const url = (href?.[1] ?? href?.[2] ?? "").trim();
    if (!/^(https?:\/\/|\/)[^"'<>\s]*$/i.test(url)) return "";
    const external = url.startsWith("http") ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${url}"${external}>`;
  }
  // المحاذاة الوحيدة المسموح تمريرها — اليمين افتراض RTL فلا يُكتب.
  const align = /text-align\s*:\s*(center|left|justify)/i.exec(attrs);
  if (align && ["p", "h2", "h3", "blockquote"].includes(tag)) {
    return `<${tag} style="text-align:${align[1].toLowerCase()}">`;
  }
  return `<${tag}>`;
}

/** يعيد HTML لا يحوي إلا الوسوم المسموحة بسمات مُعاد بناؤها — صالحًا للعرض المباشر. */
export function sanitizeBodyHtml(input: string): string {
  const source = input.replace(/<!--[\s\S]*?-->/g, "").replace(DROP_CONTENT, "");
  let output = "";
  let cursor = 0;

  TOKEN.lastIndex = 0;
  for (let match = TOKEN.exec(source); match; match = TOKEN.exec(source)) {
    output += escapeText(source.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const rawTag = match[1].toLowerCase();
    const tag = TAG_ALIASES[rawTag] ?? rawTag;
    if (!ALLOWED_TAGS.has(tag)) continue;

    const closing = match[0].startsWith("</");
    if (tag === "br") output += "<br>";
    else if (closing) output += `</${tag}>`;
    else output += openTag(tag, match[2] ?? "");
  }
  output += escapeText(source.slice(cursor));

  return output
    .replace(/<p>(\s|&nbsp;|<br>)*<\/p>/gi, "")
    .trim();
}

/** هل المتن HTML من محرر اللوحة أم نص فقرات إرثي؟ */
export function looksLikeHtml(body: string): boolean {
  return /<(p|h2|h3|ul|ol|li|blockquote|strong|em|u|s|a|br)\b/i.test(body);
}

const BLOCK_END = /<\/(p|h2|h3|li|blockquote|ul|ol)>|<br\s*\/?>/gi;

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
  "&quot;": '"', "&#39;": "'", "&#8230;": "…", "&hellip;": "…",
};

/** نص خالص من متن HTML — لحارس السياسة وعدّ الكلمات ومدخلات الذكاء. */
export function stripHtmlToText(body: string): string {
  if (!looksLikeHtml(body)) return body;
  const text = body
    .replace(BLOCK_END, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? " ");
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** نص فقرات → HTML فقرات — لتحميل المتون الإرثية في المحرر الغني. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
