/**
 * رفع ملف حلقة من المتصفح على أجزاء عبر /api/tahrir/podcasts/uploads:
 * بدء الجلسة، ثم الأجزاء (ثلاثة متوازية، لكل جزء ثلاث محاولات)، ثم الختم.
 * الإلغاء يحرر الأجزاء في المخزن.
 */

import { apiCall } from "./client-api";

export type UploadedAudio = { key: string; filename: string; bytes: number };
export type UploadProgress = { sent: number; total: number };

type Session = { key: string; uploadId: string; partSize: number; parts: number };

const CONCURRENCY = 3;
const ATTEMPTS = 3;

class UploadError extends Error {
  constructor(message: string, readonly retry = true) {
    super(message);
  }
}

function sendPart(url: string, body: Blob, signal: AbortSignal, onProgress: (loaded: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = "تعذر رفع جزء من الملف.";
      try {
        message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message;
      } catch { /* استجابة وكيل غير JSON */ }
      // الجلسة المنتهية والصلاحيات لا تُصلحها إعادة المحاولة.
      reject(new UploadError(message, ![400, 401, 403, 410, 413].includes(xhr.status)));
    };
    xhr.onerror = () => reject(new UploadError("انقطع الاتصال أثناء الرفع."));
    xhr.ontimeout = () => reject(new UploadError("انتهت مهلة رفع الجزء."));
    xhr.timeout = 120_000;
    const abort = () => xhr.abort();
    signal.addEventListener("abort", abort, { once: true });
    xhr.onabort = () => reject(new DOMException("أُلغي الرفع.", "AbortError"));
    xhr.onloadend = () => signal.removeEventListener("abort", abort);
    xhr.send(body);
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function uploadPodcastAudio(
  file: File,
  { signal, onProgress }: { signal: AbortSignal; onProgress: (progress: UploadProgress) => void },
): Promise<UploadedAudio> {
  const started = await apiCall<Session>("/api/tahrir/podcasts/uploads", {
    method: "POST",
    body: { filename: file.name, size: file.size },
    signal,
  }, { fallback: "تعذر بدء الرفع." });
  if (!started.ok) throw new UploadError(started.error, false);
  const session = started.data;
  const loaded = new Array<number>(session.parts).fill(0);
  const report = () => onProgress({ sent: loaded.reduce((sum, value) => sum + value, 0), total: file.size });

  try {
    let next = 0;
    const worker = async () => {
      while (next < session.parts) {
        const index = next++;
        const blob = file.slice(index * session.partSize, Math.min(file.size, (index + 1) * session.partSize));
        const url = `/api/tahrir/podcasts/uploads/part?${new URLSearchParams({ key: session.key, uploadId: session.uploadId, part: String(index + 1) })}`;
        for (let attempt = 1; ; attempt++) {
          try {
            await sendPart(url, blob, signal, (value) => {
              loaded[index] = value;
              report();
            });
            loaded[index] = blob.size;
            report();
            break;
          } catch (error) {
            loaded[index] = 0;
            report();
            if (signal.aborted || !(error instanceof UploadError) || !error.retry || attempt >= ATTEMPTS) throw error;
            await wait(1500 * attempt);
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, session.parts) }, worker));

    const done = await apiCall<UploadedAudio>("/api/tahrir/podcasts/uploads/complete", {
      method: "POST",
      body: { key: session.key, uploadId: session.uploadId, size: file.size },
      signal,
    }, { fallback: "تعذر إكمال الرفع.", timeoutMs: 120_000 });
    if (!done.ok) throw new UploadError(done.error, false);
    return done.data;
  } catch (error) {
    // الإلغاء أو الفشل: تحرير الأجزاء المحفوظة؛ فشل التحرير لا يغطي الخطأ الأصلي.
    void apiCall("/api/tahrir/podcasts/uploads", { method: "DELETE", body: { key: session.key, uploadId: session.uploadId } });
    throw error;
  }
}

/** مدة الملف من ترويسته في المتصفح؛ null إن لم يعرفها. */
export function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const finish = (value: number | null) => {
      URL.revokeObjectURL(url);
      audio.removeAttribute("src");
      resolve(value);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration) : null);
    audio.onerror = () => finish(null);
    setTimeout(() => finish(null), 15_000);
    audio.src = url;
  });
}

export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)} ميجابايت`;
}
