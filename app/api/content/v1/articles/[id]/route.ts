import { publicCard, readArticle } from "@/lib/agents/content";
import { bodyMarkdown, publicFactCheck } from "@/lib/agents/markdown";
import { publicJson, unavailable } from "@/lib/agents/response";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const article = await readArticle((await context.params).id);
    if (!article) return publicJson({ error: "Article not found" }, 404);
    return publicJson({ ...publicCard(article), publisher: "العلم", language: "ar",
      bodyMarkdown: bodyMarkdown(article.body),
      videoUrl: article.format === "videos" ? article.videoUrl : null,
      factCheck: publicFactCheck(article.factCheck) });
  } catch { return unavailable(); }
}
