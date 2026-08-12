"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { toLatinDigits } from "@/lib/format";

type Option = { label: string };

type Props = {
  pollId: string;
  question: string;
  options: Option[];
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

function displayCounts(server: number[] | null, chosen: number | null, optionCount: number): number[] {
  const next = Array.from({ length: optionCount }, (_, index) => Math.max(0, Math.round(server?.[index] ?? 0)));
  if (server && chosen !== null && (next[chosen] ?? 0) === 0) next[chosen] += 1;
  return next;
}

/**
 * سؤال الختام — أصوات الأعضاء الحقيقية فقط، بلا بذور وهمية.
 */
export function EndingPoll({ pollId, question, options }: Props) {
  const storageKey = `alelm-poll-${pollId}`;
  const voted = useSyncExternalStore(
    subscribe,
    () => readVote(storageKey),
    () => null,
  );
  const [bonus, setBonus] = useState<number | null>(null);
  const [serverCounts, setServerCounts] = useState<number[] | null>(null);

  const chosen = voted ?? bonus;
  const revealed = chosen !== null;
  const counts = displayCounts(serverCounts, chosen, options.length);
  const total = counts.reduce((sum, count) => sum + count, 0);

  const applyCounts = (data: { counts?: unknown } | null) => {
    const raw = Array.isArray(data?.counts) ? data.counts.map((value) => Number(value) || 0) : options.map(() => 0);
    while (raw.length < options.length) raw.push(0);
    setServerCounts(raw.slice(0, options.length));
  };

  const loadPublicCounts = () => {
    fetch(`/api/polls/closing?storyId=${encodeURIComponent(pollId)}`, { credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => applyCounts(data))
      .catch(() => applyCounts({ counts: options.map(() => 0) }));
  };

  useEffect(() => {
    if (voted === null) return;
    loadPublicCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- مرة عند وجود تصويت محفوظ
  }, [pollId, voted]);

  const vote = (index: number) => {
    if (voted !== null || bonus !== null) return;
    setBonus(index);
    try {
      localStorage.setItem(storageKey, String(index));
    } catch {
      /* يبقى التصويت للجلسة عبر bonus */
    }
    window.dispatchEvent(new Event(POLL_EVENT));

    void fetch("/api/me/closing", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId: pollId, answer: index }),
    })
      .then(async (response) => {
        if (response.status === 401) {
          loadPublicCounts();
          return;
        }
        const data = response.ok ? ((await response.json()) as { counts?: number[] }) : null;
        if (data?.counts) applyCounts(data);
        else loadPublicCounts();
      })
      .catch(() => loadPublicCounts());
  };

  return (
    <div className="ai-surface poll">
      <h4>سؤال الختام — {question}</h4>
      {options.map((option, index) => {
        const pct = total > 0 ? Math.round((counts[index] / total) * 100) : 0;
        return (
          <button
            key={option.label}
            type="button"
            className="poll-opt"
            onClick={() => vote(index)}
            disabled={revealed}
            aria-pressed={chosen === index}
          >
            {revealed && total > 0 ? <span className="fill" style={{ width: `${pct}%` }} /> : null}
            <span className="row">
              <span>
                {chosen === index ? "✓ " : ""}
                {option.label}
              </span>
              {revealed && total > 0 ? <b>{toLatinDigits(pct)}%</b> : null}
            </span>
          </button>
        );
      })}
      <p className="poll-note">
        {revealed
          ? total > 0
            ? `${toLatinDigits(total)} مشاركة من الأعضاء`
            : "شُكرًا. سُجّل رأيك."
          : "صوتك يساعدنا نفهم إن أضافت المادة معرفة جديدة."}
      </p>
    </div>
  );
}
