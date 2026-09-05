"use client";

import { useEffect, useRef, useState } from "react";
import { getMarkRange, type Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { LinkIcon, PencilIcon, UnlinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

function validLink(href: string) {
  if (!/^(https?:\/\/|\/(?!\/))[^"'<>\s]*$/i.test(href)) return false;
  try { return ["https:", "http:"].includes(new URL(href, "https://alelm.net").protocol); }
  catch { return false; }
}

/** يرتبط بالرابط تحت المؤشر، لا بتحديد النص الحالي في المحرر. */
export function LinkHover({ editor }: { editor: Editor }) {
  const [anchor, setAnchor] = useState<HTMLAnchorElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const virtualRef = useRef<HTMLAnchorElement | null>(null);
  const cancelClose = () => { if (timer.current) clearTimeout(timer.current); };
  const close = () => { cancelClose(); setAnchor(null); setEditing(false); setError(""); };
  const scheduleClose = () => { cancelClose(); if (!editing) timer.current = setTimeout(() => setAnchor(null), 250); };

  useEffect(() => {
    const dom = editor.view.dom;
    const linkAt = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
    const show = (event: Event) => {
      if (editing) return;
      const link = linkAt(event.target);
      if (!link || !dom.contains(link)) return;
      cancelClose();
      virtualRef.current = link;
      setAnchor(link);
      setUrl(link.getAttribute("href") ?? "");
      setError("");
    };
    const leave = (event: PointerEvent) => {
      if (editing || linkAt(event.target) === linkAt(event.relatedTarget)) return;
      cancelClose();
      timer.current = setTimeout(() => setAnchor(null), 250);
    };
    const changed = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.docChanged) {
        cancelClose(); setAnchor(null); setEditing(false); setError("");
      }
    };
    dom.addEventListener("pointerover", show);
    dom.addEventListener("pointerout", leave);
    dom.addEventListener("click", show);
    editor.on("transaction", changed);
    return () => {
      cancelClose();
      dom.removeEventListener("pointerover", show);
      dom.removeEventListener("pointerout", leave);
      dom.removeEventListener("click", show);
      editor.off("transaction", changed);
    };
  }, [editor, editing]);

  const apply = (remove: boolean) => {
    if (!anchor || !editor.view.dom.contains(anchor)) { close(); return; }
    const href = url.trim();
    if (!remove && !validLink(href)) {
      setError("أدخل رابطًا يبدأ بـ https:// أو http:// أو مسارًا داخل الموقع.");
      return;
    }
    const position = editor.view.posAtDOM(anchor, 0);
    const range = getMarkRange(editor.state.doc.resolve(position), editor.schema.marks.link, { href: anchor.getAttribute("href") });
    if (!range) { close(); return; }
    const chain = editor.chain().focus().setTextSelection(range);
    if (remove) chain.unsetLink().run();
    else chain.setLink({ href }).run();
    close();
  };

  return (
    <Popover open={!!anchor} onOpenChange={(open) => { if (!open) close(); }}>
      <PopoverAnchor virtualRef={virtualRef} />
      <PopoverContent side="top" align="start" sideOffset={6} collisionPadding={12}
        className="w-80 max-w-[calc(100vw-24px)] p-3" dir="rtl" aria-label="إجراءات الرابط"
        onOpenAutoFocus={(event) => event.preventDefault()} onCloseAutoFocus={(event) => event.preventDefault()}
        onPointerEnter={cancelClose} onPointerLeave={(event) => { if (!event.currentTarget.contains(document.activeElement)) scheduleClose(); }}
        onFocusCapture={cancelClose}>
        {editing ? (
          <form className="grid gap-2" onSubmit={(event) => { event.preventDefault(); apply(false); }}>
            <label htmlFor="hover-link-url" className="font-medium">تعديل الرابط</label>
            <Input id="hover-link-url" ref={input} dir="ltr" value={url} onChange={(event) => { setUrl(event.target.value); setError(""); }} />
            {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm">حفظ الرابط</Button>
              <Button type="button" size="sm" variant="ghost" onClick={close}>إلغاء</Button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <LinkIcon className="size-4 shrink-0" aria-hidden="true" />
              <span dir="ltr" className="truncate text-xs" title={url}>{url}</span>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => { cancelClose(); setEditing(true); }}><PencilIcon />تعديل الرابط</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => apply(true)}><UnlinkIcon />إزالة الرابط</Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
