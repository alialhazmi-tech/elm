/**
 * روابط الفيديو — يوتيوب وتغريدات X. وحدة نقية تستوردها الواجهة والخادم وسكربت الهجرة.
 * يوتيوب يُحفظ بلا قائمة تشغيل؛ X يعرض مشغّل الفيديو المنفصل.
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
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
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

/** رابط تغريدة عامة، وليس رابط حساب أو بحث أو مضيف يشبه X. */
export function xPostIdFrom(input: string | null | undefined): string | null {
  let url: URL;
  try { url = new URL((input ?? "").trim()); } catch { return null; }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
  if (!/^(?:(?:www|mobile|m)\.)?(?:x|twitter)\.com$/.test(url.hostname)) return null;
  const match = url.pathname.match(/^\/(?:[A-Za-z0-9_]{1,15}\/status|i\/(?:web\/)?status)\/([1-9][0-9]{0,19})(?:\/(?:video|photo)\/[1-9][0-9]*)?\/?$/);
  return match?.[1] ?? null;
}

/** الرابط القياسي المخزَّن بلا معلمات تتبع أو قائمة تشغيل. */
export function normalizeVideoUrl(input: string | null | undefined): string | null {
  const id = youtubeIdFrom(input);
  if (id) return `https://www.youtube.com/watch?v=${id}`;
  const postId = xPostIdFrom(input);
  return postId ? `https://x.com/i/status/${postId}` : null;
}

/** مشغّل الفيديو وحده: يوتيوب أو مشغّل فيديو التغريدة المستقل. */
export function videoEmbedUrl(input: string | null | undefined): string | null {
  const id = youtubeIdFrom(input);
  if (id) return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&hl=ar`;
  const postId = xPostIdFrom(input);
  return postId ? `https://twitter.com/i/videos/tweet/${postId}?language_code=ar&dnt=true` : null;
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
