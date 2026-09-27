/**
 * برامج بودكاست العلم — خلاصات RSS.com مع حلقات صوتية أصلية زوّدنا بها مالك البرنامج.
 * جلب بكاش Next ومحلل XML مصغر؛ الملفات الكبيرة محفوظة في مخزن الوسائط.
 *
 * استيرادات نسبية عمدًا — الوحدة تدخل اختبارات node:test التي لا تعرف alias @/.
 * الحارس لا يفحص الحلقات: محتواها منشور مسبقًا على منصات البث ولا يمر بالنشر هنا.
 */

export interface PodcastShow {
  /** معرّف لاتيني ثابت — رابط الصفحة /podcasts/<id> للبرنامج الذي لا مادة له. */
  id: string;
  /** مادة صفحة البرنامج القديمة (الرابط المقدس)؛ null لبرنامج أُنشئ من اللوحة. */
  storyId: string | null;
  name: string;
  /** وصف البرنامج؛ فارغ في البرامج القديمة فيُستعمل ملخص مادتها. */
  description: string;
  /** غلاف معتمد للبرنامج؛ عند غيابه تُستخدم صورة المادة. */
  cover?: string;
  /** طابع البرنامج اللوني — من غلافه، للمشغل والبطاقات. */
  accent: string;
  /** خلاصة RSS.com — null لبرنامج لا تتوفر له خلاصة صوتية. */
  feedUrl: string | null;
  youtube: string;
}

export const ALELM_YOUTUBE = "https://www.youtube.com/c/alelmmedia";

/**
 * بذرة البرامج — مطابقة لترحيل 0020؛ تُقرأ فقط حين لا تتوفر قاعدة (البناء والاختبارات)
 * أو فشل الاستعلام. رُبط الغبوق بخلاصته الصوتية المتحققة في 2026-09-07.
 */
export const PODCAST_SHOWS: PodcastShow[] = [
  { id: "alghabouq", storyId: "175839", name: "الغبوق", description: "", cover: "/podcasts/alghabouq.jpg", accent: "#b35c1e", feedUrl: "https://media.rss.com/alghabouk/feed.xml", youtube: ALELM_YOUTUBE },
  { id: "malameh", storyId: "92137", name: "ملامح", description: "", accent: "#2B5C9E", feedUrl: "https://media.rss.com/malameh/feed.xml", youtube: ALELM_YOUTUBE },
  { id: "atmah", storyId: "71148", name: "عتمة", description: "", accent: "#c9932e", feedUrl: "https://media.rss.com/atmahpodcast/feed.xml", youtube: ALELM_YOUTUBE },
  { id: "taqrir", storyId: "70190", name: "تقرير", description: "", accent: "#1f8f8a", feedUrl: "https://media.rss.com/alelmbodcast/feed.xml", youtube: ALELM_YOUTUBE },
];

export function podcastShowFor(storyId: string): PodcastShow | undefined {
  return PODCAST_SHOWS.find((show) => show.storyId === storyId);
}

/** صفحة البرنامج: مادته القديمة إن وُجدت (يمررها المستدعي)، وإلا /podcasts/<id>. */
export function podcastShowPath(show: Pick<PodcastShow, "id">): string {
  return `/podcasts/${show.id}`;
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
  /** ضيف معروف مسبقًا (الحلقات المرفوعة)؛ null لحلقات الخلاصة فيُستخرج من العنوان. */
  guest?: string | null;
}

/** حلقة ملفها في مخزن الموقع — من جدول podcast_episodes أو بذرته أدناه. */
export interface HostedPodcastAudio {
  id: string;
  showId: string;
  filename: string;
  objectKey: string;
  mime: string;
  byteLength: number;
  /** بصمة المحتوى للـETag: sha256 للملفات القديمة، وETag المخزن للمرفوعة من اللوحة. */
  etag: string;
  title: string;
  guest: string;
  description: string;
  publishedAt: string;
  durationSeconds: number | null;
  sourceUrl: string | null;
  visible: boolean;
}

/** بذرة الحلقات المستضافة — مطابقة لترحيل 0020؛ ملفات أصلية من مجلد المالك. */
export const HOSTED_PODCAST_AUDIO: HostedPodcastAudio[] = [
  {
    id: "hosted-alsubai-reading",
    showId: "alghabouq",
    filename: "alsubai-reading-b8cb32089f7b.m4a",
    objectKey: "podcasts/alghabouq/alsubai-reading-b8cb32089f7b.m4a",
    mime: "audio/mp4",
    byteLength: 73160584,
    etag: "b8cb32089f7b9cfabe85ed20e879beb1208e4d4db0c93db006024492ab3f4118",
    sourceUrl: "https://drive.google.com/file/d/1uqCmFFynmV5enli3AQmrIGLGskoGpvdM/view",
    title: "كيف نصبح قرّاء أفضل؟",
    guest: "د. محمد الصبي",
    publishedAt: "2026-09-27T14:43:00.000Z",
    durationSeconds: 4517,
    description: "القراءة السريعة ليست مجرد تحصيل كلمات أكثر في وقت أقل.. في هذه الحلقة من بودكاست الغبوق، نستكشف مع د. محمد الصبي، عميد الأكاديمية العربية للقراءة السريعة، كيف تتحول القراءة إلى مهارة أكثر كفاءة، وكيف يساعد التدريب على زيادة سرعة القراءة مع الحفاظ على الفهم والاستيعاب.",
    visible: true,
  },
  {
    id: "hosted-_UGwxxWb4iw",
    showId: "alghabouq",
    filename: "_UGwxxWb4iw-40add49a9b5e.m4a",
    objectKey: "podcasts/alghabouq/_UGwxxWb4iw-40add49a9b5e.m4a",
    mime: "audio/mp4",
    byteLength: 68374801,
    etag: "40add49a9b5e5b511173a79f7659638b53a6071e59ee21252f05554331ab09de",
    sourceUrl: "https://www.youtube.com/watch?v=_UGwxxWb4iw",
    title: "لماذا أصبحت تربية الأطفال مهمة شاقة؟",
    guest: "همام الحارثي",
    publishedAt: "2026-08-18T18:29:50.000Z",
    durationSeconds: 4228,
    description: "",
    visible: true,
  },
  {
    id: "hosted-KP5TyvDbRBY",
    showId: "alghabouq",
    filename: "KP5TyvDbRBY-46d745aa20f7.m4a",
    objectKey: "podcasts/alghabouq/KP5TyvDbRBY-46d745aa20f7.m4a",
    mime: "audio/mp4",
    byteLength: 107746799,
    etag: "46d745aa20f7da08ef9a8117f6beb9c3ef03401f3db0c39909014ad6bda8a6e2",
    sourceUrl: "https://www.youtube.com/watch?v=KP5TyvDbRBY",
    title: "العقل الذي لا نعرفه.. كيف يصنع أفكارنا وسلوكنا؟",
    guest: "طالب خفاجي",
    publishedAt: "2026-07-16T18:10:50.000Z",
    durationSeconds: 6662,
    description: "",
    visible: true,
  },
];

export function seedHostedFor(showId: string): HostedPodcastAudio[] {
  return HOSTED_PODCAST_AUDIO.filter((audio) => audio.showId === showId);
}

function normalizedEpisodeTitle(title: string): string {
  return title.normalize("NFKD").replace(/[\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** الحلقة المستضافة بصيغة الخلاصة، وضيفها حقل مستقل لا يُفكك من العنوان. */
export function hostedEpisode(audio: HostedPodcastAudio): PodcastEpisode {
  return {
    title: audio.title,
    guest: audio.guest || null,
    audioUrl: `/podcast-audio/${audio.filename}`,
    mime: audio.mime,
    publishedAt: audio.publishedAt,
    duration: audio.durationSeconds ? String(audio.durationSeconds) : null,
    description: audio.description,
    episode: null,
    season: null,
  };
}

/** تفضيل RSS إذا نُشرت الحلقة فيه لاحقًا، مع استمرار الملفات المستضافة عند تعطله. */
export function mergePodcastEpisodes(rss: PodcastEpisode[], hosted: readonly HostedPodcastAudio[]): PodcastEpisode[] {
  const own = hosted.filter((audio) => audio.visible)
    .filter((audio) => !rss.some((episode) =>
      normalizedEpisodeTitle(episode.title).includes(normalizedEpisodeTitle(audio.title))))
    .map(hostedEpisode);
  return [...rss, ...own]
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

export function presentEpisode(rawTitle: string, showName: string, description = "", knownGuest?: string | null): {
  title: string;
  guest: string | null;
} {
  const cleaned = stripShowPrefix(rawTitle, showName);
  if (knownGuest) return { title: cleaned, guest: knownGuest };
  // لقب مختصر قبل الاسم («د. فلان») لا يُعد نهاية للاسم.
  const withGuest = /^(.*?)\s+مع\s+((?:[دأم]\.\s*)?[^|،.]{2,40})$/u.exec(cleaned);
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

/** حلقات خلاصة RSS — كاش عشر دقائق؛ أي فشل يعطي قائمة فارغة لا خطأ. */
export async function fetchRssEpisodes(feedUrl: string | null): Promise<PodcastEpisode[]> {
  if (!feedUrl) return [];
  try {
    const response = await fetch(feedUrl, {
      headers: { "User-Agent": "alelm-platform/1.0 (+https://alelm.net)" },
      next: { revalidate: 600 },
    } as RequestInit);
    if (!response.ok) return [];
    return parseRssEpisodes(await response.text());
  } catch {
    return [];
  }
}

/** حلقات برنامج: الخلاصة مع الحلقات المستضافة (من القاعدة يمررها المستدعي، وإلا البذرة). */
export async function fetchEpisodes(
  show: PodcastShow,
  hosted: readonly HostedPodcastAudio[] = seedHostedFor(show.id),
): Promise<PodcastEpisode[]> {
  return mergePodcastEpisodes(await fetchRssEpisodes(show.feedUrl), hosted);
}
