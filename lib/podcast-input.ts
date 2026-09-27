/**
 * تحقق مدخلات البودكاست من اللوحة — دوال نقية تختبر مباشرة.
 * استيرادات نسبية عمدًا — الوحدة تدخل اختبارات node:test التي لا تعرف alias @/.
 */

import { ALELM_YOUTUBE } from "./podcasts.ts";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** معرّف البرنامج = رابط صفحته؛ يبدأ بحرف فلا يلتبس بمعرّفات المواد الرقمية في /podcasts/<id>. */
export const PODCAST_SHOW_ID = /^[a-z][a-z0-9-]{0,38}[a-z0-9]$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const COVER_PATH = /^\/(?:uploads\/[0-9a-f-]{36}\.(?:jpg|png|webp)|podcasts\/[a-z0-9-]+\.(?:jpg|png|webp))$/;

export const MAX_AUDIO_BYTES = 500 * 1024 * 1024;
/** 8MB: فوق حد S3 الأدنى للجزء (5MB) وأقل كثيرًا من حد طلب Cloudflare. */
export const AUDIO_PART_BYTES = 8 * 1024 * 1024;
export const MAX_AUDIO_PARTS = Math.ceil(MAX_AUDIO_BYTES / AUDIO_PART_BYTES);

export type AudioKind = { ext: "mp3" | "m4a"; mime: "audio/mpeg" | "audio/mp4" };
const KINDS: Record<AudioKind["ext"], AudioKind> = {
  mp3: { ext: "mp3", mime: "audio/mpeg" },
  m4a: { ext: "m4a", mime: "audio/mp4" },
};

export interface ShowInput {
  id: string;
  name: string;
  description: string;
  cover: string | null;
  accent: string;
  feedUrl: string | null;
  youtube: string;
  visible: boolean;
}

export interface EpisodeInput {
  showId: string;
  title: string;
  guest: string;
  description: string;
  publishedAt: string;
  durationSeconds: number | null;
  visible: boolean;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.normalize("NFC").replace(/\s+/g, " ").trim() : "";
}

function paragraph(value: unknown): string {
  return typeof value === "string" ? value.normalize("NFC").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim() : "";
}

function httpsUrl(value: unknown): string | null | undefined {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname.includes(".") ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** برنامج جديد (creating) أو تعديل؛ المعرّف لا يتغير بعد الإنشاء فيُتجاهل في التعديل. */
export function validateShowInput(raw: unknown, current?: { id: string }): Result<ShowInput> {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const id = current ? current.id : text(body.id).toLowerCase();
  if (!PODCAST_SHOW_ID.test(id)) {
    return { ok: false, error: "رابط البرنامج: حروف لاتينية صغيرة وأرقام وشرطات، ويبدأ بحرف (من 2 إلى 40)." };
  }
  const name = text(body.name);
  if (name.length < 2 || name.length > 60) return { ok: false, error: "اسم البرنامج بين حرفين و60 حرفًا." };
  const description = paragraph(body.description);
  if (description.length > 600) return { ok: false, error: "الوصف حتى 600 حرف." };
  const cover = text(body.cover) || null;
  if (cover && !COVER_PATH.test(cover)) return { ok: false, error: "ارفع الغلاف من الحقل المخصص له." };
  const accent = text(body.accent);
  if (!HEX_COLOR.test(accent)) return { ok: false, error: "اختر لون البرنامج." };
  const feedUrl = httpsUrl(body.feedUrl);
  if (feedUrl === undefined) return { ok: false, error: "رابط خلاصة RSS يجب أن يبدأ بـ https://" };
  const youtube = httpsUrl(body.youtube);
  if (youtube === undefined) return { ok: false, error: "رابط يوتيوب يجب أن يبدأ بـ https://" };
  return {
    ok: true,
    value: { id, name, description, cover, accent: accent.toLowerCase(), feedUrl, youtube: youtube ?? ALELM_YOUTUBE, visible: body.visible !== false },
  };
}

/** تاريخ الحلقة يرتبها في القوائم؛ لا جدولة هنا، فالمستقبل البعيد مرفوض. */
export function validateEpisodeInput(raw: unknown, now = new Date()): Result<EpisodeInput> {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const showId = text(body.showId);
  if (!PODCAST_SHOW_ID.test(showId)) return { ok: false, error: "اختر البرنامج." };
  const title = text(body.title);
  if (title.length < 2 || title.length > 200) return { ok: false, error: "عنوان الحلقة بين حرفين و200 حرف." };
  const guest = text(body.guest);
  if (guest.length > 80) return { ok: false, error: "اسم الضيف حتى 80 حرفًا." };
  const description = paragraph(body.description);
  if (description.length > 2000) return { ok: false, error: "الوصف حتى 2000 حرف." };
  const rawDate = text(body.publishedAt);
  const date = rawDate ? new Date(rawDate) : now;
  if (Number.isNaN(date.getTime())) return { ok: false, error: "تاريخ الحلقة غير صالح." };
  if (date.getTime() > now.getTime() + 24 * 3600_000) return { ok: false, error: "تاريخ الحلقة لا يكون في المستقبل." };
  const seconds = body.durationSeconds == null || body.durationSeconds === "" ? null : Number(body.durationSeconds);
  if (seconds !== null && (!Number.isInteger(seconds) || seconds < 1 || seconds > 36_000)) {
    return { ok: false, error: "مدة الحلقة غير صالحة." };
  }
  return { ok: true, value: { showId, title, guest, description, publishedAt: date.toISOString(), durationSeconds: seconds, visible: body.visible !== false } };
}

/** الصيغة من امتداد الاسم؛ المحتوى يُتحقق منه بعد الرفع ببايتاته الأولى. */
export function audioKindFor(filename: unknown): AudioKind | null {
  const match = /\.(mp3|m4a)$/i.exec(typeof filename === "string" ? filename.trim() : "");
  return match ? KINDS[match[1].toLowerCase() as AudioKind["ext"]] : null;
}

/** بايتات البداية: ID3 أو إطار MPEG لـMP3، وصندوق ftyp لـM4A. */
export function sniffAudio(head: Uint8Array): AudioKind["ext"] | null {
  if (head.length >= 3 && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) return "mp3";
  if (head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return "mp3";
  if (head.length >= 8 && head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) return "m4a";
  return null;
}

const UPLOAD_KEY = /^podcasts\/episodes\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(mp3|m4a)$/;

export function uploadObjectKey(id: string, kind: AudioKind): string {
  return `podcasts/episodes/${id}.${kind.ext}`;
}

/** مفتاح رفع من اللوحة فقط — لا يكتب طلب الرفع خارج مجلد الحلقات. */
export function parseUploadKey(key: unknown): { filename: string; kind: AudioKind } | null {
  const match = typeof key === "string" ? UPLOAD_KEY.exec(key) : null;
  if (!match) return null;
  return { filename: `${match[1]}.${match[2]}`, kind: KINDS[match[2] as AudioKind["ext"]] };
}

export function validateAudioUpload(raw: unknown): Result<{ kind: AudioKind; size: number }> {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const kind = audioKindFor(body.filename);
  if (!kind) return { ok: false, error: "الصيغ المقبولة: MP3 أو M4A." };
  const size = Number(body.size);
  if (!Number.isSafeInteger(size) || size < 1) return { ok: false, error: "الملف فارغ." };
  if (size > MAX_AUDIO_BYTES) return { ok: false, error: "الحد الأقصى 500 ميجابايت." };
  return { ok: true, value: { kind, size } };
}

/** رقم الجزء 1..10000 كما في S3؛ حدنا الفعلي من الحجم الأقصى. */
export function validPartNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_AUDIO_PARTS ? n : null;
}
