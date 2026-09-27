import { toLatinDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { AdminShow } from "./types";

/** غلاف البرنامج، وإلا مربع بلونه واسمه. */
export function ShowCover({ show, size }: { show: Pick<AdminShow, "name" | "cover" | "accent">; size: number }) {
  return (
    <span
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-lg font-display font-extrabold text-white"
      style={{ width: size, height: size, background: show.accent, fontSize: Math.round(size / 4) }}
    >
      {show.cover ? (
        // eslint-disable-next-line @next/next/no-img-element -- مصغر في اللوحة لا يحتاج المحسّن.
        <img src={show.cover} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        show.name
      )}
    </span>
  );
}

export function VisibilityChip({ visible }: { visible: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-semibold",
        visible ? "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300" : "bg-muted text-muted-foreground",
      )}
    >
      {visible ? "ظاهر" : "مخفي"}
    </span>
  );
}

function count(n: number): string {
  return `${toLatinDigits(n)} ${n >= 3 && n <= 10 ? "حلقات" : "حلقة"}`;
}

/** «26 حلقة · 23 من الخلاصة · 3 مرفوعة». */
export function episodeCount(show: Pick<AdminShow, "rssCount" | "hostedCount" | "hiddenCount">): string {
  const visibleHosted = show.hostedCount - show.hiddenCount;
  const parts = [count(show.rssCount + visibleHosted)];
  if (show.rssCount) parts.push(`${toLatinDigits(show.rssCount)} من الخلاصة`);
  if (show.hostedCount) parts.push(`${toLatinDigits(show.hostedCount)} مرفوعة`);
  return parts.join(" · ");
}
