import assert from "node:assert/strict";
import test from "node:test";

import { nextRefreshDelay, REFRESH_IDLE_MS, REFRESH_NEAR_MS, REFRESH_WINDOW_MS } from "../lib/tahrir/schedule-refresh.ts";

const now = Date.parse("2026-09-09T12:00:00.000Z");
const at = (offsetMs) => new Date(now + offsetMs).toISOString();

test("بلا موعد أو موعد غير مقروء: تحديث كل دقيقة على الأكثر", () => {
  assert.equal(nextRefreshDelay(null, now), REFRESH_IDLE_MS);
  assert.equal(nextRefreshDelay(undefined, now), REFRESH_IDLE_MS);
  assert.equal(nextRefreshDelay("ليس تاريخًا", now), REFRESH_IDLE_MS);
});

test("الموعد أبعد من دقيقتين: هدوء بدقيقة، لا استطلاع مبكر", () => {
  assert.equal(nextRefreshDelay(at(REFRESH_WINDOW_MS + 1), now), REFRESH_IDLE_MS);
  assert.equal(nextRefreshDelay(at(3_600_000), now), REFRESH_IDLE_MS);
  assert.equal(nextRefreshDelay(at(86_400_000 * 3), now), REFRESH_IDLE_MS);
});

test("داخل الدقيقتين: 15 ثانية، وتحديث واحد بعد ثانية من مرور الموعد", () => {
  assert.equal(nextRefreshDelay(at(REFRESH_WINDOW_MS), now), REFRESH_NEAR_MS);
  assert.equal(nextRefreshDelay(at(60_000), now), REFRESH_NEAR_MS);
  assert.equal(nextRefreshDelay(at(15_000), now), REFRESH_NEAR_MS);
  // قبل الموعد بعشر ثوانٍ: نصل بعده بثانية بدل انتظار الدورة الكاملة.
  assert.equal(nextRefreshDelay(at(10_000), now), 11_000);
  assert.equal(nextRefreshDelay(at(1), now), 1_001);
});

test("الموعد مضى ولم يُرقَّ بعد: نبقى على 15 ثانية حتى يختفي من المجدول", () => {
  assert.equal(nextRefreshDelay(at(0), now), REFRESH_NEAR_MS);
  assert.equal(nextRefreshDelay(at(-4_000), now), REFRESH_NEAR_MS);
  assert.equal(nextRefreshDelay(at(-3_600_000), now), REFRESH_NEAR_MS);
});

test("سلسلة كاملة قرب الموعد: من الدقيقة إلى الترقب ثم ما بعد الموعد بثانية", () => {
  const scheduled = at(130_000);
  let clock = now;
  const hops = [];
  for (let step = 0; step < 12; step++) {
    const delay = nextRefreshDelay(scheduled, clock);
    hops.push(delay);
    clock += delay;
    if (clock > Date.parse(scheduled)) break;
  }
  assert.deepEqual(hops, [60_000, 15_000, 15_000, 15_000, 15_000, 11_000]);
  assert.equal(clock - Date.parse(scheduled), 1_000);
});
