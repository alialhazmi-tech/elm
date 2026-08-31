"use client";

/**
 * لوح الاستماع — موجة صوتية وعدّاد الوقت المنقضي.
 * يعيش في ملفه لأن عدّاده يدق كل ثانية، بينما تتبّع القراءة في
 * `article-experience.tsx` يتعمّد ألا يدق بهذا التواتر.
 * يبدأ العدّاد بالتركيب وينتهي بالتفكيك — فلا حالة تُدار من الخارج.
 */

import { useEffect, useState } from "react";

const WAVE_BARS = [8, 14, 6, 12, 9];

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function ListenMeter() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="sa-listen">
      <span className="sa-wave" dir="ltr" aria-hidden="true">
        {WAVE_BARS.map((height, index) => (
          <i key={`${height}-${index}`} style={{ height }} />
        ))}
      </span>
      <span className="sa-listen-txt">
        جارٍ القراءة الصوتية… <b className="latin-number" dir="ltr" lang="en">{clock(elapsed)}</b>
      </span>
    </div>
  );
}
