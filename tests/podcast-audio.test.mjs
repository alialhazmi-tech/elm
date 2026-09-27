import assert from 'node:assert/strict';
import test from 'node:test';
import { PODCAST_AUDIO_FILENAME, servePodcastAudio } from '../lib/podcast-audio.ts';
import { HOSTED_PODCAST_AUDIO, mergePodcastEpisodes, fetchEpisodes, podcastShowFor, seedHostedFor } from '../lib/podcasts.ts';

const audio = HOSTED_PODCAST_AUDIO[0];
const request = (headers = {}, method = 'GET') => new Request('https://alelm.net/podcast-audio/' + audio.filename, { headers, method });
const noStorage = async () => { throw new Error('storage must not be read'); };

test('hosted audio is allowlisted; HEAD and conditional responses avoid opening streams', async () => {
  // الكتالوج يحسم الحلقة؛ اسم خارج النمط لا يصل إليه أصلًا.
  assert.equal(PODCAST_AUDIO_FILENAME.test('../uploads/private.m4a'), false);
  assert.equal(PODCAST_AUDIO_FILENAME.test('clip.wav'), false);
  for (const item of HOSTED_PODCAST_AUDIO) assert.ok(PODCAST_AUDIO_FILENAME.test(item.filename), item.filename);
  assert.ok(PODCAST_AUDIO_FILENAME.test('0b6f4c3e-1a2b-4c5d-8e9f-001122334455.mp3'));
  assert.equal((await servePodcastAudio(request(), null, noStorage)).status, 404);
  const head = await servePodcastAudio(request({ Range: 'bytes=0-1' }, 'HEAD'), audio, noStorage);
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-length'), String(audio.byteLength));
  assert.equal(head.headers.get('content-type'), 'audio/mp4');
  assert.equal(head.body, null);
  const cached = await servePodcastAudio(request({ 'If-None-Match': `W/"${audio.etag}"` }), audio, noStorage);
  assert.equal(cached.status, 304);
  assert.equal(cached.headers.get('content-length'), null);
});

test('byte, open-ended and suffix requests stream precisely the selected range', async () => {
  for (const [input, expected, length] of [
    ['bytes=10-19', 'bytes=10-19', 10],
    [`bytes=${audio.byteLength - 5}-`, `bytes=${audio.byteLength - 5}-${audio.byteLength - 1}`, 5],
    ['bytes=-5', `bytes=${audio.byteLength - 5}-${audio.byteLength - 1}`, 5],
    [`bytes=${audio.byteLength - 2}-${audio.byteLength + 50}`, `bytes=${audio.byteLength - 2}-${audio.byteLength - 1}`, 2],
  ]) {
    const req = request({ Range: input });
    const response = await servePodcastAudio(req, audio, async (key, range, signal) => {
      assert.equal(key, audio.objectKey);
      assert.equal(range, expected);
      assert.equal(signal, req.signal);
      return new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(length).fill(7)); controller.close(); } });
    });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), expected.replace('=', ' ') + '/' + audio.byteLength);
    assert.equal(response.headers.get('content-length'), String(length));
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array(length).fill(7));
  }
});

test('invalid ranges cannot open storage and stale If-Range returns the full representation', async () => {
  for (const range of ['bytes=-0', 'bytes=20-10', `bytes=${audio.byteLength}-`, 'bytes=0-1,3-4', 'bytes=-', 'bad', 'bytes=9007199254740992-']) {
    const res = await servePodcastAudio(request({ Range: range }), audio, noStorage);
    assert.equal(res.status, 416, range);
    assert.equal(res.headers.get('content-range'), `bytes */${audio.byteLength}`);
  }
  const res = await servePodcastAudio(request({ Range: 'bytes=0-1', 'If-Range': '"stale"' }), audio, async (_key, range) => {
    assert.equal(range, undefined);
    return new ReadableStream({ start(c) { c.close(); } });
  });
  assert.equal(res.status, 200);
  const failure = await servePodcastAudio(request(), audio, noStorage);
  assert.equal(failure.status, 502);
  assert.equal(failure.headers.get('cache-control'), 'no-store');
});

test('uploaded MP3 is served with its own type', async () => {
  const mp3 = { objectKey: 'podcasts/episodes/x.mp3', byteLength: 10, etag: 'abc', mime: 'audio/mpeg' };
  const head = await servePodcastAudio(request({}, 'HEAD'), mp3, noStorage);
  assert.equal(head.headers.get('content-type'), 'audio/mpeg');
  assert.equal(head.headers.get('etag'), '"abc"');
});

test('hosted episodes survive RSS failure, sort newest first and defer to matching RSS audio', async (t) => {
  const hosted = seedHostedFor('alghabouq');
  const extra = mergePodcastEpisodes([], hosted);
  assert.equal(extra.length, 3);
  assert.equal(extra[0].title, 'كيف نصبح قرّاء أفضل؟');
  assert.equal(extra[0].guest, 'د. محمد الصبي');
  assert.equal(extra[0].duration, '4517');
  assert.match(extra[0].description, /القراءة السريعة/);
  assert.match(extra[1].title, /تربية الأطفال/);
  assert.equal(mergePodcastEpisodes([], seedHostedFor('malameh')).length, 0);
  const rss = { ...extra[1], guest: null, title: 'لماذا اصبحت تربية الاطفال مهمة شاقة؟ | د. همام الحارثي في بودكاست الغبوق', audioUrl: 'https://example.com/rss.m4a' };
  const merged = mergePodcastEpisodes([rss], hosted);
  assert.equal(merged.length, 3);
  assert.equal(merged[1].audioUrl, rss.audioUrl);
  // الحلقة المخفية من اللوحة لا تظهر.
  const hidden = hosted.map((item, index) => (index === 0 ? { ...item, visible: false } : item));
  assert.equal(mergePodcastEpisodes([], hidden).length, 2);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('RSS unavailable'); });
  assert.equal((await fetchEpisodes(podcastShowFor('175839'))).length, 3);
  assert.equal((await fetchEpisodes(podcastShowFor('92137'))).length, 0);
});
