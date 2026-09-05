import { seedContentProvider } from "@/lib/content/provider";
import { storyHref } from "@/lib/content/types";

/** روابط المشاركة القديمة /القسم/المعرّف تحسمها المادة المنشورة، حتى لو تغيّر قسمها. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ section: string; id: string }> },
) {
  const { id } = await params;
  // لا نسمح لمعرّف طويل بالتحول إلى مادة أخرى عند اقتطاعه داخل مزود المحتوى.
  const story = /^[A-Za-z0-9_-]{1,64}$/u.test(id)
    ? await seedContentProvider.getStory(id)
    : null;
  if (!story) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return new Response(null, {
    status: 301,
    headers: {
      Location: encodeURI(storyHref(story)) + new URL(request.url).search,
      "Cache-Control": "public, max-age=300",
    },
  });
}

export const HEAD = GET;
