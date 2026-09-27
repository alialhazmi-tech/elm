import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AUDIO_PART_BYTES,
  MAX_AUDIO_BYTES,
  PODCAST_SHOW_ID,
  audioKindFor,
  parseUploadKey,
  sniffAudio,
  uploadObjectKey,
  validPartNumber,
  validateAudioUpload,
  validateEpisodeInput,
  validateShowInput,
} from "../lib/podcast-input.ts";
import { HOSTED_PODCAST_AUDIO, PODCAST_SHOWS } from "../lib/podcasts.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("رابط البرنامج لاتيني يبدأ بحرف فلا يلتبس برقم مادة في /podcasts/<id>", () => {
  for (const id of ["majalis", "al-ghabouq", "s2"]) assert.ok(PODCAST_SHOW_ID.test(id), id);
  for (const id of ["175839", "Majalis", "-x", "x-", "مجالس", "a", "a".repeat(41), "a/b"]) assert.equal(PODCAST_SHOW_ID.test(id), false, id);
});

test("برنامج جديد: الحقول تُنظَّف والروابط https فقط والمعرّف لا يتغير في التعديل", () => {
  const ok = validateShowInput({ id: " Majalis ", name: "  مجالس  ", description: "سطر\r\n\r\n\r\nثانٍ", accent: "#7B3B5C", feedUrl: "", youtube: "", visible: false });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value, {
    id: "majalis", name: "مجالس", description: "سطر\n\nثانٍ", cover: null, accent: "#7b3b5c",
    feedUrl: null, youtube: "https://www.youtube.com/c/alelmmedia", visible: false,
  });
  assert.equal(validateShowInput({ id: "x1", name: "م", accent: "#000000" }).ok, false);
  assert.equal(validateShowInput({ id: "majalis", name: "مجالس", accent: "red" }).ok, false);
  assert.equal(validateShowInput({ id: "majalis", name: "مجالس", accent: "#000000", feedUrl: "http://x.com/feed" }).ok, false);
  assert.equal(validateShowInput({ id: "majalis", name: "مجالس", accent: "#000000", cover: "https://evil.example/a.jpg" }).ok, false);
  assert.equal(validateShowInput({ id: "majalis", name: "مجالس", accent: "#000000", cover: "/uploads/0b6f4c3e-1a2b-4c5d-8e9f-001122334455.webp" }).ok, true);
  const edited = validateShowInput({ id: "changed", name: "الغبوق", accent: "#b35c1e" }, { id: "alghabouq" });
  assert.equal(edited.value.id, "alghabouq");
});

test("الحلقة: العنوان والبرنامج إلزاميان، والتاريخ لا يسبق الغد، والمدة عدد ثوانٍ", () => {
  const now = new Date("2026-09-27T15:00:00.000Z");
  const ok = validateEpisodeInput({ showId: "alghabouq", title: " كيف  نصبح قرّاء أفضل؟ ", guest: "د. محمد الصبي", durationSeconds: 4517 }, now);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.title, "كيف نصبح قرّاء أفضل؟");
  assert.equal(ok.value.publishedAt, now.toISOString());
  assert.equal(ok.value.visible, true);
  assert.equal(validateEpisodeInput({ showId: "", title: "عنوان" }, now).ok, false);
  assert.equal(validateEpisodeInput({ showId: "alghabouq", title: "ع" }, now).ok, false);
  assert.equal(validateEpisodeInput({ showId: "alghabouq", title: "عنوان", publishedAt: "2026-10-05T00:00:00Z" }, now).ok, false);
  assert.equal(validateEpisodeInput({ showId: "alghabouq", title: "عنوان", publishedAt: "not a date" }, now).ok, false);
  assert.equal(validateEpisodeInput({ showId: "alghabouq", title: "عنوان", durationSeconds: 12.5 }, now).ok, false);
  assert.equal(validateEpisodeInput({ showId: "alghabouq", title: "عنوان", durationSeconds: null }, now).value.durationSeconds, null);
});

test("ملف الحلقة: MP3 أو M4A حتى 500MB، والمحتوى يُفحص ببايتاته لا بامتداده", () => {
  assert.deepEqual(audioKindFor("Full episode.MP3"), { ext: "mp3", mime: "audio/mpeg" });
  assert.deepEqual(audioKindFor("ep.m4a"), { ext: "m4a", mime: "audio/mp4" });
  assert.equal(audioKindFor("ep.wav"), null);
  assert.equal(validateAudioUpload({ filename: "a.mp3", size: MAX_AUDIO_BYTES + 1 }).ok, false);
  assert.equal(validateAudioUpload({ filename: "a.mp3", size: 0 }).ok, false);
  assert.equal(validateAudioUpload({ filename: "a.mp3", size: 180689470 }).ok, true);
  assert.equal(sniffAudio(new Uint8Array([0x49, 0x44, 0x33, 3, 0])), "mp3");
  assert.equal(sniffAudio(new Uint8Array([0xff, 0xfb, 0x90, 0x64])), "mp3");
  assert.equal(sniffAudio(new Uint8Array([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41])), "m4a");
  assert.equal(sniffAudio(new TextEncoder().encode("<!doctype html>")), null);
});

test("مفتاح الرفع محصور في مجلد الحلقات باسم UUID، والأجزاء ضمن حد S3 وCloudflare", () => {
  const id = "0b6f4c3e-1a2b-4c5d-8e9f-001122334455";
  const key = uploadObjectKey(id, audioKindFor("x.mp3"));
  assert.equal(key, `podcasts/episodes/${id}.mp3`);
  assert.deepEqual(parseUploadKey(key), { filename: `${id}.mp3`, kind: { ext: "mp3", mime: "audio/mpeg" } });
  for (const bad of ["uploads/x.jpg", `podcasts/episodes/../${id}.mp3`, `podcasts/alghabouq/${id}.mp3`, `podcasts/episodes/${id}.wav`, null]) {
    assert.equal(parseUploadKey(bad), null, String(bad));
  }
  assert.ok(AUDIO_PART_BYTES >= 5 * 1024 * 1024 && AUDIO_PART_BYTES <= 50 * 1024 * 1024);
  assert.equal(validPartNumber("1"), 1);
  assert.equal(validPartNumber(0), null);
  assert.equal(validPartNumber(Math.ceil(MAX_AUDIO_BYTES / AUDIO_PART_BYTES) + 1), null);
});

test("ترحيل 0020 يزرع البرامج والحلقات نفسها التي يسقط إليها الموقع بلا قاعدة", async () => {
  const sql = await read("drizzle/0020_podcasts.sql");
  for (const show of PODCAST_SHOWS) {
    assert.match(sql, new RegExp(`\\('${show.id}', '${show.name}', ${show.cover ? `'${show.cover}'` : "NULL"}, '${show.accent}', '${show.feedUrl}', '${show.youtube}', '${show.storyId}'`), show.id);
  }
  for (const audio of HOSTED_PODCAST_AUDIO) {
    assert.ok(sql.includes(`'${audio.filename}', '${audio.objectKey}', '${audio.mime}', ${audio.byteLength}, '${audio.etag}', ${audio.durationSeconds}, '${audio.publishedAt}'`), audio.filename);
  }
  assert.match(sql, /'podcasts\.manage'/);
  assert.match(sql, /WHERE id IN \('chief', 'managing_editor'\)/);
});

test("صفحة /podcasts/<id> تحوّل أرقام المواد القديمة والبرامج ذات المادة إلى روابطها المقدسة", async () => {
  const page = await read("app/podcasts/[slug]/page.tsx");
  assert.match(page, /PODCAST_SHOW_ID\.test/);
  assert.match(page, /seedContentProvider\.getStory\(decoded\)/);
  assert.match(page, /show\.storyId/);
  assert.match(page, /permanentRedirect\(encodeURI\(storyHref\(story\)\)\)/);
  const revalidate = await read("lib/tahrir/revalidatePublic.ts");
  assert.match(revalidate, /"\/podcasts\/\[slug\]", "page"/);
});

test("مسارات البودكاست في اللوحة كلها خلف صلاحية podcasts.manage", async () => {
  for (const path of [
    "app/api/tahrir/podcasts/shows/route.ts",
    "app/api/tahrir/podcasts/shows/[id]/route.ts",
    "app/api/tahrir/podcasts/episodes/route.ts",
    "app/api/tahrir/podcasts/episodes/[id]/route.ts",
    "app/api/tahrir/podcasts/uploads/route.ts",
    "app/api/tahrir/podcasts/uploads/part/route.ts",
    "app/api/tahrir/podcasts/uploads/complete/route.ts",
    "app/api/tahrir/podcasts/cover/route.ts",
  ]) {
    const source = await read(path);
    const handlers = source.match(/export async function (GET|POST|PUT|PATCH|DELETE)/g) ?? [];
    const guards = source.match(/requirePermission\("podcasts\.manage"\)/g) ?? [];
    assert.ok(handlers.length > 0 && guards.length === handlers.length, path);
  }
  const screen = await read("app/tahrir/(app)/podcasts/page.tsx");
  assert.match(screen, /requireScreen\("podcasts\.manage"/);
});
