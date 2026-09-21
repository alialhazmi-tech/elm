import sharp from "sharp";
import { putStoredImage } from "./images";
export const MAX_AVATAR_BYTES = 4 * 1024 * 1024;
export class AvatarError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
/** Limit streamed multipart input too, including requests without Content-Length. */
export async function readAvatarFile(request: Request): Promise<File> {
  const limit = MAX_AVATAR_BYTES + 64 * 1024;
  if (Number(request.headers.get("content-length")) > limit)
    throw new AvatarError("الحد الأقصى للصورة 4 ميغابايت.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AvatarError("اختر صورة أولًا.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const deadline = AbortSignal.timeout(20_000);
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  deadline.addEventListener("abort", cancel, { once: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (deadline.aborted)
        throw new AvatarError("انتهت مهلة رفع الصورة. تحقق من اتصالك وحاول مرة أخرى.", 408);
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new AvatarError("الحد الأقصى للصورة 4 ميغابايت.", 413);
      }
      chunks.push(value);
    }
  } finally {
    deadline.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  const form = await new Response(Buffer.concat(chunks), {
    headers: { "Content-Type": request.headers.get("content-type") ?? "" },
  })
    .formData()
    .catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new AvatarError("اختر صورة أولًا.");
  return file;
}
export async function prepareAvatar(file: File) {
  if (!file.size || file.size > MAX_AVATAR_BYTES)
    throw new AvatarError("اختر صورة لا تتجاوز 4 ميغابايت.", 413);
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, {
      limitInputPixels: 25_000_000,
      failOn: "warning",
    });
    const meta = await image.metadata();
    if (
      !meta.format ||
      !["jpeg", "png", "webp"].includes(meta.format) ||
      (meta.pages ?? 1) > 1
    )
      throw new Error("format");
    // Re-encoding strips EXIF (including GPS) and ignores the client MIME/filename.
    return await image
      .rotate()
      .resize(384, 384, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new AvatarError(
      "الصورة غير صالحة. استخدم JPG أو PNG أو WebP ثابتة.",
      415,
    );
  }
}
export async function storeAvatar(file: File) {
  const body = await prepareAvatar(file);
  const filename = `${crypto.randomUUID()}.webp`;
  const signal = AbortSignal.timeout(15_000);
  try {
    await putStoredImage({ filename, body, contentType: "image/webp", signal });
  } catch (error) {
    if (signal.aborted)
      throw new AvatarError("تعذر الاتصال بمخزن الصور في الوقت المحدد. حاول مرة أخرى.", 504);
    throw error;
  }
  return `/uploads/${filename}`;
}
