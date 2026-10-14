import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createPublicMcpServer } from "@/lib/agents/mcp";
import { publicReadGuard } from "@/lib/agents/read-guard";
import { McpRequestError, readMcpRequest } from "@/lib/agents/mcp-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex",
  Link: '</mcp/server-card>; rel="describedby"; type="application/mcp-server-card+json"' };

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !["https://alelm.net", "https://www.alelm.net"].includes(origin)) {
    return Response.json({ error: "Origin not allowed" }, { status: 403, headers });
  }
  const slot = publicReadGuard(request);
  if (slot instanceof Response) return slot;
  const server = createPublicMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 16_384,
  });
  try {
    const parsedBody = await readMcpRequest(request);
    await server.connect(transport);
    const response = await transport.handleRequest(request, { parsedBody });
    // JSON-only transport resolves after its one result; no persistent sessions/SSE.
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
  } catch (error) {
    if (error instanceof McpRequestError) return Response.json({ jsonrpc: "2.0", id: null,
      error: { code: error.code, message: error.message } }, { status: error.status, headers });
    console.error("[agents] mcp_transport_failed");
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "Public content temporarily unavailable" } }, { status: 503, headers });
  } finally {
    slot.release();
    await server.close();
  }
}

export function GET() {
  return Response.json({ error: "Use Streamable HTTP POST; standalone SSE and sessions are not supported" }, {
    status: 405, headers: { ...headers, Allow: "POST" },
  });
}
export const DELETE = GET;
