"use client";

import { getSectionName } from "@/lib/content/sections";
import { SERIES } from "@/lib/content/series";

import { useState } from "react";
import { ArchiveIcon, ArchiveRestoreIcon, ImagePlusIcon, PinIcon, VideoIcon, ZapIcon, ZapOffIcon } from "lucide-react";

import { GuardChip } from "@/components/tahrir/badges";
import { ArchiveDialog, ConfirmDialog, type StoryAction } from "@/components/tahrir/stories/story-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { instagramPostUrlFrom, normalizeVideoUrl, xPostIdFrom } from "@/lib/content/video";
import { formatRiyadhDateTime, formatRiyadhTime, riyadhWallTimeToIso } from "@/lib/tahrir/riyadh-time";
import { VideoPlayer } from "@/components/content/video-player";
import { cn } from "@/lib/utils";

export interface DetailsPanelProps {
  id: string;
  identityLocked: boolean;
  title: string;
  status: string;
  canApprove: boolean;
  gateOpen: boolean;
  busy: boolean;
  formats: Array<[string, string]>;
  format: string;
  onFormat: (value: string) => void;
  series: Array<{ slug: string; name: string; color: string }>;
  seriesSlug: string | null;
  onSeries: (value: string | null) => void;
  sections: Array<[string, string]>;
  section: string;
  onSection: (value: string) => void;
  image: string;
  onImage: (value: string) => void;
  onPickImage: () => void;
  imageUploadBusy: boolean;
  imageUploadMessage: string;
  requireImageRights: boolean;
  recentMedia: Array<{ url: string; filename: string }>;
  slug: string;
  onSlug: (value: string) => void;
  videoUrl: string;
  onVideoUrl: (value: string) => void;
  pinned: boolean;
  onPinned: (value: boolean) => void;
  breakingUntil: string | null;
  onBreaking: (iso: string | null) => void;
  /** قيمة datetime-local تُفسَّر بتوقيت الرياض. */
  scheduleAt: string;
  onScheduleAt: (value: string) => void;
  onSchedule: () => void;
  /** يُستدعى قبل فتح حوار الأرشفة؛ false يمنعه (تعديلات غير محفوظة مثلًا). */
  beforeArchive?: () => boolean;
  onArchived: () => void;
  onRestored: () => void;
}

function hoursAhead(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-2 border-t p-3 first:border-t-0", className)}>
      <div className="text-[11px] font-semibold text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

/** تبويب التفاصيل: التصنيف والصورة والرابط، ولأصحاب الصلاحية أدوات الإبراز والجدولة والأرشفة. */
export function DetailsPanel(props: DetailsPanelProps) {
  const [action, setAction] = useState<StoryAction | null>(null);
  const editable = props.status !== "published" && props.status !== "archived";
  const scheduleIso = props.scheduleAt ? riyadhWallTimeToIso(props.scheduleAt) : null;

  return (
    <div className="grid text-right" dir="rtl">
      {props.canApprove ? (
        <>
          {props.status !== "archived" ? (
            <Section title="إبراز المادة">
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={props.pinned} onCheckedChange={props.onPinned} aria-label="تثبيت في صدارة الرئيسية" />
                <PinIcon className="size-3.5 text-muted-foreground" />
                {props.pinned ? "مثبتة في صدارة الرئيسية" : "تثبيت في صدارة الرئيسية"}
              </label>
              {props.breakingUntil ? (
                <div className="flex flex-wrap items-center gap-2">
                  <GuardChip tone="block" label={`عاجل حتى ${formatRiyadhTime(props.breakingUntil) || props.breakingUntil} (الرياض)`} />
                  <Button size="xs" variant="outline" onClick={() => props.onBreaking(null)}>
                    <ZapOffIcon data-icon="inline-start" />
                    أنهِ العاجل
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <Button size="xs" variant="outline" onClick={() => props.onBreaking(hoursAhead(2))}>
                    <ZapIcon data-icon="inline-start" />
                    عاجل لساعتين
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => props.onBreaking(hoursAhead(6))}>
                    عاجل لست ساعات
                  </Button>
                </div>
              )}
            </Section>
          ) : null}
          <Section title="النشر والجدولة">
            {editable ? (
              <div className="grid gap-1.5">
                <label htmlFor="story-schedule-at" className="text-[10.5px] text-muted-foreground">موعد النشر — بتوقيت الرياض</label>
                <div className="flex gap-1.5">
                  <Input
                    id="story-schedule-at"
                    type="datetime-local"
                    dir="ltr"
                    value={props.scheduleAt}
                    onChange={(event) => props.onScheduleAt(event.target.value)}
                    aria-label="موعد الجدولة بتوقيت الرياض"
                    aria-describedby="story-schedule-resolved"
                    className="min-w-0 flex-1"
                  />
                  <Button size="sm" variant="outline" onClick={props.onSchedule} disabled={!props.gateOpen || props.busy}>
                    {props.status === "scheduled" ? "تعديل الموعد" : "جدولة"}
                  </Button>
                </div>
                <div id="story-schedule-resolved" className="text-[10.5px] text-muted-foreground" aria-live="polite">
                  {scheduleIso ? `يُنشر ${formatRiyadhDateTime(scheduleIso)} بتوقيت الرياض` : props.scheduleAt ? "الموعد غير صالح." : "الوقت الذي تدخله يُحفظ كما هو بتوقيت الرياض مهما كان توقيت جهازك."}
                </div>
              </div>
            ) : null}
            {props.id && props.status !== "draft" && props.status !== "archived" ? (
              <Button
                size="xs"
                variant="outline"
                className="justify-self-start"
                onClick={() => {
                  if (props.beforeArchive && !props.beforeArchive()) return;
                  setAction({ kind: "archive", rows: [{ id: props.id, title: props.title || "هذه المادة" }] });
                }}
              >
                <ArchiveIcon data-icon="inline-start" />
                أرشفة المادة
              </Button>
            ) : null}
            {props.id && props.status === "archived" ? (
              <Button
                size="xs"
                variant="outline"
                className="justify-self-start"
                onClick={() => setAction({ kind: "restore", rows: [{ id: props.id, title: props.title || "هذه المادة" }] })}
              >
                <ArchiveRestoreIcon data-icon="inline-start" />
                استعادة كمسودة
              </Button>
            ) : null}
          </Section>
        </>
      ) : null}

      <Section title="الشكل">
        <div className="flex flex-wrap gap-1.5">
          {props.formats.filter(([value]) => value !== "videos").map(([value, name]) => (
            <Button key={value} size="xs" variant={props.format === value ? "default" : "outline"} onClick={() => props.onFormat(value)}>
              {name}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="الفيديو">
        <label htmlFor="story-video-toggle" className="flex cursor-pointer items-start gap-2.5 rounded-md border bg-muted/20 p-2.5 text-xs">
          <Switch
            id="story-video-toggle"
            checked={props.format === "videos"}
            onCheckedChange={(checked) => props.onFormat(checked ? "videos" : "news")}
            aria-label="تفعيل فيديو للمادة"
            aria-controls="story-video-fields"
            aria-expanded={props.format === "videos"}
          />
          <VideoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="grid gap-0.5">
            <b className="font-display text-[12.5px]">تفعيل فيديو للمادة</b>
            <span className="text-[10.5px] leading-relaxed text-muted-foreground">
              يعرض المشغّل أسفل عنوان المادة؛ المصدر يوتيوب أو فيديو تغريدة أو منشور إنستقرام عام.
            </span>
          </span>
        </label>

        {props.format === "videos" ? (
          <div id="story-video-fields" className="grid gap-2">
            <Input
              dir="ltr"
              placeholder="رابط يوتيوب أو تغريدة X أو منشور إنستقرام"
              aria-label="رابط الفيديو"
              value={props.videoUrl}
              onChange={(event) => props.onVideoUrl(event.target.value)}
              aria-invalid={props.videoUrl.trim() !== "" && !normalizeVideoUrl(props.videoUrl)}
            />
            {props.videoUrl.trim() && !normalizeVideoUrl(props.videoUrl) ? (
              <div className="text-[11px] text-(--t-block)">أدخل رابط يوتيوب أو تغريدة من x.com أو twitter.com أو فيديو/ريلز إنستقرام صحيح.</div>
            ) : !props.videoUrl.trim() ? (
              <div className="text-[11px] text-muted-foreground">ألصق رابط يوتيوب أو تغريدة عامة تحتوي على فيديو، أو رابط منشور إنستقرام عام يسمح بالتضمين.</div>
            ) : null}
            {normalizeVideoUrl(props.videoUrl) ? (
              <VideoPlayer url={props.videoUrl} title="معاينة الفيديو" />
            ) : null}
            <div className="text-[10px] text-muted-foreground">
              يُحفظ الرابط بصيغته القياسية دون معلمات التتبع.
              {instagramPostUrlFrom(props.videoUrl)
                ? " يجب أن يكون منشور إنستقرام عامًا ومسموحًا بتضمينه؛ قد يظهر معه إطار المنشور وعناصره."
                : xPostIdFrom(props.videoUrl)
                  ? " لإظهار التغريدة كاملة داخل المادة، استخدم «إدراج تغريدة» في أدوات المتن."
                  : null}
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="السلسلة">
        {props.seriesSlug && !props.series.some(item => item.slug === props.seriesSlug) && <p className="mb-2 text-xs text-muted-foreground">التصنيف الحالي: {SERIES.find(item => item.slug === props.seriesSlug)?.name ?? props.seriesSlug} (مخفي)</p>}
        <div className="flex flex-wrap gap-1.5">
          {props.series.map((item) => {
            const active = props.seriesSlug === item.slug;
            return (
              <button
                key={item.slug}
                type="button"
                aria-pressed={active}
                onClick={() => props.onSeries(active ? null : item.slug)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent",
                  active && "border-transparent font-semibold text-white",
                )}
                style={active ? { background: item.color } : undefined}
              >
                {!active ? <i aria-hidden className="size-2 rounded-[2px]" style={{ background: item.color }} /> : null}
                {item.name}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="القسم">
        <Select dir="rtl" disabled={props.identityLocked} value={props.section} onValueChange={props.onSection}>
          <SelectTrigger className="w-full" aria-label="القسم">
            <SelectValue placeholder={getSectionName(props.section)} />
          </SelectTrigger>
          <SelectContent>
            {props.sections.map(([value, name]) => (
              <SelectItem key={value} value={value}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Section>

      <Section title="صورة المادة">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs" variant="outline" onClick={props.onPickImage} disabled={props.imageUploadBusy}>
            <ImagePlusIcon data-icon="inline-start" />
            {props.imageUploadBusy ? "يرفع…" : "رفع صورة"}
          </Button>
          <span className="text-[10.5px] text-muted-foreground">حتى 8 ميغابايت · <span dir="ltr">PNG / JPEG / WebP</span></span>
        </div>
        {props.imageUploadMessage ? <div role="status" className="text-[11px] text-muted-foreground">{props.imageUploadMessage}</div> : null}
        <Input dir="ltr" placeholder="/uploads/… أو رابط خارجي" value={props.image} onChange={(event) => props.onImage(event.target.value)} />
        {props.image ? (
          <div className="grid gap-1.5">
            {/* مسار ديناميكي من المكتبة؛ المعاينة تعرض الأصل مباشرة. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={props.image} alt="معاينة صورة المادة" className="aspect-video w-full rounded-md border object-cover" />
            <Button size="xs" variant="ghost" className="justify-self-start" onClick={() => props.onImage("")}>
              إزالة الصورة
            </Button>
          </div>
        ) : null}
        {props.recentMedia.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {props.recentMedia.map((item) => (
              <button
                key={item.url}
                type="button"
                title={item.filename}
                onClick={() => props.onImage(item.url)}
                className={cn(
                  "h-9 w-12 overflow-hidden rounded-md border-2 border-transparent",
                  props.image === item.url && "border-primary",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.filename} className="size-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
        <div className="text-[10px] text-muted-foreground">
          {props.requireImageRights
            ? "المصغرات من المكتبة موثقة الحقوق فقط — صورة غير موثقة تمنع النشر (§12)."
            : "اشتراط توثيق الحقوق معطّل من إعدادات النظام — تبقى مسؤولية المحرر عن الحقوق قائمة."}
        </div>
      </Section>

      <Section title="الرابط (لاتيني)">
        <Input dir="ltr" placeholder="my-story-slug" readOnly={props.identityLocked} value={props.slug} onChange={(event) => props.onSlug(event.target.value)} />
      </Section>

      <ArchiveDialog
        action={action}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          props.onArchived();
        }}
      />
      <ConfirmDialog
        action={action}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          props.onRestored();
        }}
      />
    </div>
  );
}
