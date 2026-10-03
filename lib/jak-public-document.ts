import { parseDocument } from "htmlparser2";
import type { AnyNode, Element } from "domhandler";
import { buildJakDocument } from "./jak-report-document.ts";
import { jakReportMetadata } from "./jak-sharing.ts";
import { jakReportHref } from "./jak-urls.ts";
import { sharingOrigin } from "./sharing.ts";
import type { JakCodeReport } from "./jak-report-types.ts";

type PublicDocumentOptions = { mobile?: boolean };
type Edit = { start: number; end: number; replacement: string };

const PUBLIC_BACK_CLASS = "jak-public-document__back-link";
const PUBLIC_TITLE_CLASS = "jak-public-document__title";

const PUBLIC_UI_STYLE = `<style data-jak-public-document-ui>
.${PUBLIC_BACK_CLASS}{position:fixed;inset-block-start:1rem;inset-inline-start:1rem;z-index:2147483647;display:inline-flex;align-items:center;gap:.375rem;padding:.5rem .75rem;border:1px solid rgba(255,255,255,.35);border-radius:999px;background:rgba(16,24,40,.88);color:#fff;font:600 14px/1.2 system-ui,sans-serif;text-decoration:none;box-shadow:0 2px 12px rgba(0,0,0,.2)}
.${PUBLIC_BACK_CLASS}:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.${PUBLIC_TITLE_CLASS}{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important;border:0!important}
</style>`;

function isElement(node: AnyNode): node is Element {
  return node.type === "tag" || node.type === "script" || node.type === "style";
}

function childrenOf(node: AnyNode): readonly AnyNode[] {
  return "children" in node ? node.children : [];
}

function walkElements(node: AnyNode): Element[] {
  const elements: Element[] = [];
  for (const child of childrenOf(node)) {
    if (isElement(child)) elements.push(child, ...walkElements(child));
  }
  return elements;
}

function firstElement(root: AnyNode, name: string): Element | undefined {
  return walkElements(root).find((element) => element.name.toLowerCase() === name);
}

function openingTagEnd(source: string, start: number): number {
  let quote = "";
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = "";
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index;
    }
  }
  return source.length - 1;
}

function rewriteHtmlOpeningTag(opening: string): string {
  const tagMatch = /^<html\b/i.exec(opening);
  if (!tagMatch) return opening;

  let index = tagMatch[0].length;
  let rewritten = opening.slice(0, index);
  while (index < opening.length) {
    const attributeStart = index;
    while (/\s/u.test(opening[index] ?? "")) index += 1;
    if (opening[index] === ">") {
      rewritten += opening.slice(attributeStart, index + 1);
      break;
    }
    if (opening[index] === "/" && opening[index + 1] === ">") {
      rewritten += opening.slice(attributeStart, index + 2);
      break;
    }

    const nameStart = index;
    while (index < opening.length && !/[\s=/>]/u.test(opening[index] ?? "")) index += 1;
    const name = opening.slice(nameStart, index);
    if (!name) {
      rewritten += opening.slice(attributeStart, index + 1);
      index += 1;
      continue;
    }
    while (/\s/u.test(opening[index] ?? "")) index += 1;
    if (opening[index] === "=") {
      index += 1;
      while (/\s/u.test(opening[index] ?? "")) index += 1;
      const quote = opening[index];
      if (quote === '"' || quote === "'") {
        index += 1;
        while (index < opening.length && opening[index] !== quote) index += 1;
        if (index < opening.length) index += 1;
      } else {
        while (index < opening.length && !/[\s>]/u.test(opening[index] ?? "")) index += 1;
      }
    }

    if (!/^(?:lang|dir)$/iu.test(name)) rewritten += opening.slice(attributeStart, index);
  }

  const closing = rewritten.lastIndexOf(">");
  if (closing < 0) return opening;
  return `${rewritten.slice(0, closing).replace(/\s+$/u, "")} lang="ar" dir="rtl">`;
}

function attribute(element: Element, name: string): string {
  const value = element.attribs[name] ?? element.attribs[name.toLowerCase()];
  return typeof value === "string" ? value : "";
}

function hasRel(element: Element, value: string): boolean {
  return attribute(element, "rel").split(/\s+/u).some((token) => token.toLowerCase() === value);
}

function shouldRemoveFromHead(element: Element): boolean {
  const name = element.name.toLowerCase();
  if (name === "title" || name === "base") return true;
  if (name === "link") return hasRel(element, "canonical");
  if (name !== "meta") return false;

  const metaName = attribute(element, "name").trim().toLowerCase();
  const property = attribute(element, "property").trim().toLowerCase();
  const httpEquiv = attribute(element, "http-equiv").trim().toLowerCase();
  return metaName === "description"
    || /^(?:robots|googlebot|bingbot|slurp)$/u.test(metaName)
    || /(?:robots|bot)/u.test(metaName)
    || property.startsWith("og:")
    || property === "article:published_time"
    || property.startsWith("twitter:")
    || metaName.startsWith("og:")
    || metaName.startsWith("twitter:")
    || httpEquiv === "refresh"
    || httpEquiv === "content-security-policy"
    || /(?:robots|bot)/u.test(httpEquiv)
    || Object.prototype.hasOwnProperty.call(element.attribs, "charset")
    || metaName === "viewport";
}

function conflictingHeadElements(root: AnyNode): Element[] {
  return walkElements(root).filter((element) => {
    // SVG titles describe artwork, not the document's browser/search title.
    for (let parent = element.parent; parent; parent = parent.parent) {
      if (isElement(parent) && (parent.name === "svg" || parent.name === "math")) return false;
    }
    return shouldRemoveFromHead(element);
  });
}

function removeOverlappingEdits(elements: Element[]): Edit[] {
  const ranges = elements
    .filter((element) => element.startIndex !== null && element.endIndex !== null)
    .map((element) => ({ start: element.startIndex as number, end: (element.endIndex as number) + 1 }))
    .sort((left, right) => left.start - right.start || right.end - left.end);
  const selected: Edit[] = [];
  for (const range of ranges) {
    if (selected.some((existing) => existing.start <= range.start && existing.end >= range.end)) continue;
    selected.push({ ...range, replacement: "" });
  }
  return selected;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function metadataString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "absolute" in value && typeof value.absolute === "string") return value.absolute;
  return fallback;
}

function metadataImage(metadata: ReturnType<typeof jakReportMetadata>): { url: string; alt?: string; width?: number; height?: number; type?: string } | undefined {
  const openGraph = metadata.openGraph as Record<string, unknown> | undefined;
  const images = openGraph?.images;
  const image = Array.isArray(images) ? images[0] : undefined;
  if (typeof image === "string") return { url: image };
  if (!image || typeof image !== "object" || !("url" in image) || typeof image.url !== "string") return undefined;
  return {
    url: image.url,
    ...(typeof image.alt === "string" ? { alt: image.alt } : {}),
    ...(typeof image.width === "number" ? { width: image.width } : {}),
    ...(typeof image.height === "number" ? { height: image.height } : {}),
    ...(typeof image.type === "string" ? { type: image.type } : {}),
  };
}

function publicMetadata(report: JakCodeReport): string {
  const metadata = jakReportMetadata(report);
  const title = metadataString(metadata.title, report.title);
  const description = typeof metadata.description === "string" ? metadata.description : "";
  const canonical = new URL(jakReportHref(report), sharingOrigin()).href;
  const image = metadataImage(metadata);
  const openGraph = metadata.openGraph as Record<string, unknown> | undefined;
  const publishedTime = typeof openGraph?.publishedTime === "string" ? openGraph.publishedTime : "";
  const tags = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta name="robots" content="index, follow">`,
    `<link rel="canonical" href="${escapeHtml(canonical)}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:locale" content="ar_SA">`,
    `<meta property="og:site_name" content="العلم">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonical)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
  ];
  if (publishedTime) tags.push(`<meta property="article:published_time" content="${escapeHtml(publishedTime)}">`);
  if (image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(image.url)}">`);
    tags.push(`<meta name="twitter:image" content="${escapeHtml(image.url)}">`);
    if (image.alt) tags.push(`<meta property="og:image:alt" content="${escapeHtml(image.alt)}"><meta name="twitter:image:alt" content="${escapeHtml(image.alt)}">`);
    if (image.width) tags.push(`<meta property="og:image:width" content="${image.width}">`);
    if (image.height) tags.push(`<meta property="og:image:height" content="${image.height}">`);
    if (image.type) tags.push(`<meta property="og:image:type" content="${escapeHtml(image.type)}">`);
  }
  return tags.join("");
}

function applyEdits(source: string, edits: Edit[]): string {
  return [...edits]
    .sort((left, right) => right.start - left.start)
    .reduce((result, edit) => `${result.slice(0, edit.start)}${edit.replacement}${result.slice(edit.end)}`, source);
}

/** Incomplete editor input may omit document wrappers. Preserve its content and
 * executable code, but supply an explicit envelope for metadata and navigation. */
function completeDocument(source: string): string {
  const parsed = parseDocument(source, { withStartIndices: true, withEndIndices: true });
  if (["html", "head", "body"].every((name) => firstElement(parsed, name))) return source;
  const edits: Edit[] = [];
  for (const element of walkElements(parsed)) {
    if (!["html", "head", "body"].includes(element.name) || element.startIndex === null || element.endIndex === null) continue;
    const openingEnd = openingTagEnd(source, element.startIndex);
    edits.push({ start: element.startIndex, end: openingEnd + 1, replacement: "" });
    const closingStart = source.lastIndexOf("</", element.endIndex);
    if (closingStart > openingEnd && new RegExp(`^</${element.name}\\s*>$`, "i").test(source.slice(closingStart, element.endIndex + 1))) {
      edits.push({ start: closingStart, end: element.endIndex + 1, replacement: "" });
    }
  }
  // Strip only parsed doctype declarations, never a matching string in scripts.
  for (const node of parsed.children) {
    if (node.type === "directive" && node.name.toLowerCase() === "!doctype" && node.startIndex !== null && node.endIndex !== null) {
      edits.push({ start: node.startIndex, end: node.endIndex + 1, replacement: "" });
    }
  }
  return `<!doctype html><html lang="ar" dir="rtl"><head></head><body>${applyEdits(source, edits)}</body></html>`;
}

export function buildPublicJakDocument(report: JakCodeReport, options: PublicDocumentOptions = {}): string {
  const source = completeDocument(buildJakDocument(report, options));
  const document = parseDocument(source, { withStartIndices: true, withEndIndices: true });
  const html = firstElement(document, "html")!;
  const head = firstElement(document, "head")!;
  const body = firstElement(document, "body")!;

  // Metadata in pasted fragments can occur in the body; it must not override
  // the public canonical or prevent indexing either.
  const edits: Edit[] = removeOverlappingEdits(conflictingHeadElements(document));
  const htmlStart = html.startIndex;
  const htmlEnd = html.endIndex;
  if (htmlStart !== null && htmlEnd !== null) {
    const end = openingTagEnd(source, htmlStart);
    edits.push({ start: htmlStart, end: end + 1, replacement: rewriteHtmlOpeningTag(source.slice(htmlStart, end + 1)) });
  }

  const headStart = head.startIndex;
  const headEnd = head.endIndex;
  if (headStart !== null && headEnd !== null) {
    const headOpeningEnd = openingTagEnd(source, headStart);
    const headClosingStart = source.toLowerCase().lastIndexOf("</head", headEnd);
    edits.push({ start: headOpeningEnd + 1, end: headOpeningEnd + 1, replacement: publicMetadata(report) });
    edits.push({ start: headClosingStart >= 0 ? headClosingStart : headEnd, end: headClosingStart >= 0 ? headClosingStart : headEnd, replacement: PUBLIC_UI_STYLE });
  }

  const bodyStart = body.startIndex;
  const bodyEnd = body.endIndex;
  if (bodyStart !== null && bodyEnd !== null) {
    const hasH1 = walkElements(body).some((element) => element.name.toLowerCase() === "h1");
    const hasBackLink = walkElements(body).some((element) => attribute(element, "class").split(/\s+/u).includes(PUBLIC_BACK_CLASS));
    const additions = [
      hasBackLink ? "" : `<a class="${PUBLIC_BACK_CLASS}" href="/jak" aria-label="العودة إلى جاك العلم"><span aria-hidden="true">←</span><span>جاك العلم</span></a>`,
      hasH1 ? "" : `<h1 class="${PUBLIC_TITLE_CLASS}">${escapeHtml(report.title)}</h1>`,
    ].join("");
    if (additions) {
      const bodyOpeningEnd = openingTagEnd(source, bodyStart);
      edits.push({ start: bodyOpeningEnd + 1, end: bodyOpeningEnd + 1, replacement: additions });
    }
  }

  return applyEdits(source, edits);
}

export function publicJakDocumentHeaders(): Record<string, string> {
  const csp = [
    "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox",
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "connect-src 'none'",
    "script-src 'unsafe-inline' https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/",
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    "font-src data: https://fonts.gstatic.com https://jakelelm.alelm.net",
    "img-src 'self' data: https://jakelelm.alelm.net https://dash.alelm.net https://alelm.net",
    "media-src 'self' https://jakelelm.alelm.net https://dash.alelm.net https://alelm.net",
  ].join("; ");
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "index, follow",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Content-Security-Policy": csp,
  };
}
