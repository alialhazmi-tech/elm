"use client";

/**
 * «استمع» في موجز العلم الذكي — يقرأ العناوين الخمسة صوتيًا عبر
 * SpeechSynthesis في المتصفح (بلا ملف صوتي ولا طلب شبكة).
 * الزر لا يظهر إلا حين يدعم المتصفح النطق، فلا يبقى شاهدًا معطلًا.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/** لا يتغيّر بعد الترطيب — الاشتراك فارغ والخادم يرى false فلا يختل التطابق. */
const noop = () => () => {};
const hasSpeech = () => "speechSynthesis" in window;
const noSpeech = () => false;

export function BriefListen({ lines, seconds }: { lines: string[]; seconds: number }) {
  const supported = useSyncExternalStore(noop, hasSpeech, noSpeech);
  const [speaking, setSpeaking] = useState(false);
  const utterances = useRef<SpeechSynthesisUtterance[]>([]);

  useEffect(() => () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  if (!supported) return null;

  const stop = () => {
    window.speechSynthesis.cancel();
    utterances.current = [];
    setSpeaking(false);
  };

  const play = () => {
    const synth = window.speechSynthesis;
    synth.cancel();
    utterances.current = lines.map((line) => {
      const utterance = new SpeechSynthesisUtterance(line);
      utterance.lang = "ar-SA";
      utterance.rate = 0.95;
      return utterance;
    });
    const last = utterances.current.at(-1);
    if (last) last.onend = () => setSpeaking(false);
    for (const utterance of utterances.current) synth.speak(utterance);
    setSpeaking(true);
  };

  return (
    <button
      type="button"
      className={speaking ? "brief-listen is-on" : "brief-listen"}
      onClick={speaking ? stop : play}
      aria-pressed={speaking}
    >
      <span aria-hidden="true">{speaking ? "⏸" : "▶"}</span>
      {speaking ? "إيقاف" : `استمع · ${seconds} ث`}
    </button>
  );
}
