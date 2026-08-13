"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const REASON_CHIPS = [
  "خطأ وقائعي يحتاج تصحيحًا",
  "تكرار لمادة أخرى",
  "طلب إزالة أو تحديث رسمي",
  "لم تعد صالحة للنشر",
];

export function ArchiveStoryButton({
  id,
  title,
  onArchived,
}: {
  id: string;
  title: string;
  onArchived?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/tahrir/story/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reason }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError(data?.error ?? "تعذر أرشفة المادة.");
      return;
    }
    setOpen(false);
    setReason("");
    onArchived?.();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className="th-archive-btn"
        onClick={() => setOpen(true)}
        aria-label={`أرشفة ${title}`}
      >
        أرشفة
      </button>
      {open ? (
        <div className="th-modal-back" role="presentation" onClick={() => !busy && setOpen(false)}>
          <div
            className="th-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`archive-title-${id}`}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={`archive-title-${id}`}>أرشفة المادة</h2>
            <p>
              تُخفى «{title}» عن الموقع فورًا، وتبقى في تاب المؤرشفة مع التاريخ والسبب. ليست حذفًا
              نهائيًا.
            </p>
            <div className="th-archive-chips">
              {REASON_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className={`th-mini ${reason === chip ? "on" : ""}`}
                  onClick={() => setReason(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
            <label className="th-meta">
              <span className="lb">سبب الأرشفة</span>
              <textarea
                className="th-input"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="لماذا تُخفى هذه المادة عن القرّاء؟"
                maxLength={500}
              />
            </label>
            {error ? <div className="th-msg err">{error}</div> : null}
            <div className="th-actions">
              <button type="button" className="th-save" onClick={() => setOpen(false)} disabled={busy}>
                إلغاء
              </button>
              <button type="button" className="th-send ready" onClick={submit} disabled={busy}>
                {busy ? "يؤرشف…" : "أرشفة وإخفاء عن الموقع"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function RestoreStoryButton({
  id,
  title,
  onRestored,
}: {
  id: string;
  title: string;
  onRestored?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function restore() {
    if (busy || !window.confirm(`استعادة «${title}» كمسودة؟ لن تظهر على الموقع حتى يُعاد نشرها.`)) {
      return;
    }
    setBusy(true);
    const response = await fetch("/api/tahrir/story/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      window.alert(data?.error ?? "تعذر الاستعادة.");
      return;
    }
    onRestored?.();
    router.refresh();
  }

  return (
    <button
      type="button"
      className="th-restore-btn"
      onClick={restore}
      disabled={busy}
      aria-label={`استعادة ${title}`}
    >
      {busy ? "يستعيد…" : "استعادة كمسودة"}
    </button>
  );
}
