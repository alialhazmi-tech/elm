import { publicJson } from "@/lib/agents/response";

export function GET() {
  return publicJson({ name: "العلم — Public Content API", version: "1",
    documentation: "https://alelm.net/docs/content-api.md", specification: "https://alelm.net/openapi.json",
    operations: ["GET /api/content/v1/search?q={query}&page={page}", "GET /api/content/v1/articles/{id}"],
    authentication: "none", access: "published-content-read-only" });
}
