"use client";

import { useArticleInteraction } from "@/app/_components/article-interactions";
import { toLatinDigits } from "@/lib/format";

export function EndingPoll({ pollId, question, options }: { pollId: string; question: string; options: Array<{ label: string }> }) {
  const { state, error, busy, save } = useArticleInteraction(pollId);
  const chosen = state?.closingAnswer ?? null;
  const total = state?.counts.reduce((sum, count) => sum + count, 0) ?? 0;
  return <div className="ai-surface poll">
    <h4>سؤال الختام — {question}</h4>
    {options.map((option, index) => {
      const pct = total > 0 ? Math.round(((state?.counts[index] ?? 0) / total) * 100) : 0;
      return <button key={option.label} type="button" className="poll-opt" disabled={busy || (!state && !error)} aria-pressed={chosen === index} onClick={() => void save({ answer: index })}>
        {chosen !== null && total > 0 && <span className="fill" style={{ width: `${pct}%` }} />}
        <span className="row"><span>{chosen === index ? "✓ " : ""}{option.label}</span>{chosen !== null && total > 0 && <b>{toLatinDigits(pct)}%</b>}</span>
      </button>;
    })}
    <p className="poll-note" role="status">{error || (busy ? "جارٍ حفظ إجابتك…" : !state ? "جارٍ تحميل السؤال…" : chosen !== null ? `تم حفظ إجابتك · ${toLatinDigits(total)} إجابة مسجّلة. يمكنك تغيير اختيارك دون إضافة صوت آخر.` : "متاح للجميع. تُحتسب إجابة واحدة لكل حساب، أو متصفح للزائر.")}</p>
  </div>;
}
