const MAX_BYTES = 4 * 1024 * 1024;

/** Send only the square avatar, not the full camera image over a slow connection. */
export async function prepareAvatarUpload(file: File): Promise<File> {
  if (!file.size || file.size > MAX_BYTES)
    throw new Error("اختر صورة لا تتجاوز 4 ميغابايت.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("استخدم صورة JPG أو PNG أو WebP.");
  const url = URL.createObjectURL(file);
  const photo = new Image();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<File>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("تعذر تجهيز الصورة. جرّب صورة أخرى.")), 8_000);
      photo.onerror = () => reject(new Error("تعذر قراءة الصورة. جرّب صورة أخرى."));
      photo.onload = () => {
        try {
          const side = Math.min(photo.naturalWidth, photo.naturalHeight);
          if (!side || photo.naturalWidth * photo.naturalHeight > 25_000_000)
            throw new Error("أبعاد الصورة كبيرة جدًا أو غير صالحة. جرّب صورة أصغر.");
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 384;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("تعذر تجهيز الصورة في المتصفح.");
          context.drawImage(photo, (photo.naturalWidth - side) / 2, (photo.naturalHeight - side) / 2, side, side, 0, 0, 384, 384);
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error("تعذر تجهيز الصورة. جرّب صورة أخرى."));
            resolve(new File([blob], blob.type === "image/webp" ? "avatar.webp" : "avatar.png", { type: blob.type }));
          }, "image/webp", 0.85);
        } catch (error) {
          reject(error);
        }
      };
      photo.src = url;
    });
  } finally {
    clearTimeout(timer);
    photo.onload = photo.onerror = null;
    photo.src = "";
    URL.revokeObjectURL(url);
  }
}

export async function saveAvatarRequest(endpoint: string, file?: File): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const body = new FormData();
    if (file) body.set("file", file);
    const response = await fetch(endpoint, {
      method: file ? "POST" : "DELETE",
      body: file ? body : undefined,
      signal: controller.signal,
    });
    if (response.status === 401 || response.redirected)
      throw new Error("انتهت الجلسة. سجّل الدخول ثم حاول مرة أخرى.");
    if (response.status === 413)
      throw new Error("حجم الصورة أكبر من المسموح. جرّب صورة أصغر.");
    const result = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(typeof result?.error === "string" ? result.error : "تعذر حفظ الصورة مؤقتًا. حاول مرة أخرى.");
    if (!result?.ok || !(typeof result.image === "string" || (!file && result.image === null)))
      throw new Error("تعذر التأكد من حفظ الصورة. حدّث الصفحة للتحقق ثم حاول مرة أخرى.");
    return result.image;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error("استغرق حفظ الصورة وقتًا أطول من المتوقع. حدّث الصفحة للتحقق قبل إعادة المحاولة.");
    if (error instanceof TypeError)
      throw new Error("تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مرة أخرى.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
