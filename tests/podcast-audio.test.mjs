import assert from 'node:assert/strict';
import test from 'node:test';
import { servePodcastAudio } from '../lib/podcast-audio.ts';
import { HOSTED_PODCAST_AUDIO, mergePodcastEpisodes, fetchEpisodes, podcastShowFor } from '../lib/podcasts.ts';

const audio = HOSTED_PODCAST_AUDIO[0];
const request = (headers = {}, method = 'GET') => new Request('https://alelm.net/podcast-audio/' + audio.filename, { headers, method });
const noStorage = async () => { throw new Error('storage must not be read'); };

test('hosted audio is allowlisted; HEAD and conditional responses avoid opening streams', async () => {
  assert.equal((await servePodcastAudio(request(), '../uploads/private.m4a', noStorage)).status, 404);
  const head = await servePodcastAudio(request({ Range: 'bytes=0-1' }, 'HEAD'), audio.filename, noStorage);
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-length'), String(audio.byteLength));
  assert.equal(head.headers.get('content-type'), 'audio/mp4');
  assert.equal(head.body, null);
  const cached = await servePodcastAudio(request({ 'If-None-Match': `W/"${audio.sha256}"` }), audio.filename, noStorage);
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
    const response = await servePodcastAudio(req, audio.filename, async (key, range, signal) => {
      assert.equal(key, `podcasts/alghabouq/${audio.filename}`);
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
    const res = await servePodcastAudio(request({ Range: range }), audio.filename, noStorage);
    assert.equal(res.status, 416, range);
    assert.equal(res.headers.get('content-range'), `bytes */${audio.byteLength}`);
  }
  const res = await servePodcastAudio(request({ Range: 'bytes=0-1', 'If-Range': '"stale"' }), audio.filename, async (_key, range) => {
    assert.equal(range, undefined);
    return new ReadableStream({ start(c) { c.close(); } });
  });
  assert.equal(res.status, 200);
  const failure = await servePodcastAudio(request(), audio.filename, noStorage);
  assert.equal(failure.status, 502);
  assert.equal(failure.headers.get('cache-control'), 'no-store');
});

test('hosted episodes survive RSS failure, sort newest first and defer to matching RSS audio', async (t) => {
  const extra = mergePodcastEpisodes('175839', []);
  assert.equal(extra.length, 2);
  assert.match(extra[0].title, /تربية الأطفال/);
  assert.equal(mergePodcastEpisodes('92137', []).length, 0);
  const rss = { ...extra[0], title: 'لماذا اصبحت تربية الاطفال مهمة شاقة؟ | د. همام الحارثي في بودكاست الغبوق', audioUrl: 'https://example.com/rss.m4a' };
  const merged = mergePodcastEpisodes('175839', [rss]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].audioUrl, rss.audioUrl);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('RSS unavailable'); });
  assert.equal((await fetchEpisodes(podcastShowFor('175839'))).length, 2);
  assert.equal((await fetchEpisodes(podcastShowFor('92137'))).length, 0);
});
