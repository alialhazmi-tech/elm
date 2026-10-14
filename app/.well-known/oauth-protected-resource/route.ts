import { AGENT_AUTHORITY, AGENT_RESOURCE } from "@/lib/agents/access-gateway";

export function GET() {
  return Response.json({ resource: AGENT_RESOURCE, authorization_servers: [AGENT_AUTHORITY],
    scopes_supported: ["news:read"], bearer_methods_supported: ["header"],
    resource_name: "العلم — public news gateway", resource_documentation: `${AGENT_RESOURCE}/auth.md`,
  }, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*", "X-Robots-Tag": "noindex" } });
}
