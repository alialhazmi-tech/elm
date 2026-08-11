"use client";

/**
 * متن المحرر الغني — contentEditable بلا اعتماديات، بشريط أدوات تنسيق.
 * الأمان ليس هنا: الخادم ينقّي عند الحفظ والعرض ينقّي ثانية (lib/content/html).
 * اللصق يمر على المنقّي نفسه فورًا حتى لا يدخل HTML غريب أصلًا.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { looksLikeHtml, sanitizeBodyHtml, stripHtmlToText, textToHtml } from "@/lib/content/html";

export interface RichBodyHandle {
  getHtml(): string;
  getText(): string;
  getSelectionText(): string;
  replaceSelection(text: string): void;
  setPlainText(text: string): void;
  setHtml(html: string): void;
}

interface Props {
  initial: string;
  onChange: (html: string, text: string) => void;
}

const exec = (command: string, value?: string) => {
  document.execCommand(command, false, value);
};

const TOOLS: Array<{ key: string; label: string; title: string; run: () => void }> = [
  { key: "bold", label: "B", title: "غامق", run: () => exec("bold") },
  { key: "italic", label: "I", title: "مائل", run: () => exec("italic") },
  { key: "underline", label: "U", title: "تسطير", run: () => exec("underline") },
  { key: "h2", label: "عنوان", title: "عنوان فرعي كبير", run: () => exec("formatBlock", "<h2>") },
  { key: "h3", label: "فرعي", title: "عنوان فرعي صغير", run: () => exec("formatBlock", "<h3>") },
  { key: "p", label: "فقرة", title: "فقرة عادية", run: () => exec("formatBlock", "<p>") },
  { key: "quote", label: "❝ اقتباس", title: "اقتباس", run: () => exec("formatBlock", "<blockquote>") },
  { key: "ul", label: "• قائمة", title: "قائمة نقطية", run: () => exec("insertUnorderedList") },
  { key: "ol", label: "١. قائمة", title: "قائمة مرقمة", run: () => exec("insertOrderedList") },
  {
    key: "link",
    label: "🔗 رابط",
    title: "إدراج رابط على المحدد",
    run: () => {
      const url = window.prompt("الرابط (يبدأ بـ https:// أو /):") ?? "";
      if (/^(https?:\/\/|\/)/.test(url.trim())) exec("createLink", url.trim());
    },
  },
  { key: "center", label: "⇔ وسط", title: "محاذاة وسط", run: () => exec("justifyCenter") },
  { key: "right", label: "⇐ يمين", title: "محاذاة يمين (الأصل)", run: () => exec("justifyRight") },
  { key: "clear", label: "مسح التنسيق", title: "إزالة كل التنسيق من المحدد", run: () => exec("removeFormat") },
];

export const RichBody = forwardRef<RichBodyHandle, Props>(function RichBody(
  { initial, onChange },
  ref,
) {
  const boxRef = useRef<HTMLDivElement | null>(null);

  const emit = () => {
    const html = boxRef.current?.innerHTML ?? "";
    onChange(html, stripHtmlToText(html));
  };

  useEffect(() => {
    // تهيئة واحدة — المكوّن غير مُتحكَّم به حتى لا يقفز المؤشر مع كل حرف.
    if (boxRef.current && !boxRef.current.innerHTML) {
      boxRef.current.innerHTML = looksLikeHtml(initial)
        ? sanitizeBodyHtml(initial)
        : textToHtml(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    getHtml: () => boxRef.current?.innerHTML ?? "",
    getText: () => stripHtmlToText(boxRef.current?.innerHTML ?? ""),
    getSelectionText: () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !boxRef.current) return "";
      const range = selection.getRangeAt(0);
      if (!boxRef.current.contains(range.commonAncestorContainer)) return "";
      return selection.toString();
    },
    replaceSelection: (text: string) => {
      const selection = window.getSelection();
      if (!selection || !boxRef.current) return;
      if (
        !selection.isCollapsed &&
        boxRef.current.contains(selection.getRangeAt(0).commonAncestorContainer)
      ) {
        exec("insertText", text);
      }
      emit();
    },
    setPlainText: (text: string) => {
      if (!boxRef.current) return;
      boxRef.current.innerHTML = textToHtml(text);
      emit();
    },
    setHtml: (html: string) => {
      if (!boxRef.current) return;
      boxRef.current.innerHTML = sanitizeBodyHtml(html);
      emit();
    },
  }));

  return (
    <div className="th-rt">
      <div className="th-rt-bar" role="toolbar" aria-label="أدوات تنسيق المتن">
        {TOOLS.map((tool) => (
          <button
            key={tool.key}
            type="button"
            title={tool.title}
            className={`tb tb-${tool.key}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              boxRef.current?.focus();
              tool.run();
              emit();
            }}
          >
            {tool.label}
          </button>
        ))}
      </div>
      <div
        ref={boxRef}
        className="th-ed-body th-rt-box"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label="نص المادة"
        data-placeholder="نص المادة…"
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onPaste={(event) => {
          event.preventDefault();
          const html = event.clipboardData.getData("text/html");
          const text = event.clipboardData.getData("text/plain");
          exec("insertHTML", html ? sanitizeBodyHtml(html) : textToHtml(text));
          emit();
        }}
      />
    </div>
  );
});
