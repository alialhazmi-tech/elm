"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon, RssIcon, UploadCloudIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { formatRiyadhDate, toLatinDigits } from "@/lib/format";

import { EpisodeForm } from "./episode-form";
import { ShowCover, VisibilityChip, episodeCount } from "./parts";
import { ShowForm } from "./show-form";
import type { AdminShow } from "./types";

type Action = { kind: "episode"; showId?: string } | { kind: "show" } | null;

export function PodcastsClient({ shows }: { shows: AdminShow[] }) {
  const router = useRouter();
  const [action, setAction] = useState<Action>(null);
  const [busy, setBusy] = useState(false);

  const total = shows.reduce((sum, show) => sum + show.rssCount + show.hostedCount - show.hiddenCount, 0);
  const hosted = shows.reduce((sum, show) => sum + show.hostedCount, 0);
  const latest = shows.filter((show) => show.latestAt).sort((a, b) => (b.latestAt ?? "").localeCompare(a.latestAt ?? ""))[0];

  function done(message: string) {
    toast.success(message);
    setAction(null);
    router.refresh();
  }

  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="font-display text-xl font-extrabold">البودكاست</h1>
          <p className="max-w-[70ch] text-xs leading-relaxed text-muted-foreground">
            البرامج هي الأساس. كل حلقة ترفعها هنا تظهر في صفحة برنامجها وفي <span dir="ltr">/podcasts</span> وفي التطبيق.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAction({ kind: "show" })}>
            <PlusIcon /> برنامج جديد
          </Button>
          <Button onClick={() => setAction({ kind: "episode" })} disabled={shows.length === 0}>
            <UploadCloudIcon /> رفع حلقة
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 border-y border-border/80 py-2.5 text-xs text-muted-foreground tabular-nums">
        <span><b className="text-sm text-foreground">{toLatinDigits(shows.length)}</b> برامج</span>
        <span><b className="text-sm text-foreground">{toLatinDigits(total)}</b> حلقة ظاهرة</span>
        <span><b className="text-sm text-foreground">{toLatinDigits(hosted)}</b> مرفوعة من اللوحة</span>
        {latest?.latestAt ? <span>آخر رفع: {formatRiyadhDate(latest.latestAt)} · {latest.name}</span> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shows.map((show) => (
          <article key={show.id} className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4">
            <div className="flex items-center gap-3">
              <ShowCover show={show} size={64} />
              <div className="grid min-w-0 flex-1 gap-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate font-display text-base font-bold">{show.name}</h2>
                  <VisibilityChip visible={show.visible} />
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">{episodeCount(show)}</p>
              </div>
            </div>
            <div className="grid gap-1 border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
              {show.feedUrl ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <RssIcon className="size-3.5" /> خلاصة RSS متصلة
                </span>
              ) : (
                <span>بلا خلاصة RSS — الحلقات من اللوحة فقط</span>
              )}
              <span className="flex min-w-0 gap-1">
                الصفحة العامة:
                <a href={show.publicPath} target="_blank" rel="noreferrer" dir="ltr" className="truncate text-foreground hover:underline">{decodeURI(show.publicPath)}</a>
              </span>
            </div>
            <div className="mt-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setAction({ kind: "episode", showId: show.id })}>
                <UploadCloudIcon /> حلقة جديدة
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/tahrir/podcasts/${show.id}`}>إدارة الحلقات</Link>
              </Button>
            </div>
          </article>
        ))}
        <button
          type="button"
          onClick={() => setAction({ kind: "show" })}
          className="grid min-h-48 place-items-center content-center gap-2 rounded-xl border-2 border-dashed border-input bg-card/50 p-4 text-center hover:border-foreground/40"
        >
          <span className="grid size-10 place-items-center rounded-full border border-input bg-card"><PlusIcon className="size-4" /></span>
          <b className="font-display text-sm">برنامج جديد</b>
          <span className="text-[11px] text-muted-foreground">اسم وغلاف ووصف، وله صفحته العامة</span>
        </button>
      </div>

      <Sheet open={action !== null} onOpenChange={(open) => (!open && !busy ? setAction(null) : null)}>
        <SheetContent side="left" className="overflow-y-auto data-[side=left]:w-full data-[side=left]:sm:max-w-md">
          {action?.kind === "episode" ? (
            <EpisodeForm key={action.showId ?? "any"} shows={shows} showId={action.showId} busy={busy} setBusy={setBusy} onDone={done} />
          ) : null}
          {action?.kind === "show" ? (
            <ShowForm busy={busy} setBusy={setBusy} onDone={(message, id) => {
              toast.success(message);
              setAction(null);
              router.push(`/tahrir/podcasts/${id}`);
            }} />
          ) : null}
        </SheetContent>
      </Sheet>
    </main>
  );
}
