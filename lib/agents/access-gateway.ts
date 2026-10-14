/** A narrowly scoped adapter to the independent agent service. Never forwards website sessions. */
export const AGENT_AUTHORITY = "https://agents.alelm.net";
export const AGENT_RESOURCE = "https://alelm.net";
export const AGENT_RESOURCE_METADATA = `${AGENT_RESOURCE}/.well-known/oauth-protected-resource`;
const challenge = `Bearer resource_metadata="${AGENT_RESOURCE_METADATA}", error="invalid_token", scope="news:read"`;
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "X-Content-Type-Options": "nosniff" };
let active = 0;

function error(status: number, code: string) {
  return Response.json({ error: code }, { status, headers: { ...headers,
    ...(status === 401 ? { "WWW-Authenticate": challenge } : {}),
    ...(status === 503 ? { "Retry-After": "60" } : {}),
  } });
}

async function bounded(body: ReadableStream<Uint8Array> | null, max: number) {
  if (!body) return new Uint8Array();
  const reader = body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel(); }, 8000);
  let completed = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) { if (timedOut) throw new Error("body_timeout"); completed = true; break; }
      size += value.byteLength;
      if (size > max) throw new RangeError("body_limit");
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timer); await reader.cancel();
    if (!completed) chunks.length = 0;
  }
}

export async function agentAccessGateway(request: Request, fetcher: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice("/api/agents".length);
  const read = request.method === "GET" && (path === "/search" || /^\/articles\/[A-Za-z0-9_-]{1,64}$/.test(path));
  const mcp = request.method === "POST" && path === "/mcp";
  if (!url.pathname.startsWith("/api/agents/") || (!read && !mcp)) return error(404, "not_found");
  if ([...url.searchParams.keys()].some(key => path !== "/search" || !["q", "page"].includes(key) || url.searchParams.getAll(key).length !== 1)) return error(400, "invalid_request");
  const origin = request.headers.get("origin");
  if (origin && origin !== AGENT_RESOURCE) return error(403, "origin_not_allowed");
  const authorization = request.headers.get("authorization");
  if (!authorization || !/^Bearer [A-Za-z0-9_.-]{1,8192}$/i.test(authorization)) return error(401, "invalid_token");
  if (mcp && request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return error(415, "invalid_request");
  if (Number(request.headers.get("content-length") ?? 0) > 16384) return error(413, "request_too_large");
  if (active >= 4) return error(503, "temporarily_unavailable");
  active++;
  try {
    let body;
    try { body = mcp ? await bounded(request.body, 16384) : undefined; }
    catch (cause) { if (cause instanceof RangeError) return error(413, "request_too_large"); throw cause; }
    // Never copy Cookie, Origin, forwarding headers, the origin secret, or arbitrary client headers.
    const forwarded = new Headers({ Authorization: authorization, Accept: "application/json, text/event-stream" });
    if (mcp) forwarded.set("Content-Type", "application/json");
    const version = request.headers.get("mcp-protocol-version");
    if (mcp && version && /^\d{4}-\d{2}-\d{2}$/.test(version)) forwarded.set("MCP-Protocol-Version", version);
    const response = await fetcher(`${AGENT_AUTHORITY}/site-api${path}${url.search}`, {
      method: request.method, headers: forwarded, body,
      redirect: "error", credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (response.status === 202 || response.status === 204) return new Response(null, { status: response.status, headers });
    if (!response.headers.get("content-type")?.startsWith("application/json")) return error(503, "temporarily_unavailable");
    const bytes = await bounded(response.body, 2_000_000);
    const data = JSON.parse(new TextDecoder().decode(bytes));
    const result = Response.json(data, { status: response.status, headers });
    if (response.status === 401) result.headers.set("WWW-Authenticate", challenge);
    if ([429, 503].includes(response.status)) result.headers.set("Retry-After", "60");
    return result;
  } catch { return error(503, "temporarily_unavailable"); }
  finally { active--; }
}
