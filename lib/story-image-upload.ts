const MAX_BYTES = 8 * 1024 * 1024;
const UPLOAD_URL = /^\/uploads\/[0-9a-f-]{36}\.(?:png|jpg|webp)$/i;

/** null means the browser sent the file and is waiting for storage confirmation. */
export async function uploadStoryImageFile(
  file: File,
  onProgress: (percent: number | null) => void,
): Promise<{ url: string }> {
  if (!file.size) throw new Error("الصورة فارغة. اختر ملف صورة صالحًا.");
  if (file.size > MAX_BYTES) throw new Error("الحد الأقصى للصورة 8 ميغابايت.");

  return new Promise((resolve, reject) => {
    // XHR exposes upload progress separately from the server's response.
    // Send the original file so infographic text and dimensions stay intact.
    const request = new XMLHttpRequest();
    request.open("POST", "/api/tahrir/media");
    request.timeout = 90_000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(100, Math.round(event.loaded / event.total * 100)));
    };
    request.upload.onload = () => onProgress(null);
    request.onerror = () => reject(new Error("انقطع الاتصال أثناء رفع الصورة. تحقق من اتصالك ثم أعد المحاولة."));
    request.onabort = () => reject(new Error("أُلغي رفع الصورة. يمكنك اختيارها مجددًا."));
    request.ontimeout = () => reject(new Error("انتهت مهلة رفع الصورة. تحقق من مكتبة الوسائط قبل إعادة المحاولة."));
    request.onload = () => {
      if (request.status === 401 || /\/tahrir\/login(?:[/?#]|$)/.test(request.responseURL)) {
        reject(new Error("انتهت الجلسة. احفظ نص المادة ثم سجّل الدخول وأعد المحاولة."));
        return;
      }
      if (request.status === 413) {
        reject(new Error("حجم الصورة أكبر من المسموح. الحد الأقصى 8 ميغابايت."));
        return;
      }
      let data;
      try { data = JSON.parse(request.responseText); } catch { /* Proxy errors may return HTML. */ }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(typeof data?.error === "string" ? data.error : "تعذر إكمال الرفع على الخادم. حاول مرة أخرى."));
        return;
      }
      if (data?.ok !== true || typeof data.url !== "string" || !UPLOAD_URL.test(data.url)) {
        reject(new Error("لم يصل تأكيد حفظ الصورة. تحقق من مكتبة الوسائط قبل إعادة المحاولة."));
        return;
      }
      resolve({ url: data.url });
    };
    const form = new FormData();
    form.append("file", file);
    request.send(form);
  });
}
