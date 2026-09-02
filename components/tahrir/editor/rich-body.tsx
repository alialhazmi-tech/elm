"use client";

/**
 * متن المحرر الغني على Tiptap — الواجهة الأمرية نفسها التي اعتمد عليها المحرر منذ contentEditable
 * (getHtml/getText/getSelectionText/replaceSelection/setPlainText/setHtml) فلا يتغير منطق الحارس والحفظ.
 * الأمان ليس هنا: الخادم ينقّي عند الحفظ والعرض ينقّي ثانية (lib/content/html)، واللصق يمر على المنقّي فورًا.
 */

import { forwardRef, useImperativeHandle, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignRightIcon,
  BoldIcon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  PilcrowIcon,
  RedoIcon,
  RemoveFormattingIcon,
  StrikethroughIcon,
  TextQuoteIcon,
  UnderlineIcon,
  UndoIcon,
  UnlinkIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { looksLikeHtml, sanitizeBodyHtml, stripHtmlToText, textToHtml } from "@/lib/content/html";
import { cn } from "@/lib/utils";

export interface RichBodyHandle {
  getHtml(): string;
  getText(): string;
  getSelectionText(): string;
  replaceSelection(text: string): void;
  setPlainText(text: string): void;
  setHtml(html: string): void;
  /** يحدد أول ظهور للنص داخل المتن ويمرّر إليه — لملاحظات الحارس. */
  locate(text: string): boolean;
}

interface Props {
  initial: string;
  onChange: (html: string, text: string) => void;
}

const toHtml = (body: string) => (looksLikeHtml(body) ? sanitizeBodyHtml(body) : textToHtml(body));

const countWords = (html: string) => stripHtmlToText(html).split(/\s+/u).filter(Boolean).length;

export const RichBody = forwardRef<RichBodyHandle, Props>(function RichBody({ initial, onChange }, ref) {
  const [words, setWords] = useState(() => countWords(toHtml(initial)));
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      // اليمين افتراض RTL فلا يُكتب في HTML؛ الوسط والضبط يمرّان على المنقّي كسمة style.
      TextAlign.configure({
        types: ["heading", "paragraph", "blockquote"],
        alignments: ["right", "center", "justify"],
        defaultAlignment: "right",
      }),
      Placeholder.configure({ placeholder: "نص المادة…" }),
    ],
    content: toHtml(initial),
    editorProps: {
      attributes: { class: "tahrir-body focus:outline-none", dir: "rtl", "aria-label": "نص المادة" },
      transformPastedHTML: (html) => sanitizeBodyHtml(html),
    },
    onCreate: ({ editor: instance }) => setWords(countWords(instance.getHTML())),
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML();
      setWords(countWords(html));
      onChange(html, stripHtmlToText(html));
    },
  });

  const emit = (instance: Editor) => {
    const html = instance.getHTML();
    setWords(countWords(html));
    onChange(html, stripHtmlToText(html));
  };

  useImperativeHandle(
    ref,
    () => ({
      getHtml: () => editor?.getHTML() ?? "",
      getText: () => stripHtmlToText(editor?.getHTML() ?? ""),
      getSelectionText: () => {
        if (!editor) return "";
        const { from, to, empty } = editor.state.selection;
        return empty ? "" : editor.state.doc.textBetween(from, to, "\n");
      },
      replaceSelection: (text: string) => {
        if (!editor || editor.state.selection.empty) return;
        editor.chain().focus().insertContent(text).run();
      },
      setPlainText: (text: string) => {
        if (!editor) return;
        editor.commands.setContent(textToHtml(text), { emitUpdate: false });
        emit(editor);
      },
      setHtml: (html: string) => {
        if (!editor) return;
        editor.commands.setContent(sanitizeBodyHtml(html), { emitUpdate: false });
        emit(editor);
      },
      locate: (text: string) => {
        if (!editor || !text.trim()) return false;
        const needle = text.trim();
        let from = -1;
        editor.state.doc.descendants((node, pos) => {
          if (from >= 0) return false;
          if (node.isText && node.text) {
            const index = node.text.indexOf(needle);
            if (index >= 0) from = pos + index;
          }
          return from < 0;
        });
        if (from < 0) return false;
        editor.chain().focus().setTextSelection({ from, to: from + needle.length }).scrollIntoView().run();
        return true;
      },
    }),
    // emit لا يتغير سلوكه بين الرندرات؛ الاعتماد على editor وحده يكفي.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor],
  );

  return (
    <div className="grid">
      <Toolbar editor={editor} words={words} />
      <div className="px-5 py-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});

function Toolbar({ editor, words }: { editor: Editor | null; words: number }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance?.isActive("bold") ?? false,
      italic: instance?.isActive("italic") ?? false,
      underline: instance?.isActive("underline") ?? false,
      strike: instance?.isActive("strike") ?? false,
      h2: instance?.isActive("heading", { level: 2 }) ?? false,
      h3: instance?.isActive("heading", { level: 3 }) ?? false,
      paragraph: instance?.isActive("paragraph") ?? false,
      quote: instance?.isActive("blockquote") ?? false,
      bullet: instance?.isActive("bulletList") ?? false,
      ordered: instance?.isActive("orderedList") ?? false,
      link: instance?.isActive("link") ?? false,
      center: instance?.isActive({ textAlign: "center" }) ?? false,
      justify: instance?.isActive({ textAlign: "justify" }) ?? false,
      canUndo: instance?.can().undo() ?? false,
      canRedo: instance?.can().redo() ?? false,
    }),
  });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  if (!editor || !state) return <div className="h-11 border-b" />;

  const keepSelection = (event: React.MouseEvent) => event.preventDefault();
  const tool = (
    label: string,
    pressed: boolean,
    Icon: React.ComponentType<{ className?: string }>,
    run: () => void,
  ) => (
    <Toggle
      size="sm"
      aria-label={label}
      title={label}
      pressed={pressed}
      onPressedChange={run}
      onMouseDown={keepSelection}
      className="size-8 p-0 data-[state=on]:bg-accent"
    >
      <Icon className="size-4" />
    </Toggle>
  );
  const chain = () => editor.chain().focus();
  const applyLink = () => {
    const url = linkUrl.trim();
    if (/^(https?:\/\/|\/)/.test(url)) chain().extendMarkRange("link").setLink({ href: url }).run();
    setLinkOpen(false);
    setLinkUrl("");
  };

  return (
    <div
      role="toolbar"
      aria-label="أدوات تنسيق المتن"
      className="sticky top-(--header-height) z-20 flex flex-wrap items-center gap-0.5 border-b bg-card/95 px-2 py-1.5 backdrop-blur-sm"
    >
      {tool("فقرة", state.paragraph && !state.quote, PilcrowIcon, () => chain().setParagraph().run())}
      {tool("عنوان فرعي كبير", state.h2, Heading2Icon, () => chain().toggleHeading({ level: 2 }).run())}
      {tool("عنوان فرعي صغير", state.h3, Heading3Icon, () => chain().toggleHeading({ level: 3 }).run())}
      {tool("اقتباس", state.quote, TextQuoteIcon, () => chain().toggleBlockquote().run())}
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
      {tool("غامق", state.bold, BoldIcon, () => chain().toggleBold().run())}
      {tool("مائل", state.italic, ItalicIcon, () => chain().toggleItalic().run())}
      {tool("تسطير", state.underline, UnderlineIcon, () => chain().toggleUnderline().run())}
      {tool("يتوسطه خط", state.strike, StrikethroughIcon, () => chain().toggleStrike().run())}
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
      {tool("قائمة نقطية", state.bullet, ListIcon, () => chain().toggleBulletList().run())}
      {tool("قائمة مرقمة", state.ordered, ListOrderedIcon, () => chain().toggleOrderedList().run())}
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
      <Popover
        open={linkOpen}
        onOpenChange={(open) => {
          setLinkOpen(open);
          if (open) setLinkUrl(editor.getAttributes("link").href ?? "");
        }}
      >
        <PopoverTrigger asChild>
          <Toggle
            size="sm"
            aria-label="رابط"
            title="رابط على المحدد"
            pressed={state.link}
            onMouseDown={keepSelection}
            className="size-8 p-0 data-[state=on]:bg-accent"
          >
            <LinkIcon className="size-4" />
          </Toggle>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-2">
          <form
            className="flex gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              applyLink();
            }}
          >
            <Input
              dir="ltr"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://… أو /مسار"
              aria-label="عنوان الرابط"
            />
            <Button type="submit" size="sm">
              تطبيق
            </Button>
            {state.link ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="إزالة الرابط"
                onClick={() => {
                  chain().unsetLink().run();
                  setLinkOpen(false);
                }}
              >
                <UnlinkIcon />
              </Button>
            ) : null}
          </form>
        </PopoverContent>
      </Popover>
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
      {tool("محاذاة يمين (الأصل)", !state.center && !state.justify, AlignRightIcon, () =>
        chain().setTextAlign("right").run(),
      )}
      {tool("توسيط", state.center, AlignCenterIcon, () => chain().setTextAlign("center").run())}
      {tool("ضبط", state.justify, AlignJustifyIcon, () => chain().setTextAlign("justify").run())}
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="مسح التنسيق"
        title="مسح التنسيق من المحدد"
        onMouseDown={keepSelection}
        onClick={() => chain().unsetAllMarks().clearNodes().run()}
      >
        <RemoveFormattingIcon />
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="تراجع" disabled={!state.canUndo} onMouseDown={keepSelection} onClick={() => chain().undo().run()}>
        <UndoIcon className="rtl:-scale-x-100" />
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="إعادة" disabled={!state.canRedo} onMouseDown={keepSelection} onClick={() => chain().redo().run()}>
        <RedoIcon className="rtl:-scale-x-100" />
      </Button>
      <span className={cn("ms-auto text-[11px] text-muted-foreground tabular-nums")}>{words} كلمة</span>
    </div>
  );
}
