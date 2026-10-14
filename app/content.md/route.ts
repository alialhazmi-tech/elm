import { readArticle, readHome, publicCard } from "@/lib/agents/content";
import { AGENT_SITE, CONTENT_SIGNAL, DISCOVERY_LINKS, markdownPath } from "@/lib/agents/discovery";
import { articleMarkdown, homeMarkdown } from "@/lib/agents/markdown";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  // Proxy strips client-supplied markers, then sets this only after the origin guard.
  // Next config performs an internal rewrite; Request.url may retain the original URL.
  const path = request.headers.get("x-alelm-markdown-path");
  const headers = new Headers({ "Content-Type": "text/markdown; charset=utf-8", Vary: "Accept",
    "Cache-Control": "private, no-store", "Content-Signal": CONTENT_SIGNAL, Link: DISCOVERY_LINKS });
  if (!path || !markdownPath(path)) return new Response(null, { status: 404, headers });
  try {
    let body: string;
    let canonical = `${AGENT_SITE}/`;
    if (path === "/") body = homeMarkdown(await readHome());
    else {
      const article = await readArticle(path.split("/")[2]);
      if (!article) return new Response("المادة غير متاحة.\n", { status: 404, headers });
      const card = publicCard(article);
      canonical = card.url;
      const decode = (value: string) => { try { return decodeURIComponent(value); } catch { return value; } };
      if (decode(new URL(canonical).pathname) !== decode(path.replace(/\/$/, ""))) {
        headers.set("Location", canonical);
        return new Response(null, { status: 308, headers });
      }
      body = articleMarkdown({ ...card, body: article.body, videoUrl: article.format === "videos" ? article.videoUrl : null, factCheck: article.factCheck });
    }
    headers.set("Content-Location", canonical);
    headers.set("Link", `${DISCOVERY_LINKS}, <${canonical}>; rel="canonical"`);
    return new Response(body, { headers });
  } catch {
    console.error("[agents] markdown_read_failed");
    headers.set("Retry-After", "60");
    return new Response("المحتوى غير متاح مؤقتًا.\n", { status: 503, headers });
  }
}
