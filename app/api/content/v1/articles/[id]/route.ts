import { publicCard, readArticle } from "@/lib/agents/content";
import { bodyMarkdown, publicFactCheck } from "@/lib/agents/markdown";
import { publicJson, unavailable } from "@/lib/agents/response";
import { publicReadGuard } from "@/lib/agents/read-guard";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const slot = publicReadGuard(request);
  if (slot instanceof Response) return slot;
  try {
    const article = await readArticle((await context.params).id);
    if (!article) return publicJson({ error: "Article not found" }, 404);
    return publicJson({ ...publicCard(article), publisher: "العلم", language: "ar",
      bodyMarkdown: bodyMarkdown(article.body),
      videoUrl: article.format === "videos" ? article.videoUrl : null,
      factCheck: publicFactCheck(article.factCheck) });
  } catch { return unavailable(); }
  finally { slot.release(); }
}
