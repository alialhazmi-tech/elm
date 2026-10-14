/** Discovery describes public, read-only content; it never grants account access. */
export const AGENT_SITE = "https://alelm.net";
export const CONTENT_SIGNAL = "ai-train=yes, search=yes, ai-input=yes";
export const DISCOVERY_LINKS = [
  '</.well-known/api-catalog>; rel="api-catalog"',
  '</llms.txt>; rel="describedby"; type="text/plain"',
  '</docs/content-api.md>; rel="service-doc"; type="text/markdown"',
  '</openapi.json>; rel="service-desc"; type="application/json"',
  '</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"',
  '</.well-known/ai-catalog.json>; rel="describedby"; type="application/ai-catalog+json"',
  '</mcp/server-card>; rel="describedby"; type="application/mcp-server-card+json"',
  '</auth.md>; rel="service-doc"; type="text/markdown"',
].join(", ");

/** An explicit Markdown preference is required; browsers and wildcard Accept stay HTML. */
export function prefersMarkdown(accept: string | null): boolean {
  const ranges = (accept ?? "").toLowerCase().split(",").map((part) => {
    const [type, ...parameters] = part.trim().split(";").map((value) => value.trim());
    const parameter = parameters.find((value) => value.startsWith("q="));
    const q = parameter ? Number(parameter.slice(2)) : 1;
    return { type, q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0 };
  });
  const quality = (type: string) => {
    const exact = ranges.filter((range) => range.type === type);
    if (exact.length) return Math.max(...exact.map((range) => range.q));
    const wildcard = ranges.filter((range) => range.type === "text/*");
    return Math.max(0, ...(wildcard.length ? wildcard : ranges.filter((range) => range.type === "*/*")).map((range) => range.q));
  };
  return ranges.some((range) => range.type === "text/markdown" && range.q > 0)
    && quality("text/markdown") >= quality("text/html");
}

/** Only the homepage and the public article template participate in negotiation. */
export function markdownPath(path: string): boolean {
  if (path === "/") return true;
  return /^\/(?:news|politics|economy|technology|sciences|health|sport|culture|world|business|ksa|varieties|variety|videos|infographics|environment|history|art|arts|education|current-events)\/[A-Za-z0-9_-]{1,64}\/[^/]+\/?$/u.test(path);
}
