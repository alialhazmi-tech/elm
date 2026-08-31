"use client";

/**
 * شريط تقدم القراءة — خيط 3px أعلى الصفحة يمتلئ بتدرّج الذكاء (كحلي → سماوي).
 * مستمع تمرير passive واحد، والعرض يُكتب على العنصر مباشرة بلا إعادة رسم للمتن.
 */

import { useEffect, useRef } from "react";

export function ReadingProgress() {
  const fill = useRef<HTMLElement>(null);

  useEffect(() => {
    const paint = () => {
      const root = document.documentElement;
      const max = root.scrollHeight - root.clientHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, root.scrollTop / max)) : 0;
      if (fill.current) fill.current.style.width = `${(ratio * 100).toFixed(1)}%`;
    };

    paint();
    window.addEventListener("scroll", paint, { passive: true });
    window.addEventListener("resize", paint);
    return () => {
      window.removeEventListener("scroll", paint);
      window.removeEventListener("resize", paint);
    };
  }, []);

  return (
    <div className="read-progress" aria-hidden="true">
      <i ref={fill} />
    </div>
  );
}
