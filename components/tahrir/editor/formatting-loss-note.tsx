"use client";

import { formattingLossLabel, type FormattingLoss } from "@/lib/tahrir/editor/preserve-formatting";

/** ما سيُفقد من تنسيق المتن لو طُبّق نص الذكاء — يظهر فوق زر التطبيق ولا يمنعه. */
export function FormattingLossNote({ loss }: { loss: FormattingLoss | null }) {
  if (!loss || loss.none) return null;
  const lossy = loss.links.lost > 0 || loss.headings.lost > 0 || loss.lists > 0;
  return (
    <p role="note" className={lossy ? "rounded-md bg-(--t-warn-bg) px-3 py-2 text-xs leading-relaxed text-(--t-warn)" : "text-xs leading-relaxed text-muted-foreground"}>
      <b>التنسيق عند التطبيق:</b> {formattingLossLabel(loss)}.
    </p>
  );
}
