"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const SUGGESTIONS = [
  "لماذا ترتفع أسعار التنجستن؟",
  "من هو تود بلانش؟",
  "ما حقيقة شائعة الجاذبية؟",
  "كيف تُصنع الرقائق الدقيقة في السعودية؟",
  "ما أسرار حزام الكويكبات؟",
];

export function HomeAskBand() {
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % SUGGESTIONS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="ask-band" aria-labelledby="ask-title">
      <div className="ask-band-info">
        <h2 id="ask-title">
          <span className="spark" aria-hidden="true">✦</span> اسأل العلم
        </h2>
        <p className="ask-sub">بحث ذكي يجيب من أرشيف موادنا — كل إجابة تحمل روابط مصادرها المنشورة.</p>
      </div>
      <div className="ask-band-interactive">
        <form className="ask-band-form" action="/search" role="search">
          <span className="ask-search-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={SUGGESTIONS[index]}
            aria-label="ابحث في العلم"
            dir="rtl"
            autoComplete="off"
          />
          <button type="submit">اسأل</button>
        </form>
        <p className="ask-suggest">
          <span className="suggest-lbl">جرّب:</span>
          <Link href="/search?q=التنجستن">أسعار التنجستن</Link>
          <Link href="/search?q=تود بلانش">من هو تود بلانش؟</Link>
          <Link href="/search?q=الجاذبية">شائعة الجاذبية</Link>
          <span className="ask-note">الإجابات مولّدة آليًا وتُراجع مصادرها قبل الاعتماد</span>
        </p>
      </div>
    </section>
  );
}
