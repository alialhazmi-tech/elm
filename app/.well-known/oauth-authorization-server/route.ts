import { AGENT_AUTHORITY } from "@/lib/agents/access-gateway";

/** Delegate to the actual issuer; never publish metadata claiming a different issuer here. */
export function GET() {
  return new Response(null, { status: 307, headers: {
    Location: `${AGENT_AUTHORITY}/.well-known/oauth-authorization-server`,
    "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*", "X-Robots-Tag": "noindex",
  } });
}
