"use client";

import { Node, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { XPost } from "@/components/content/x-post";
import { Button } from "@/components/ui/button";

function PostView({ node, deleteNode, selected }: NodeViewProps) {
  return <NodeViewWrapper contentEditable={false} className={`my-4 rounded-md border p-2 not-prose ${selected ? "ring-2 ring-primary" : ""}`}>
    <div className="mb-2 flex items-center justify-between text-xs"><span>تغريدة داخل المتن</span>
      <Button type="button" size="xs" variant="outline" onClick={deleteNode}>حذف التغريدة من المتن</Button>
    </div>
    <XPost key={node.attrs.postId} id={node.attrs.postId} />
  </NodeViewWrapper>;
}

export const XPostNode = Node.create({
  name: "xPost",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() { return { postId: { default: null, rendered: false } }; },
  parseHTML() { return [{ tag: 'blockquote[data-x-post]', priority: 100,
    getAttrs: element => {
      const postId = element.getAttribute("data-x-post") ?? "";
      return /^[1-9][0-9]{0,19}$/.test(postId) ? { postId } : false;
    },
  }]; },
  renderHTML({ node }) {
    const postId = String(node.attrs.postId ?? "");
    if (!/^[1-9][0-9]{0,19}$/.test(postId)) return ["blockquote", {}, ""];
    return ["blockquote", { "data-x-post": postId },
      ["a", { href: `https://x.com/i/status/${postId}`, target: "_blank", rel: "noopener noreferrer" }, "عرض التغريدة على X"]];
  },
  addNodeView() { return ReactNodeViewRenderer(PostView); },
});
