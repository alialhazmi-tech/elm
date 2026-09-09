"use client";
import { useState } from "react";
import { EyeIcon, MonitorIcon, SmartphoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { looksLikeHtml, sanitizeBodyHtml, textToHtml } from "@/lib/content/html";

type Draft = { title: string; excerpt: string; body: string; image: string; section: string };
const checks = ["راجعت دقة العنوان والأسماء والأرقام", "تحققت من المصادر وروابطها", "راجعت الصورة وحقوق استخدامها"];
export function ArticlePreview({ getDraft }: { getDraft: () => Draft }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [mobile, setMobile] = useState(false);
  const [checked, setChecked] = useState<boolean[]>([]);
  return <Dialog onOpenChange={open => { if (open) { setDraft(getDraft()); setChecked([]); } }}>
    <DialogTrigger asChild><Button size="sm" variant="ghost" data-tour="preview"><EyeIcon />معاينة ومراجعة</Button></DialogTrigger>
    <DialogContent className="sm:max-w-5xl" dir="rtl">
      <DialogHeader><DialogTitle>معاينة المحتوى قبل النشر</DialogTitle><DialogDescription>تعرض كتابتك الحالية، بما فيها التعديلات غير المحفوظة. راجع الوسائط التفاعلية في صفحة الموقع بعد النشر.</DialogDescription></DialogHeader>
      <div className="flex gap-2"><Button size="sm" variant={mobile ? "outline" : "secondary"} aria-pressed={!mobile} onClick={() => setMobile(false)}><MonitorIcon />كمبيوتر</Button><Button size="sm" variant={mobile ? "secondary" : "outline"} aria-pressed={mobile} onClick={() => setMobile(true)}><SmartphoneIcon />جوال</Button></div>
      <div className="rounded-xl bg-muted p-2 sm:p-4"><article className={`mx-auto w-full rounded-lg bg-background p-5 text-foreground ${mobile ? "max-w-[390px]" : "max-w-[850px] sm:p-10"}`}>
        <p className="mb-3 text-sm text-muted-foreground">{draft?.section}</p><h2 className="font-display text-2xl leading-relaxed font-bold">{draft?.title || "عنوان المادة"}</h2>
        <p className="my-4 text-lg leading-relaxed text-muted-foreground">{draft?.excerpt}</p>
        {/* The unsaved image may be a local upload; preview it directly. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {draft?.image && <img src={draft.image} alt="الصورة الرئيسية للمادة" className="my-5 aspect-video w-full rounded-lg object-cover" />}
        <div className="article-html text-base leading-loose [&_h2]:my-5 [&_h2]:text-xl [&_h3]:my-4 [&_h3]:font-bold [&_p]:my-4 [&_ul]:list-inside [&_ul]:list-disc [&_ol]:list-inside [&_ol]:list-decimal [&_a]:underline" dangerouslySetInnerHTML={{ __html: sanitizeBodyHtml(looksLikeHtml(draft?.body ?? "") ? draft?.body ?? "" : textToHtml(draft?.body ?? "")) }} />
      </article></div>
      <fieldset className="space-y-2 rounded-lg border p-4"><legend className="px-2 font-semibold">مراجعة بشرية أخيرة</legend>{checks.map((label, index) => <label key={label} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked[index] ?? false} onChange={e => setChecked(current => checks.map((_, i) => i === index ? e.target.checked : !!current[i]))} className="size-4 accent-current" />{label}</label>)}<p className="pt-2 text-xs text-muted-foreground">قائمة تذكير لهذه المعاينة، ولا تستبدل فحوصات النشر. أضف المصادر إلى ملاحظات المراجعة لحفظها مع المادة.</p></fieldset>
    </DialogContent>
  </Dialog>;
}
