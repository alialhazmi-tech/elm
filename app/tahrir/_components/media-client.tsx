"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface MediaItem {
  id: string;
  url: string;
  filename: string;
  bytes: number;
  width: number | null;
  height: number | null;
  rightsCleared: boolean;
  flags: string;
  uploadedBy: string;
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)}KB`;

export function MediaClient({ items, canClear }: { items: MediaItem[]; canClear: boolean }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<"all" | "ok" | "pending">("all");
  const [drag, setDrag] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file || busy) return;
    setBusy(true);
    setMessage("جارٍ الرفع…");

    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/tahrir/media", { method: "POST", body: form }).catch(
      () => null,
    );
    const data = await response?.json().catch(() => null);
    setBusy(false);
    setMessage(response?.ok ? "رُفعت — وثّق حقوقها قبل الاستخدام." : (data?.error ?? "تعذر الرفع."));
    if (response?.ok) router.refresh();
  }

  async function setRights(id: string, cleared: boolean) {
    await fetch("/api/tahrir/media/rights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, rightsCleared: cleared }),
    });
    router.refresh();
  }

  const counts = {
    all: items.length,
    ok: items.filter((item) => item.rightsCleared).length,
    pending: items.filter((item) => !item.rightsCleared).length,
  };
  const visible = items.filter(
    (item) =>
      filter === "all" || (filter === "ok" ? item.rightsCleared : !item.rightsCleared),
  );

  return (
    <>
      <div className="th-filters">
        <button className={`th-fch ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>
          الكل <b>{counts.all}</b>
        </button>
        <button className={`th-fch ${filter === "ok" ? "on" : ""}`} onClick={() => setFilter("ok")}>
          موثقة الحقوق <b>{counts.ok}</b>
        </button>
        <button
          className={`th-fch ${filter === "pending" ? "on" : ""}`}
          onClick={() => setFilter("pending")}
        >
          بانتظار التوثيق <b>{counts.pending}</b>
        </button>
        {message && <span style={{ fontSize: 11.5, color: "var(--t-ink3)" }}>{message}</span>}
      </div>

      <div
        className={`th-dropzone ${drag ? "drag" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => fileInput.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInput.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDrag(false);
          upload(event.dataTransfer.files);
        }}
      >
        <b>أسقط الصور هنا أو اضغط للاختيار</b>
        <span className="hint">
          PNG / JPEG / WebP حتى 8MB — مسار UUID قصير، والحقوق تُفحص قبل الاستخدام (الدستور §12).
          نسخ WebP المتعددة تأتي مع مرحلة R2.
        </span>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(event) => upload(event.target.files)}
        />
      </div>

      {visible.length === 0 && (
        <div className="th-panel">
          <div className="th-empty">لا صور هنا بعد.</div>
        </div>
      )}

      <div className="th-media-grid">
        {visible.map((item) => (
          <div className="th-mcard" key={item.id}>
            <div className="thumb">
              {/* المكتبة تعرض الأصل كما رُفع — التحويلات مرحلة R2، وnext/image لا يضيف هنا */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.filename} loading="lazy" />
              {item.width && item.height && (
                <span className="dim">
                  {item.width}×{item.height}
                </span>
              )}
            </div>
            <div className="mi">
              <div className="nm">{item.filename}</div>
              <div className="use">
                {kb(item.bytes)} · رفعها {item.uploadedBy}
              </div>
              {item.rightsCleared ? (
                <span className="th-gchip ok">حقوق موثقة</span>
              ) : (
                <span className="th-gchip warn">بانتظار توثيق الحقوق</span>
              )}
              <div className="acts">
                <button
                  className="th-mini"
                  onClick={() => {
                    navigator.clipboard.writeText(item.url);
                    setMessage(`نُسخ رابط ${item.filename}`);
                  }}
                >
                  انسخ الرابط
                </button>
                {canClear && (
                  <button className="th-mini" onClick={() => setRights(item.id, !item.rightsCleared)}>
                    {item.rightsCleared ? "اسحب التوثيق" : "وثّق الحقوق"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
