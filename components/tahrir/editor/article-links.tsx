"use client";

import { useState, useSyncExternalStore } from "react";
import { CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
const subscribe = () => () => {};

export function ArticleLinks({ identity, published, dirty }: {
  identity: { id: string; section: string; slug: string } | null;
  published: boolean; dirty: boolean;
}) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const [notice, setNotice] = useState<{ text: string; url: string } | null>(null);
  const publicUrl = origin && identity ? `${origin}/${encodeURIComponent(identity.section)}/${encodeURIComponent(identity.id)}/${encodeURIComponent(identity.slug)}` : "";
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setNotice({ text: "نُسخ الرابط.", url }); }
    catch { setNotice({ text: "تعذّر النسخ؛ حدّد الرابط وانسخه يدويًا.", url }); }
  }
  return <div className="grid gap-3 border-b bg-muted/20 px-5 py-3" aria-label="روابط المادة">
    <div className="text-xs font-semibold">معاينة الرابط ومشاركته</div>
    <div className="grid gap-1">
      <label className="text-[11px] text-muted-foreground" htmlFor="article-public-link">رابط المادة</label>
      <div className="flex min-w-0 items-center gap-2">
        <input id="article-public-link" readOnly dir="ltr" value={publicUrl} placeholder="يظهر الرابط بعد حفظ المسودة" onFocus={event => event.target.select()} className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 text-xs" />
        <Button type="button" size="xs" variant="outline" disabled={!publicUrl || (dirty && !published)} onClick={() => void copy(publicUrl)} aria-label="نسخ رابط المادة"><CopyIcon className="size-3.5" />نسخ</Button>
      </div>
    </div>
    <p className="text-[11px] text-muted-foreground">{published ? "رابط المادة متاح للقرّاء." : dirty ? "انتظر تأكيد الحفظ قبل نسخ رابط المادة. الرابط العام يعمل بعد النشر." : "الرابط العام يعمل بعد النشر."}</p>
    {notice && notice.url === publicUrl && <p role="status" className="text-xs">{notice.text}</p>}
  </div>;
}
