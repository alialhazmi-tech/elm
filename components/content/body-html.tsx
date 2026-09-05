"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { XPost } from "./x-post";

/** HTML منقّى في الخادم؛ البوابات تملأ مواضع التغريدات دون تفكيك القوائم أو العناوين. */
export function BodyHtml({ html }: { html: string }) {
  return <BodyHtmlContent key={html} html={html} />;
}

function BodyHtmlContent({ html }: { html: string }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const targets = container ? [...container.querySelectorAll<HTMLElement>('blockquote[data-x-post]')] : [];
  return <>
    <div ref={setContainer} className={container ? "article-html article-html--enhanced" : "article-html"}
      dangerouslySetInnerHTML={{ __html: html }} />
    {targets.map((target, index) => {
      const id = target.getAttribute("data-x-post") ?? "";
      return /^[1-9][0-9]{0,19}$/.test(id) ? createPortal(<XPost id={id} />, target, `${id}-${index}`) : null;
    })}
  </>;
}
