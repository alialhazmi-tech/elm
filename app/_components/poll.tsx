"use client";

import { useState, useSyncExternalStore } from "react";

type Option = { label: string; votes: number };

type Props = {
  pollId: string;
  question: string;
  options: Option[];
  onVote?: (index: number, label: string) => void;
};

const POLL_EVENT = "alelm-poll-change";

function subscribe(callback: () => void) {
  window.addEventListener(POLL_EVENT, callback);
  return () => window.removeEventListener(POLL_EVENT, callback);
}

function readVote(storageKey: string): number | null {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved === null ? null : Number(saved);
  } catch {
    return null;
  }
}

/**
 * سؤال الختام — تنفيذ خاصية «مُتفاعل» من السياسة التحريرية.
 * حالة التصويت عبر useSyncExternalStore: الخادم يعيد null دائمًا فلا انزياح ترطيب،
 * والعميل يقرأ تصويته المحفوظ بعد الترطيب مباشرة. تُربط بنقطة API لاحقًا.
 */
export function EndingPoll({ pollId, question, options, onVote }: Props) {
  const storageKey = `alelm-poll-${pollId}`;
  const voted = useSyncExternalStore(
    subscribe,
    () => readVote(storageKey),
    () => null,
  );
  const [bonus, setBonus] = useState<number | null>(null);

  const counts = options.map(
    (option, index) => option.votes + (bonus === index || voted === index ? 1 : 0),
  );
  const total = counts.reduce((sum, count) => sum + count, 0) || 1;

  const vote = (index: number) => {
    if (voted !== null) return;
    setBonus(index);
    try {
      localStorage.setItem(storageKey, String(index));
    } catch {
      /* بلا تخزين — يبقى التصويت للجلسة عبر bonus */
    }
    window.dispatchEvent(new Event(POLL_EVENT));
    onVote?.(index, options[index]?.label ?? "");
  };

  const revealed = voted !== null || bonus !== null;
  const chosen = voted ?? bonus;

  return (
    <div className="ai-surface poll">
      <h4>سؤال الختام — {question}</h4>
      {options.map((option, index) => {
        const pct = Math.round((counts[index] / total) * 100);
        return (
          <button
            key={option.label}
            type="button"
            className="poll-opt"
            onClick={() => vote(index)}
            disabled={revealed}
            aria-pressed={chosen === index}
          >
            {revealed ? <span className="fill" style={{ width: `${pct}%` }} /> : null}
            <span className="row">
              <span>
                {chosen === index ? "✓ " : ""}
                {option.label}
              </span>
              {revealed ? <b>{pct}%</b> : null}
            </span>
          </button>
        );
      })}
      <p className="poll-note">
        {revealed
          ? `${total.toLocaleString("en")} مشاركة · النتائج لحظية`
          : "صوّت لترى النتائج — تفعيل خاصية «مُتفاعل» من السياسة التحريرية"}
      </p>
    </div>
  );
}
