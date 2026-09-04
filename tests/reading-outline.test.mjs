import assert from 'node:assert/strict';
import test from 'node:test';
import { readingOutline } from '../lib/content/reading-outline.ts';
import { sanitizeBodyHtml } from '../lib/content/html.ts';
test('reading outline retains source headings and only existing safe links', () => {
  const result = readingOutline(sanitizeBodyHtml('<h2 id="untrusted">عنوان <strong>موجود</strong></h2><h3>التفاصيل</h3><p>نص <a href="https://example.test/a?a=1&amp;b=2">مرجع</a></p><script>evil()</script><a href="javascript:alert(1)">سيئ</a>'));
  assert.deepEqual(result.headings.map(h => h.title), ['عنوان موجود','التفاصيل']);
  assert.deepEqual(result.links, [{href:'https://example.test/a?a=1&b=2',label:'مرجع'}]);
  assert.match(result.body, /id="read-section-1"/);
  assert.doesNotMatch(result.body, /untrusted|evil|javascript:/);
  assert.deepEqual(readingOutline('<p>بلا عناوين أو مصادر</p>').headings, []);
});
