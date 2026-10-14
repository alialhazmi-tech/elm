import { searchArticles } from "@/lib/agents/content";
import { publicJson, unavailable } from "@/lib/agents/response";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim();
  const page = params.get("page") ?? "1";
  if (!query || query.length > 200 || !/^(?:[1-9]|10)$/.test(page)) {
    return publicJson({ error: "q must contain 1–200 characters and page must be between 1 and 10" }, 400);
  }
  try { return publicJson(await searchArticles(query, Number(page))); }
  catch { return unavailable(); }
}
