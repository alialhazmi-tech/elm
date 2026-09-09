import { redirect } from "next/navigation";
import { loadActor } from "@/lib/tahrir/access";
import { loadTaxonomyVisibility } from "@/lib/content/taxonomy-settings";
import { TaxonomyClient } from "@/components/tahrir/taxonomy-client";

export const metadata = { title: "التصنيفات والأقسام" };
export const dynamic = "force-dynamic";

export default async function TaxonomyPage() {
  const actor = await loadActor();
  if (!actor?.can("ai.settings")) redirect("/tahrir");
  const visibility = await loadTaxonomyVisibility();
  return <main className="grid gap-4">
    <div><h1 className="font-display text-xl font-bold">التصنيفات والأقسام</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">تحكّم بظهور الأقسام والسلاسل في قوائم الموقع واختيارات المحرر والتوليد الذكي. تبقى المواد المنشورة وروابطها متاحة عند إخفاء تصنيفها.</p>
    </div>
    <TaxonomyClient initial={visibility} />
  </main>;
}
