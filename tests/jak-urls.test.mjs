import assert from 'node:assert/strict';
import test from 'node:test';
import { jakReportHref, shortJakReportHref, publicJakReportId } from '../lib/jak-urls.ts';

const report = { id: '11111111-1111-4111-8111-111111111111', publicNumber: 12, slug: 'الفيفا-لعبة-المال' };

test('Jak links expose the stable number and encode Arabic exactly once', () => {
  assert.equal(publicJakReportId(report), '12');
  assert.equal(jakReportHref(report), '/jak/12/' + encodeURIComponent(report.slug));
  assert.equal(shortJakReportHref(report), '/jak/12');
  assert.equal(shortJakReportHref({...report, slug:'عنوان-جديد'}), '/jak/12');
});

test('reports without a migrated number keep a usable historical link', () => {
  const legacy = {id: report.id, slug: report.slug};
  assert.equal(publicJakReportId(legacy), report.id);
  assert.equal(jakReportHref(legacy), '/jak/' + report.id + '/' + encodeURIComponent(report.slug));
});
