"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { apiCall } from "@/lib/tahrir/client-api";
import { TAXONOMY_SECTIONS, TAXONOMY_SERIES, taxonomyHidden, taxonomyKey, type TaxonomyKind, type TaxonomyVisibility } from "@/lib/content/taxonomy";

export function TaxonomyClient({ initial }: { initial: TaxonomyVisibility }) {
  const router = useRouter();
  const [visibility, setVisibility] = useState(initial);
  const [pending, setPending] = useState<string | null>(null);
  async function toggle(kind: TaxonomyKind, slug: string, hidden: boolean) {
    if (pending) return;
    setPending(taxonomyKey(kind, slug));
    const result = await apiCall("/api/tahrir/taxonomy", { method: "PATCH", body: { kind, slug, hidden } }, { fallback: "تعذر حفظ الظهور." });
    setPending(null);
    if (!result.ok) { toast.error(result.error); return; }
    setVisibility(current => ({ ...current, [taxonomyKey(kind, slug)]: hidden }));
    toast.success(hidden ? "أُخفي التصنيف من القوائم والتوليد." : "أُظهر التصنيف في القوائم والتوليد.");
    router.refresh();
  }
  return <div className="grid gap-4 lg:grid-cols-2">
    {([{ kind: "section", title: "الأقسام", items: TAXONOMY_SECTIONS }, { kind: "series", title: "السلاسل والتصنيفات", items: TAXONOMY_SERIES }] as const).map(group => (
      <section key={group.kind} className="overflow-hidden rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 font-semibold">{group.title}</h2>
        {group.items.map(item => {
          const hidden = taxonomyHidden(visibility, group.kind, item.slug);
          const fixed = group.kind === "section" && item.slug === "news";
          return <div key={item.slug} className="flex items-center justify-between gap-4 border-b px-4 py-3 last:border-0">
            <div><p className="text-sm font-medium">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{fixed ? "قسم عام — ظاهر دائمًا" : hidden ? "مخفي من القوائم والتوليد" : "ظاهر في القوائم والتوليد"}</p></div>
            <Switch aria-label={`إظهار ${item.name}`} checked={!hidden} disabled={fixed || pending !== null} onCheckedChange={checked => void toggle(group.kind, item.slug, !checked)} />
          </div>;
        })}
      </section>
    ))}
  </div>;
}
