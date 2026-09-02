/**
 * روابط الفيديو — يوتيوب فقط حاليًا. وحدة نقية بلا اعتماديات تستوردها الواجهة والخادم وسكربت الهجرة.
 * القرار التحريري: نضمّن الفيديو وحده بلا قائمة تشغيل، حتى لا ينتقل القارئ بعده إلى مواد لا نتحكم بترتيبها.
 */

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** يستخرج معرّف يوتيوب من روابط المشاهدة والقصيرة والتضمين والـshorts — أو null لغير يوتيوب. */
export function youtubeIdFrom(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    // صيغتا المشاهدة: ?v=ID و/watch/ID (الأخيرة تظهر في روابط المشاركة من التطبيق).
    if (parts[0] === "watch") id = url.searchParams.get("v") ?? parts[1] ?? null;
    else if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" || parts[0] === "v") id = parts[1] ?? null;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/** الرابط القياسي المخزَّن: مشاهدة بلا قائمة تشغيل ولا توقيت — أو null إن لم يكن يوتيوب. */
export function normalizeVideoUrl(input: string | null | undefined): string | null {
  const id = youtubeIdFrom(input);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

/** رابط التضمين بالنسخة الخاصة بالخصوصية — الوحيد المسموح في frame-src. */
export function videoEmbedUrl(input: string | null | undefined): string | null {
  const id = youtubeIdFrom(input);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&hl=ar` : null;
}

const YOUTUBE_IN_TEXT = /https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\/[^\s"'<>)]+/gi;

/** أول رابط يوتيوب صالح داخل نص أو HTML — للمواد التي حُفظ رابطها في المتن لا في حقل الفيديو. */
export function findVideoUrlInText(text: string | null | undefined): string | null {
  for (const match of (text ?? "").matchAll(YOUTUBE_IN_TEXT)) {
    const normalized = normalizeVideoUrl(match[0].replace(/&amp;/g, "&"));
    if (normalized) return normalized;
  }
  return null;
}
