"use client";

/**
 * مؤشرات المادة — ثلاث بطاقات حيّة في جانب المقال:
 * معدل القراءة، إكمال القراءة، والتفاعل. الأرقام من قراءات الأعضاء المجمّعة.
 */

import { useEffect, useState } from "react";

import type { StoryInsights } from "@/lib/personalization/insights";
import { toLatinDigits } from "@/lib/format";

const EMPTY: StoryInsights = {
  readers: 0,
  avgMinutes: 0,
  timeBuckets: [0, 0, 0, 0],
  reach: { intro: 0, body: 0, end: 0 },
  completion: 0,
  likes: 0,
  answers: 0,
  engagement: 0,
};

const n = (value: number) => toLatinDigits(String(value));

function Dots({ active }: { active: number }) {
  return (
    <span className="ins-dots" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <i key={i} className={i === active ? "is-on" : undefined} />
      ))}
    </span>
  );
}

export function ArticleInsights({ storyId, readingMinutes }: { storyId: string; readingMinutes: number }) {
  const [data, setData] = useState<StoryInsights | null>(null);

  useEffect(() => {
    fetch(`/api/content/insights?storyId=${encodeURIComponent(storyId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => setData(json && typeof json.readers === "number" ? (json as StoryInsights) : EMPTY))
      .catch(() => setData(EMPTY));
  }, [storyId]);

  const ins = data ?? EMPTY;
  const fresh = ins.readers === 0;
  const avg = fresh ? readingMinutes : ins.avgMinutes;
  const buckets = ins.timeBuckets;
  const labels = ["< 2 د", "2–4 د", "4–6 د", "> 6 د"];

  return (
    <div className="ins-stack" aria-label="مؤشرات المادة" data-loading={data === null ? "" : undefined}>
      {/* معدل القراءة */}
      <section className="ins-card">
        <header>
          <h3>معدل القراءة</h3>
          <Dots active={1} />
        </header>
        <p className="ins-big">
          <b className="latin-number" dir="ltr" lang="en">{n(avg)}</b>
          <span>د</span>
        </p>
        <p className="ins-desc">{fresh ? "الزمن المقدّر لقراءة المادة" : "متوسط الوقت الذي يقضيه القارئ في المادة"}</p>
        <ul className="ins-bars">
          {buckets.map((value, index) => (
            <li key={labels[index]}>
              <span className="lbl">{labels[index]}</span>
              <span className="bar"><i style={{ width: `${Math.max(fresh ? 0 : value, 0)}%`, opacity: 0.55 + index * 0.15 }} /></span>
              <span className="val latin-number" dir="ltr" lang="en">{fresh ? "—" : `${n(value)}%`}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* إكمال القراءة */}
      <section className="ins-card">
        <header>
          <h3>إكمال القراءة</h3>
          <Dots active={2} />
        </header>
        <p className="ins-big">
          <b className="latin-number" dir="ltr" lang="en">{fresh ? "—" : n(ins.completion)}</b>
          {fresh ? null : <span>%</span>}
        </p>
        <p className="ins-desc">{fresh ? "تُحسب مع أول قراءات الأعضاء" : "نسبة القرّاء الذين أكملوا المادة حتى النهاية"}</p>
        <div className="ins-track"><i style={{ width: `${fresh ? 0 : ins.completion}%` }} /></div>
        <ul className="ins-steps">
          {[
            ["مقدمة", ins.reach.intro],
            ["محتوى", ins.reach.body],
            ["خاتمة", ins.reach.end],
          ].map(([label, value], index) => (
            <li key={label as string}>
              <span className="bar"><i style={{ width: `${fresh ? 0 : (value as number)}%`, opacity: 0.6 + index * 0.2 }} /></span>
              <span className="lbl">{label}</span>
              <span className="val latin-number" dir="ltr" lang="en">{fresh ? "—" : `${n(value as number)}%`}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* التفاعل */}
      <section className="ins-card">
        <header>
          <h3>التفاعل</h3>
          <Dots active={0} />
        </header>
        <p className="ins-big">
          <b className="latin-number" dir="ltr" lang="en">{n(ins.likes + ins.answers)}</b>
        </p>
        <p className="ins-desc">مجموع الإعجابات وإجابات سؤال الختام</p>
        <div className="ins-split" aria-hidden="true">
          <i style={{ flex: Math.max(ins.likes, ins.likes + ins.answers === 0 ? 1 : 0) }} />
          <i className="alt" style={{ flex: Math.max(ins.answers, ins.likes + ins.answers === 0 ? 1 : 0) }} />
        </div>
        <p className="ins-legend">
          <span><i />إعجابات <b className="latin-number" dir="ltr" lang="en">{n(ins.likes)}</b></span>
          <span><i className="alt" />إجابات <b className="latin-number" dir="ltr" lang="en">{n(ins.answers)}</b></span>
          {fresh ? null : (
            <span className="eng">تفاعل <b className="latin-number" dir="ltr" lang="en">{n(ins.engagement)}%</b> من القرّاء</span>
          )}
        </p>
      </section>
    </div>
  );
}
