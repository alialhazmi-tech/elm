import assert from 'node:assert/strict';
import test from 'node:test';
import { brokenStoryRedirect } from '../lib/seo/broken-story-url.ts';

const slug = 'هل-تشن-الولايات-المتحدة-هجوما';

test('valid story links pass through untouched', () => {
  assert.equal(brokenStoryRedirect('/politics/300342/' + encodeURIComponent(slug)), null);
  assert.equal(brokenStoryRedirect('/politics/300342/' + slug), null);
  assert.equal(brokenStoryRedirect('/sport/12/match-report'), null);
});

test('a slug cut mid-character goes to the short link', () => {
  const cut = '/politics/300342/' + encodeURIComponent(slug).slice(0, -2);
  assert.throws(() => decodeURIComponent(cut));
  assert.equal(brokenStoryRedirect(cut), '/politics/300342');
});

test('a double-encoded slug goes to the short link', () => {
  const mojibake = Buffer.from(slug, 'utf8').toString('latin1');
  assert.equal(brokenStoryRedirect('/politics/300319/' + encodeURIComponent(mojibake)), '/politics/300319');
});

test('other routes are never rewritten', () => {
  assert.equal(brokenStoryRedirect('/keywords/%D8'), null);
  assert.equal(brokenStoryRedirect('/tahrir/stories/abc'), null);
  assert.equal(brokenStoryRedirect('/politics'), null);
});
