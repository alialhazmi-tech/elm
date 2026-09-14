"use client";

import { useState, useSyncExternalStore } from "react";
import { CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { publicShareUrl } from "@/lib/sharing-contract";
const subscribe = () => () => {};

export function ArticleLinks({ identity, editorId, published, dirty }: {
  identity: { id: string; section: string; slug: string } | null;
  editorId: string; published: boolean; dirty: boolean;
}) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const [notice, setNotice] = useState<{ text: string; url: string } | null>(null);
  const publicUrl = origin && identity ? publicShareUrl(`${origin}/${encodeURIComponent(identity.section)}/${encodeURIComponent(identity.id)}/${encodeURIComponent(identity.slug)}`) : "";
  const editorUrl = origin && editorId ? `${origin}/tahrir/editor/${encodeURIComponent(editorId)}` : "";
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setNotice({ text: "نُسخ الرابط.", url }); }
    catch { setNotice({ text: "تعذّر النسخ؛ حدّد الرابط وانسخه يدويًا.", url }); }
  }
  return <div className="editor-links grid gap-3 border-b bg-(--t-panel) px-5 py-3" aria-label="روابط المادة">
    <div className="text-xs font-semibold">معاينة الرابط ومشاركته</div>
    <div className="grid gap-1">
      <label className="text-[11px] text-muted-foreground" htmlFor="article-public-link">رابط المادة</label>
      <div className="flex min-w-0 items-center gap-2">
        <input id="article-public-link" readOnly dir="ltr" value={publicUrl} placeholder="يظهر الرابط بعد حفظ المسودة" onFocus={event => event.target.select()} className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 text-xs" />
        <Button type="button" size="xs" variant="outline" disabled={!publicUrl || (dirty && !published)} onClick={() => void copy(publicUrl)} aria-label="نسخ رابط المادة"><CopyIcon className="size-3.5" />نسخ</Button>
      </div>
    </div>
    <p className="text-[11px] text-muted-foreground">{published ? "رابط المادة متاح للقرّاء." : dirty ? "انتظر تأكيد الحفظ قبل نسخ رابط المادة. الرابط العام يعمل بعد النشر." : "الرابط العام يعمل بعد النشر."}</p>
    <div className="grid gap-1">
      <label className="text-[11px] text-muted-foreground" htmlFor="article-editor-link">رابط المحرر للزملاء</label>
      <div className="flex min-w-0 items-center gap-2">
        <input id="article-editor-link" readOnly dir="ltr" value={editorUrl} placeholder="يظهر الرابط بعد حفظ المسودة" onFocus={event => event.target.select()} className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 text-xs" />
        <Button type="button" size="xs" variant="outline" disabled={!editorUrl} onClick={() => void copy(editorUrl)} aria-label="نسخ رابط المحرر للزملاء"><CopyIcon className="size-3.5" />نسخ</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">يفتح المادة داخل لوحة التحكم، ويتطلب تسجيل دخول الزميل وصلاحية التحرير.</p>
    </div>
    {notice && [publicUrl, editorUrl].includes(notice.url) && <p role="status" className="text-xs">{notice.text}</p>}
  </div>;
}
