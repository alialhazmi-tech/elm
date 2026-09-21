/**
 * برامج بودكاست العلم — خلاصات RSS.com مع حلقات صوتية أصلية زوّدنا بها مالك البرنامج.
 * جلب بكاش Next ومحلل XML مصغر؛ الملفات الكبيرة محفوظة في مخزن الوسائط.
 *
 * استيرادات نسبية عمدًا — الوحدة تدخل اختبارات node:test التي لا تعرف alias @/.
 * الحارس لا يفحص الحلقات: محتواها منشور مسبقًا على منصات البث ولا يمر بالنشر هنا.
 */

export interface PodcastShow {
  /** معرّف مادة البرنامج في stories — الرابط المقدس نفسه. */
  storyId: string;
  name: string;
  /** غلاف معتمد للبرنامج؛ عند غيابه تُستخدم صورة المادة. */
  cover?: string;
  /** طابع البرنامج اللوني — من غلافه، للمشغل والبطاقات. */
  accent: string;
  /** خلاصة RSS.com — null لبرنامج لا تتوفر له خلاصة صوتية. */
  feedUrl: string | null;
  youtube: string;
}

export const ALELM_YOUTUBE = "https://www.youtube.com/c/alelmmedia";

/** برامج الموقع القديم؛ رُبط الغبوق بخلاصته الصوتية المتحققة في 2026-09-07. */
export const PODCAST_SHOWS: PodcastShow[] = [
  { storyId: "175839", name: "الغبوق", cover: "/podcasts/alghabouq.jpg", accent: "#b35c1e", feedUrl: "https://media.rss.com/alghabouk/feed.xml", youtube: ALELM_YOUTUBE },
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

/** ملفات أصلية من مجلد المالك؛ الاسم يتضمن بصمة المحتوى للكاش الدائم. */
export const HOSTED_PODCAST_AUDIO = [
  {
    showId: "175839",
    filename: "_UGwxxWb4iw-40add49a9b5e.m4a",
    byteLength: 68374801,
    sha256: "40add49a9b5e5b511173a79f7659638b53a6071e59ee21252f05554331ab09de",
    sourceUrl: "https://www.youtube.com/watch?v=_UGwxxWb4iw",
    title: "لماذا أصبحت تربية الأطفال مهمة شاقة؟",
    guest: "همام الحارثي",
    publishedAt: "2026-08-18T18:29:50.000Z",
    duration: "4228",
  },
  {
    showId: "175839",
    filename: "KP5TyvDbRBY-46d745aa20f7.m4a",
    byteLength: 107746799,
    sha256: "46d745aa20f7da08ef9a8117f6beb9c3ef03401f3db0c39909014ad6bda8a6e2",
    sourceUrl: "https://www.youtube.com/watch?v=KP5TyvDbRBY",
    title: "العقل الذي لا نعرفه.. كيف يصنع أفكارنا وسلوكنا؟",
    guest: "طالب خفاجي",
    publishedAt: "2026-07-16T18:10:50.000Z",
    duration: "6662",
  },
] as const;

function normalizedEpisodeTitle(title: string): string {
  return title.normalize("NFKD").replace(/[\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** تفضيل RSS إذا نُشرت الحلقة فيه لاحقًا، مع استمرار الملفات الأصلية عند تعطله. */
export function mergePodcastEpisodes(showId: string, rss: PodcastEpisode[]): PodcastEpisode[] {
  const hosted = HOSTED_PODCAST_AUDIO.filter((audio) => audio.showId === showId)
    .filter((audio) => !rss.some((episode) =>
      normalizedEpisodeTitle(episode.title).includes(normalizedEpisodeTitle(audio.title))))
    .map((audio): PodcastEpisode => ({
      title: `${audio.title} مع ${audio.guest}`,
      audioUrl: `/podcast-audio/${audio.filename}`,
      mime: "audio/mp4",
      publishedAt: audio.publishedAt,
      duration: audio.duration,
      description: "",
      episode: null,
      season: null,
    }));
  return [...rss, ...hosted]
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, EPISODES_LIMIT);
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

/** حلقات برنامج — كاش RSS عشر دقائق مع الحلقات المحفوظة في مخزن الموقع. */
export async function fetchEpisodes(show: PodcastShow): Promise<PodcastEpisode[]> {
  if (!show.feedUrl) return mergePodcastEpisodes(show.storyId, []);
  try {
    const response = await fetch(show.feedUrl, {
      headers: { "User-Agent": "alelm-platform/1.0 (+https://alelm.net)" },
      next: { revalidate: 600 },
    } as RequestInit);
    if (!response.ok) return mergePodcastEpisodes(show.storyId, []);
    return mergePodcastEpisodes(show.storyId, parseRssEpisodes(await response.text()));
  } catch {
    return mergePodcastEpisodes(show.storyId, []);
  }
}
