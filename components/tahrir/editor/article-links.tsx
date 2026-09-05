"use client";

import { useState, useSyncExternalStore } from "react";
import { CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
const subscribe = () => () => {};

export function ArticleLinks({ identity, editorId, published, dirty }: {
  identity: { id: string; section: string; slug: string } | null;
  editorId: string; published: boolean; dirty: boolean;
}) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const [notice, setNotice] = useState<{ text: string; url: string } | null>(null);
  const publicUrl = origin && identity ? `${origin}/${encodeURIComponent(identity.section)}/${encodeURIComponent(identity.id)}/${encodeURIComponent(identity.slug)}` : "";
  const editorUrl = origin && editorId ? `${origin}/tahrir/editor/${encodeURIComponent(editorId)}` : "";
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setNotice({ text: "نُسخ الرابط.", url }); }
    catch { setNotice({ text: "تعذّر النسخ؛ حدّد الرابط وانسخه يدويًا.", url }); }
  }
  return <div className="grid gap-3 border-b bg-muted/20 px-5 py-3" aria-label="روابط المادة">
    <div className="text-xs font-semibold">معاينة الرابط ومشاركته</div>
    {[["رابط المادة", publicUrl], ["رابط المحرر للزملاء", editorUrl]].map(([label, url]) => <div key={label} className="grid gap-1">
      <label className="text-[11px] text-muted-foreground" htmlFor={label === "رابط المادة" ? "article-public-link" : "article-editor-link"}>{label}</label>
      <div className="flex min-w-0 items-center gap-2">
        <input id={label === "رابط المادة" ? "article-public-link" : "article-editor-link"} readOnly dir="ltr" value={url} placeholder="يظهر الرابط بعد حفظ المسودة" onFocus={event => event.target.select()} className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 text-xs" />
        <Button type="button" size="xs" variant="outline" disabled={!url || (label === "رابط المادة" && dirty && !published)} onClick={() => void copy(url)} aria-label={`نسخ ${label}`}><CopyIcon className="size-3.5" />نسخ</Button>
      </div>
    </div>)}
    <p className="text-[11px] text-muted-foreground">{published ? "رابط المادة متاح للقرّاء." : dirty ? "انتظر تأكيد الحفظ قبل نسخ رابط المادة. الرابط العام يعمل بعد النشر." : "الرابط العام يعمل بعد النشر. رابط المحرر يتطلب دخول الزميل وصلاحية التحرير."}</p>
    {notice && [publicUrl, editorUrl].includes(notice.url) && <p role="status" className="text-xs">{notice.text}</p>}
  </div>;
}
