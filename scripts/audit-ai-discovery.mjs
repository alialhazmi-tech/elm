import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

// Read-only, bounded audit. Reuse --manifest <previous report> for an identical page sample.
// User-Agent probes are simulations, not proof of a verified crawler's access.
const { values } = parseArgs({ options: {
  base: { type: "string", default: "https://alelm.net" },
  out: { type: "string", default: "tmp/ai-discovery-audit.json" },
  manifest: { type: "string" }, bots: { type: "boolean", default: false },
} });
const base = new URL(values.base).origin;
const normalAgent = "Mozilla/5.0 (compatible; AlelmDiscoveryAudit/1.0)";
const decode = text => text.replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
const textOf = html => decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const flatten = value => Array.isArray(value) ? value.flatMap(flatten) : value?.["@graph"] ? value["@graph"].flatMap(flatten) : [value];

async function fetchPage(path, userAgent = normalAgent) {
  const url = new URL(path, base);
  if (url.origin !== base) throw new Error("Audit targets must remain on the chosen origin");
  const start = performance.now();
  try {
    const response = await fetch(url, { headers: { "User-Agent": userAgent }, signal: AbortSignal.timeout(30000), redirect: "manual" });
    const html = await response.text();
    const schemas = [];
    const schemaErrors = [];
    for (const match of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      try { schemas.push(...flatten(JSON.parse(match[1]))); } catch (error) { schemaErrors.push(error.name); }
    }
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? "";
    const media = schemas.filter(value => ["VideoObject", "PodcastSeries", "PodcastEpisode"].includes(value?.["@type"]));
    const mediaErrors = [];
    for (const item of media) {
      if (!textOf(main).includes(item.name)) mediaErrors.push(`Missing visible title: ${item["@id"]}`);
      if (item["@type"] === "VideoObject" && !html.includes(`src="${item.embedUrl.replaceAll("&", "&amp;")}"`)) mediaErrors.push(`Missing video player: ${item["@id"]}`);
      if (item["@type"] === "PodcastEpisode" && !html.includes(`id="${new URL(item.url).hash.slice(1)}"`)) mediaErrors.push(`Missing episode anchor: ${item["@id"]}`);
    }
    const canonical = [...html.matchAll(/<link\b[^>]*>/g)].find(([tag]) => /rel="canonical"/.test(tag))?.[0].match(/href="([^"]+)"/)?.[1];
    return { url: url.href, status: response.status, location: response.headers.get("location"),
      contentType: response.headers.get("content-type"), durationMs: Math.round(performance.now() - start),
      h1: [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map(match => textOf(match[1])),
      canonical: canonical ? decode(canonical) : null,
      mainTextWords: textOf(main).split(/\s+/).filter(Boolean).length,
      schemaTypes: [...new Set(schemas.map(value => value?.["@type"]).filter(Boolean))], schemaErrors,
      media, mediaErrors,
      noindex: /<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/i.test(html) || /noindex/i.test(response.headers.get("x-robots-tag") ?? ""),
      html };
  } catch (error) { return { url: url.href, error: error.name, durationMs: Math.round(performance.now() - start), html: "" }; }
}

async function batch(inputs, work) {
  const output = [];
  for (let i = 0; i < inputs.length; i += 2) output.push(...await Promise.all(inputs.slice(i, i + 2).map(work)));
  return output;
}

let targets;
if (values.manifest) {
  const previous = JSON.parse(await readFile(values.manifest, "utf8"));
  targets = previous.pages.map(page => { const url = new URL(page.url); return url.pathname + url.search; });
} else {
  const [rss, videoMap, podcasts] = await batch(["/rss.xml", "/sitemap-videos.xml", "/podcasts"], path => fetchPage(path));
  const articles = [...rss.html.matchAll(/<item>[\s\S]*?<link>(.*?)<\/link>/g)].map(match => new URL(decode(match[1])).pathname).slice(0, 5);
  const videos = [...videoMap.html.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => new URL(decode(match[1])).pathname).slice(0, 3);
  const shows = [...podcasts.html.matchAll(/<a\b[^>]*>/g)]
    .filter(([tag]) => /class="[^"]*\bpc-show\b[^"]*"/.test(tag))
    .map(([tag]) => tag.match(/href="([^"]+)"/)?.[1]).filter(Boolean)
    .map(href => new URL(decode(href), base)).filter(url => url.origin === base)
    .map(url => url.pathname + url.search).slice(0, 8);
  targets = ["/", "/llms.txt", "/rss.xml", "/robots.txt", "/about", "/ai", "/podcasts", ...articles, ...videos, ...shows];
}
targets = [...new Set(targets)].slice(0, 30);
const pages = (await batch(targets, path => fetchPage(path))).map(result => {
  const page = { ...result };
  delete page.html;
  return page;
});
const botProbes = [];
if (values.bots) {
  const article = targets.find(path => /^\/[^/]+\/\d+\//.test(path));
  const paths = ["/robots.txt", "/llms.txt", article].filter(Boolean);
  for (const userAgent of ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Googlebot", "GPTBot", "ClaudeBot"]) {
    const responses = await batch(paths, path => fetchPage(path, userAgent));
    botProbes.push(...responses.map(({ url, status, error, durationMs }) => ({ userAgent, url, status, error, durationMs })));
  }
}
const report = { checkedAt: new Date().toISOString(), base,
  limitations: ["User-Agent tests do not verify crawler IP identity.", "mainTextWords includes visible controls and navigation within main, not only article prose.", "Request timings are not mobile performance or Core Web Vitals measurements.", "No settings, content or analytics configuration are changed."],
  pages, botProbes };
await mkdir(dirname(values.out), { recursive: true });
await writeFile(values.out, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ output: values.out, pages: pages.length, pageStatuses: pages.map(({ url, status, error, schemaTypes }) => ({ url, status, error, schemaTypes })), botProbes: botProbes.length, botFailures: botProbes.filter(probe => probe.status !== 200) }, null, 2));
if (pages.some(page => page.error || page.status !== 200 || page.schemaErrors?.length || page.mediaErrors?.length)) process.exitCode = 1;
