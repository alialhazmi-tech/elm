"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon, FileAudioIcon, PencilIcon, RssIcon, Settings2Icon, UploadCloudIcon } from "lucide-react";
import { toast } from "sonner";

import { SegmentedFilter } from "@/components/tahrir/segmented-filter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRiyadhDate, toLatinDigits } from "@/lib/format";
import { formatPodcastDuration } from "@/lib/podcasts";
import { apiCall } from "@/lib/tahrir/client-api";
import { cn } from "@/lib/utils";

import { EpisodeForm } from "./episode-form";
import { ShowCover, VisibilityChip } from "./parts";
import { ShowForm } from "./show-form";
import type { AdminEpisode, AdminShow, FeedEpisode, ShowOption } from "./types";

type Filter = "all" | "hosted" | "feed" | "hidden";
type Row =
  | { source: "hosted"; key: string; title: string; guest: string; duration: string | null; publishedAt: string; episode: AdminEpisode }
  | { source: "feed"; key: string; title: string; guest: string; duration: string | null; publishedAt: string | null };
type Action = { kind: "new" } | { kind: "edit"; episode: AdminEpisode } | { kind: "settings" } | null;

const HEAD = "font-display text-xs font-semibold text-muted-foreground";

export function ShowClient({
  show,
  shows,
  episodes,
  feed,
}: {
  show: AdminShow;
  shows: ShowOption[];
  episodes: AdminEpisode[];
  feed: FeedEpisode[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [action, setAction] = useState<Action>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const hosted: Row[] = episodes.map((episode) => ({
      source: "hosted",
      key: episode.id,
      title: episode.title,
      guest: episode.guest,
      duration: episode.durationSeconds ? formatPodcastDuration(String(episode.durationSeconds)) : null,
      publishedAt: episode.publishedAt,
      episode,
    }));
    const fromFeed: Row[] = feed.map((episode) => ({
      source: "feed",
      key: episode.audioUrl,
      title: episode.title,
      guest: episode.guest ?? "",
      duration: formatPodcastDuration(episode.duration),
      publishedAt: episode.publishedAt,
    }));
    return [...hosted, ...fromFeed].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  }, [episodes, feed]);

  const hidden = episodes.filter((episode) => !episode.visible).length;
  const shown = rows.filter((row) =>
    filter === "all" ? true
      : filter === "hosted" ? row.source === "hosted"
        : filter === "feed" ? row.source === "feed"
          : row.source === "hosted" && !row.episode.visible,
  );

  function done(message: string) {
    toast.success(message);
    setAction(null);
    router.refresh();
  }

  async function toggle(episode: AdminEpisode) {
    setBusy(true);
    const result = await apiCall(`/api/tahrir/podcasts/episodes/${episode.id}`, { method: "PATCH", body: { visible: !episode.visible } }, { fallback: "تعذر التغيير." });
    setBusy(false);
    if (result.ok) done(episode.visible ? "أُخفيت الحلقة من الموقع والتطبيق." : "ظهرت الحلقة من جديد.");
    else toast.error(result.error);
  }

  return (
    <main className="flex flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card p-4 sm:flex-row sm:items-center">
        <ShowCover show={show} size={88} />
        <div className="grid min-w-0 flex-1 gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-xl font-extrabold">{show.name}</h1>
            <VisibilityChip visible={show.visible} />
          </div>
          {show.description ? <p className="text-xs leading-relaxed text-muted-foreground">{show.description}</p> : null}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {show.feedUrl ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400" dir="ltr">
                <RssIcon className="size-3.5" /> {new URL(show.feedUrl).host + new URL(show.feedUrl).pathname.replace(/\/feed\.xml$/, "")}
              </span>
            ) : (
              <span>بلا خلاصة RSS</span>
            )}
            <span className="flex gap-1">الصفحة: <a href={show.publicPath} target="_blank" rel="noreferrer" dir="ltr" className="text-foreground hover:underline">{decodeURI(show.publicPath)}</a></span>
          </div>
        </div>
        <div className="flex gap-2 sm:flex-col">
          <Button onClick={() => setAction({ kind: "new" })}><UploadCloudIcon /> رفع حلقة</Button>
          <Button variant="outline" onClick={() => setAction({ kind: "settings" })}><Settings2Icon /> إعدادات البرنامج</Button>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold">الحلقات</h2>
        <SegmentedFilter
          ariaLabel="تصفية الحلقات"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "all", label: "الكل", count: rows.length },
            { value: "hosted", label: "مرفوعة", count: episodes.length },
            { value: "feed", label: "من الخلاصة", count: feed.length },
            { value: "hidden", label: "مخفية", count: hidden },
          ]}
        />
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {shown.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            {filter === "hidden" ? "لا حلقات مخفية." : "لا حلقات هنا بعد — ارفع أول حلقة."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/80 bg-muted/20 hover:bg-muted/20">
                <TableHead className={HEAD}>الحلقة</TableHead>
                <TableHead className={cn(HEAD, "hidden md:table-cell")}>الضيف</TableHead>
                <TableHead className={cn(HEAD, "hidden sm:table-cell")}>المدة</TableHead>
                <TableHead className={cn(HEAD, "hidden lg:table-cell")}>التاريخ</TableHead>
                <TableHead className={HEAD}>المصدر</TableHead>
                <TableHead className={cn(HEAD, "text-end")}><span className="sr-only">إجراءات</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((row) => (
                <TableRow key={row.key} className={cn(row.source === "hosted" && !row.episode.visible && "opacity-60")}>
                  <TableCell className="max-w-[28rem]">
                    <div className="truncate text-[13px] font-semibold">{row.title}</div>
                    <div className="truncate text-[11px] text-muted-foreground md:hidden">{[row.guest, row.duration ? toLatinDigits(row.duration) : ""].filter(Boolean).join(" · ")}</div>
                  </TableCell>
                  <TableCell className="hidden text-xs md:table-cell">{row.guest || "—"}</TableCell>
                  <TableCell className="hidden text-xs tabular-nums sm:table-cell" dir="ltr">{row.duration ? toLatinDigits(row.duration) : "—"}</TableCell>
                  <TableCell className="hidden text-xs lg:table-cell">{row.publishedAt ? formatRiyadhDate(row.publishedAt) : "—"}</TableCell>
                  <TableCell>
                    {row.source === "hosted" ? (
                      <span className="inline-flex h-5 items-center gap-1 rounded-md bg-blue-500/10 px-1.5 text-[11px] font-semibold text-blue-800 dark:text-blue-300">
                        <FileAudioIcon className="size-3" /> {row.episode.visible ? "مرفوعة" : "مخفية"}
                      </span>
                    ) : (
                      <span className="inline-flex h-5 items-center gap-1 rounded-md bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
                        <RssIcon className="size-3" /> الخلاصة
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    {row.source === "hosted" ? (
                      <div className="flex justify-end gap-1">
                        <Button size="icon-xs" variant="outline" aria-label="تعديل الحلقة" onClick={() => setAction({ kind: "edit", episode: row.episode })}>
                          <PencilIcon />
                        </Button>
                        <Button size="icon-xs" variant="outline" disabled={busy} aria-label={row.episode.visible ? "إخفاء الحلقة" : "إظهار الحلقة"} onClick={() => void toggle(row.episode)}>
                          {row.episode.visible ? <EyeOffIcon /> : <EyeIcon />}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">تُدار في RSS.com</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Sheet open={action !== null} onOpenChange={(open) => (!open && !busy ? setAction(null) : null)}>
        <SheetContent side="left" className="overflow-y-auto data-[side=left]:w-full data-[side=left]:sm:max-w-md">
          {action?.kind === "new" ? <EpisodeForm shows={shows} showId={show.id} busy={busy} setBusy={setBusy} onDone={done} /> : null}
          {action?.kind === "edit" ? <EpisodeForm key={action.episode.id} shows={shows} editing={action.episode} busy={busy} setBusy={setBusy} onDone={done} /> : null}
          {action?.kind === "settings" ? <ShowForm editing={show} busy={busy} setBusy={setBusy} onDone={(message) => done(message)} /> : null}
        </SheetContent>
      </Sheet>
    </main>
  );
}
