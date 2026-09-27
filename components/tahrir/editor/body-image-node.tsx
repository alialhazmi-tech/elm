"use client";

import { Node, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BODY_IMAGE_SRC } from "@/lib/content/html";

const dimension = (value: string | null) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

function ImageView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const { src, caption, width, height } = node.attrs as { src: string; caption: string; width: number | null; height: number | null };
  return <NodeViewWrapper contentEditable={false} className={`my-4 rounded-md border p-2 not-prose ${selected ? "ring-2 ring-primary" : ""}`}>
    <div className="mb-2 flex items-center justify-between gap-2 text-xs">
      <span>صورة داخل المتن</span>
      <Button type="button" size="xs" variant="outline" onClick={deleteNode}>حذف الصورة من المتن</Button>
    </div>
    {/* الصورة من مكتبة الوسائط؛ تعرض كما رُفعت ليظهر نص الإنفوجرافيك كاملًا. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={caption || "صورة ضمن المادة"} width={width ?? undefined} height={height ?? undefined}
      className="mx-auto h-auto max-h-[70vh] w-auto max-w-full rounded object-contain" draggable={false} />
    <Input
      className="mt-2 text-sm"
      value={caption}
      maxLength={300}
      onChange={event => updateAttributes({ caption: event.target.value })}
      onKeyDown={event => event.stopPropagation()}
      placeholder="تعليق أو مصدر الصورة (اختياري) — يظهر تحتها ويُقرأ نصًا بديلًا"
      aria-label="تعليق الصورة"
    />
  </NodeViewWrapper>;
}

/** صورة أو إنفوجرافيك داخل المتن: ‎<figure><img><figcaption>‎ بمصدر من المكتبة فقط. */
export const BodyImageNode = Node.create({
  name: "bodyImage",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null, rendered: false },
      caption: { default: "", rendered: false },
      width: { default: null, rendered: false },
      height: { default: null, rendered: false },
    };
  },
  parseHTML() {
    const fromImage = (image: Element | null, caption: string) => {
      const src = image?.getAttribute("src") ?? "";
      if (!BODY_IMAGE_SRC.test(src)) return false;
      return {
        src,
        caption: caption || image?.getAttribute("alt") || "",
        width: dimension(image?.getAttribute("width") ?? null),
        height: dimension(image?.getAttribute("height") ?? null),
      };
    };
    return [
      { tag: "figure", priority: 100, getAttrs: element => fromImage(element.querySelector("img"), element.querySelector("figcaption")?.textContent?.trim() ?? "") },
      { tag: "img[src]", priority: 90, getAttrs: element => fromImage(element, "") },
    ];
  },
  renderHTML({ node }) {
    const src = String(node.attrs.src ?? "");
    if (!BODY_IMAGE_SRC.test(src)) return ["p", {}, ""];
    const caption = String(node.attrs.caption ?? "").trim();
    const size = node.attrs.width && node.attrs.height ? { width: String(node.attrs.width), height: String(node.attrs.height) } : {};
    const image = ["img", { src, alt: caption, ...size }] as const;
    return caption ? ["figure", {}, image, ["figcaption", {}, caption]] : ["figure", {}, image];
  },
  addNodeView() { return ReactNodeViewRenderer(ImageView); },
});
