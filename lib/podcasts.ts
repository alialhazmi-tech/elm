/**
 * برامج بودكاست العلم — الحلقات من خلاصات RSS.com (المصدر القياسي نفسه الذي
 * تقرأ منه واجهة الموقع القديم)، بلا اعتماديات: جلب بكاش Next ومحلل XML مصغر.
 *
 * استيرادات نسبية عمدًا — الوحدة تدخل اختبارات node:test التي لا تعرف alias @/.
 * الحارس لا يفحص الحلقات: محتواها منشور مسبقًا على منصات البث ولا يمر بالنشر هنا.
 */

export interface PodcastShow {
  /** معرّف مادة البرنامج في stories — الرابط المقدس نفسه. */
  storyId: string;
  name: string;
  /** طابع البرنامج اللوني — من غلافه، للمشغل والبطاقات. */
  accent: string;
  /** خلاصة RSS.com — null لبرنامج بلا خلاصة (الغبوق: يوتيوب فقط كما في القديم). */
  feedUrl: string | null;
  youtube: string;
}

export const ALELM_YOUTUBE = "https://www.youtube.com/c/alelmmedia";

/** جرد 2026-08-28 من صفحات الموقع القديم — القيم من بيانات واجهته المضمنة. */
export const PODCAST_SHOWS: PodcastShow[] = [
  { storyId: "175839", name: "الغبوق", accent: "#b35c1e", feedUrl: null, youtube: ALELM_YOUTUBE },
  { storyId: "92137", name: "ملامح", accent: "#2B5C9E", feedUrl: "https://media.rss.com/malameh/feed.xml", youtube: ALELM_YOUTUBE },
  { storyId: "71148", name: "عتمة", accent: "#c9932e", feedUrl: "https://media.rss.com/atmahpodcast/feed.xml", youtube: ALELM_YOUTUBE },
  { storyId: "70190", name: "تقرير", accent: "#1f8f8a", feedUrl: "https://media.rss.com/alelmbodcast/feed.xml", youtube: ALELM_YOUTUBE },
];

export function podcastShowFor(storyId: string): PodcastShow | undefined {
  return PODCAST_SHOWS.find((show) => show.storyId === storyId);
}

export interface PodcastEpisode {
  title: string;
  audioUrl: string;
  mime: string;
  publishedAt: string | null;
  /** بصيغة الخلاصة كما هي: "23:45" أو ثوانٍ. */
  duration: string | null;
  description: string;
  episode: string | null;
  season: string | null;
}

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " } as const;

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED[name as keyof typeof NAMED] ?? m);
}

function textOf(block: string, tag: string): string {
  // اسم الوسم حرفيًا — حتى لا يلتقط itunes:episode وسم itunes:episodeType.
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  if (!match) return "";
  const raw = match[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
  return decodeEntities(raw.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** يحذف تكرار اسم البرنامج من عنوان الحلقة: «العلم | بودكاست عتمة | …». */
export function stripShowPrefix(title: string, showName: string): string {
  const escaped = showName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cleaned = title
    .replace(new RegExp(`^(?:العلم\\s*\\|\\s*)?(?:بودكاست\\s*)?${escaped}\\s*\\|\\s*`, "u"), "")
    .replace(/^العلم\s*\|\s*/u, "")
    // الذيل أيضًا: «… | بودكاست ملامح» أو «… | ملامح»
    .replace(new RegExp(`\\s*\\|\\s*(?:بودكاست\\s*)?${escaped}\\s*$`, "u"), "")
    .trim();
  return cleaned || title.trim();
}

/** المدة من الخلاصة: ثوانٍ («4517») أو ساعة:دقيقة:ثانية. */
export function formatPodcastDuration(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (/^\d+$/.test(value)) {
    const sec = Number(value);
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }
  return value;
}

export function presentEpisode(rawTitle: string, showName: string, description = ""): {
  title: string;
  guest: string | null;
} {
  const cleaned = stripShowPrefix(rawTitle, showName);
  const withGuest = /^(.*?)\s+مع\s+([^|،.]{2,40})$/u.exec(cleaned);
  if (withGuest?.[1]?.trim()) {
    return { title: withGuest[1].trim(), guest: withGuest[2].trim() };
  }
  const fromDesc = /ضيف(?:ة)?(?:\s+الحلقة)?[:\s]+([^\n،.]{2,40})/u.exec(description);
  return { title: cleaned, guest: fromDesc?.[1]?.trim() || null };
}

function attrOf(block: string, tag: string, attr: string): string {
  const match = new RegExp(`<${tag}[^>]*\\b${attr}="([^"]*)"`, "i").exec(block);
  return match ? decodeEntities(match[1]) : "";
}

const DESCRIPTION_MAX = 280;

/** يفكك خلاصة RSS إلى حلقات — دالة نقية تختبر مباشرة. */
export function parseRssEpisodes(xml: string): PodcastEpisode[] {
  const episodes: PodcastEpisode[] = [];
  for (const match of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const block = match[0];
    const audioUrl = attrOf(block, "enclosure", "url");
    if (!audioUrl) continue;
    const pubDate = textOf(block, "pubDate");
    const parsed = pubDate ? new Date(pubDate) : null;
    let description = textOf(block, "description");
    if (description.length > DESCRIPTION_MAX) {
      const cut = description.slice(0, DESCRIPTION_MAX + 1);
      const space = cut.lastIndexOf(" ");
      description = `${cut.slice(0, space > 180 ? space : DESCRIPTION_MAX).trim()}…`;
    }
    episodes.push({
      title: textOf(block, "title") || "حلقة",
      audioUrl,
      mime: attrOf(block, "enclosure", "type") || "audio/mpeg",
      publishedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null,
      duration: textOf(block, "itunes:duration") || null,
      description,
      episode: textOf(block, "itunes:episode") || null,
      season: textOf(block, "itunes:season") || null,
    });
  }
  return episodes;
}

const EPISODES_LIMIT = 30;

/** حلقات برنامج — كاش fetch عشر دقائق؛ أي فشل يعيد قائمة فارغة فيسقط العرض بأناقة. */
export async function fetchEpisodes(show: PodcastShow): Promise<PodcastEpisode[]> {
  if (!show.feedUrl) return [];
  try {
    const response = await fetch(show.feedUrl, {
      headers: { "User-Agent": "alelm-platform/1.0 (+https://alelm.net)" },
      next: { revalidate: 600 },
    } as RequestInit);
    if (!response.ok) return [];
    return parseRssEpisodes(await response.text()).slice(0, EPISODES_LIMIT);
  } catch {
    return [];
  }
}
