import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/tahrir/access";
import { audit } from "@/lib/tahrir/service";
import { setTaxonomyHidden } from "@/lib/content/taxonomy-settings";
import { TAXONOMY_SECTIONS, TAXONOMY_SERIES } from "@/lib/content/taxonomy";
import { revalidatePublicContent } from "@/lib/tahrir/revalidatePublic";

export async function PATCH(request: Request) {
  const gate = await requirePermission("ai.settings", "إظهار التصنيفات وإخفاؤها من صلاحية رئيس التحرير.");
  if (!gate.ok) return gate.response;
  const input = await request.json().catch(() => null);
  if (!input || !["section", "series"].includes(input.kind) || typeof input.slug !== "string" || typeof input.hidden !== "boolean") {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  const catalog = input.kind === "section" ? TAXONOMY_SECTIONS : TAXONOMY_SERIES;
  if (!catalog.some(item => item.slug === input.slug) || (input.kind === "section" && input.slug === "news" && input.hidden)) {
    return NextResponse.json({ error: "تصنيف غير صالح أو محاولة إخفاء قسم أخبار العام." }, { status: 400 });
  }
  await setTaxonomyHidden(input.kind, input.slug, input.hidden);
  await audit(gate.actor.username, input.hidden ? "taxonomy:hide" : "taxonomy:show", undefined, `${input.kind}:${input.slug}`);
  revalidatePublicContent();
  revalidatePath("/", "layout");
  revalidatePath("/tahrir/editor/[id]", "page");
  revalidatePath("/tahrir/taxonomy");
  return NextResponse.json({ ok: true });
}
