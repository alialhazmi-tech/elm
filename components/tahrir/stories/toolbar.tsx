"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ARCHIVED_SERIES, SERIES } from "@/lib/content/series";

/** بحث بالعنوان (مؤجل 350ms) وتصفية بالسلسلة — كلاهما في الاستعلام حتى تبقى الروابط قابلة للمشاركة. */
export function StoriesToolbar({ q, series }: { q: string; series: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(q);
  const [pending, startTransition] = useTransition();

  const navigate = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, entry] of Object.entries(patch)) {
      if (entry) next.set(key, entry);
      else next.delete(key);
    }
    next.delete("p");
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    if (value.trim() === q) return;
    const timer = setTimeout(() => navigate({ q: value.trim() || null }), 350);
    return () => clearTimeout(timer);
    // navigate يعتمد على params/pathname وهما ثابتان أثناء الكتابة؛ إعادة الإنشاء تُلغي المؤقت بلا داعٍ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, q]);

  return (
    <div className="flex flex-wrap items-center gap-2" dir="rtl" aria-busy={pending}>
      <span role="status" className="sr-only">{pending ? "جارٍ تحديث قائمة المواد" : ""}</span>
      <div className="relative">
        <SearchIcon className={`${pending ? "motion-safe:animate-pulse" : ""} pointer-events-none absolute top-1/2 start-2.5 size-3.5 -translate-y-1/2 text-muted-foreground`} />
        <Input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="ابحث بالعنوان…"
          aria-label="بحث في المواد"
          className="h-8 w-52 bg-card ps-8 pe-7 text-xs sm:w-60"
        />
        {value ? (
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label="مسح البحث"
            className="absolute top-1/2 end-1 -translate-y-1/2"
            onClick={() => setValue("")}
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
      <Select value={series || "all"} onValueChange={(next) => navigate({ series: next === "all" ? null : next })}>
        <SelectTrigger size="sm" className="h-8 w-36 bg-card text-xs" aria-label="تصفية بالسلسلة">
          <SelectValue placeholder="كل السلاسل" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="all">كل السلاسل</SelectItem>
          <SelectGroup>
            <SelectLabel>السلاسل</SelectLabel>
            {SERIES.map((item) => (
              <SelectItem key={item.slug} value={item.slug}>
                <span className="size-2 shrink-0 rounded-[2px]" style={{ background: item.color }} />
                {item.name}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>متقاعدة</SelectLabel>
            {ARCHIVED_SERIES.map((item) => (
              <SelectItem key={item.slug} value={item.slug}>
                <span className="size-2 shrink-0 rounded-[2px]" style={{ background: item.color }} />
                {item.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
