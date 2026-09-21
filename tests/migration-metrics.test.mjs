import test from 'node:test';
import assert from 'node:assert/strict';
import { migrationCoverage } from '../scripts/lib/migration-metrics.mjs';
test('incremental runs never claim full archive coverage', () => {
  assert.deepEqual(migrationCoverage({ since: '2026-09-01', sourceCount: 24, targetPublished: 29181 }), { wordpressPublished: null, incrementalSourceCount: 24, coveragePercent: null });
  assert.equal(migrationCoverage({ sourceCount: 29181, targetPublished: 29181 }).coveragePercent, 100);
  assert.equal(migrationCoverage({ sourceCount: 0, targetPublished: 29181 }).coveragePercent, null);
});
