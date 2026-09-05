"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

type XWindow = Window & {
  twttr?: { widgets: { createTweet: (id: string, target: HTMLElement, options: {
    lang: string; dnt: boolean; conversation: string; align: string; width: number;
  }) => Promise<HTMLElement | undefined> } };
};

export function XPost({ id }: { id: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");

  useEffect(() => {
    // يشمل مهلة تحميل السكربت نفسه، بما في ذلك حجبه بإضافة المتصفح.
    const timeout = setTimeout(() => setStatus(current => current === "loaded" ? current : "failed"), 20_000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!ready || !container.current) return;
    const host = container.current;
    let active = true;
    let currentWidth = 0;
    let generation = 0;
    async function render(width: number) {
      const run = ++generation;
      const target = document.createElement("div");
      host.replaceChildren(target);
      try {
        const tweet = await (window as XWindow).twttr?.widgets.createTweet(id, target, {
          lang: "ar", dnt: true, conversation: "none", align: "center", width,
        });
        if (active && run === generation) setStatus(tweet ? "loaded" : "failed");
      } catch { if (active && run === generation) setStatus("failed"); }
    }
    // مقاس التضمين الرسمي ثابت؛ أعد حسابه عند تغيير عرض اللوحة أو اتجاه الهاتف.
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width <= 0) return;
      const width = Math.max(220, Math.min(550, Math.floor(entry.contentRect.width)));
      if (width === currentWidth) return;
      currentWidth = width;
      void render(width);
    });
    observer.observe(host);
    return () => { active = false; observer.disconnect(); host.replaceChildren(); };
  }, [id, ready]);

  return <div className="grid w-full min-w-0 gap-3 rounded-md border bg-white p-3 text-center text-slate-700" dir="rtl">
    <Script id="x-post-widgets" src="https://platform.twitter.com/widgets.js" strategy="afterInteractive"
      onReady={() => setReady(true)} onError={() => setStatus("failed")} />
    <div ref={container} hidden={status === "failed"} className="mx-auto w-full min-w-0 max-w-[550px]" />
    {status !== "loaded" && <p role="status" className="text-sm leading-relaxed">
      {status === "loading" ? "جارٍ تحميل التغريدة…" : "تعذّر عرض التغريدة هنا. يمكنك فتحها على X."}
    </p>}
    <a href={`https://x.com/i/status/${id}`} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">فتح التغريدة على X</a>
  </div>;
}
