/**
 * روابط الفيديو — يوتيوب وتغريدات X ومنشورات Instagram. وحدة نقية تستوردها الواجهة والخادم وسكربت الهجرة.
 * يوتيوب يُحفظ بلا قائمة تشغيل؛ X يعرض مشغّل الفيديو المنفصل، وInstagram يعرض تضمين المنشور الأصلي.
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

/** يطبع رابط منشور Instagram؛ صلاحية النشر العام ونوع الوسائط يحددهما مزود التضمين. */
export function instagramPostUrlFrom(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;

  // URL.port is empty for an explicitly supplied default port (for example :443),
  // so inspect the authority as well to reject every explicit port.
  const authority = raw.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i)?.[1] ?? "";
  const hostWithoutCredentials = authority.slice(authority.lastIndexOf("@") + 1);
  if (url.port || hostWithoutCredentials.includes(":")) return null;

  // Reject paths that URL parsing would silently normalize (dot segments,
  // backslashes, or other malformed spellings).
  const rawPath = raw.match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*(\/[^?#]*)?/i)?.[1] ?? "/";
  if (rawPath !== url.pathname) return null;

  if (url.hostname !== "instagram.com" && url.hostname !== "www.instagram.com" && url.hostname !== "m.instagram.com") {
    return null;
  }

  const match = url.pathname.match(/^\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)\/?$/);
  if (!match) return null;

  const kind = match[1] === "reels" ? "reel" : match[1];
  return `https://www.instagram.com/${kind}/${match[2]}/`;
}

/** الرابط القياسي المخزَّن بلا معلمات تتبع أو قائمة تشغيل. */
export function normalizeVideoUrl(input: string | null | undefined): string | null {
  const id = youtubeIdFrom(input);
  if (id) return `https://www.youtube.com/watch?v=${id}`;
  const postId = xPostIdFrom(input);
  if (postId) return `https://x.com/i/status/${postId}`;
  return instagramPostUrlFrom(input);
}

/** مشغّل يوتيوب أو فيديو X المنفصل أو تضمين منشور Instagram الأصلي. */
export function videoEmbedUrl(input: string | null | undefined): string | null {
  const id = youtubeIdFrom(input);
  if (id) return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&hl=ar`;
  const postId = xPostIdFrom(input);
  if (postId) return `https://twitter.com/i/videos/tweet/${postId}?language_code=ar&dnt=true`;
  const instagramUrl = instagramPostUrlFrom(input);
  return instagramUrl ? `${instagramUrl}embed/` : null;
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
