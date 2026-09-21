import assert from "node:assert/strict";
import test from "node:test";

import { inRiyadhDay, riyadhDayBounds, riyadhDayKey, riyadhDayKeys } from "../lib/tahrir/time.ts";

test("حدود اليوم بتوقيت الرياض: 23:30Z تقع في اليوم التالي بالرياض", () => {
  const bounds = riyadhDayBounds(new Date("2026-09-09T23:30:00Z"));
  assert.equal(bounds.dayKey, "2026-09-10");
  assert.equal(bounds.startIso, "2026-09-09T21:00:00.000Z");
  assert.equal(bounds.endIso, "2026-09-10T21:00:00.000Z");
  assert.equal(bounds.endMs - bounds.startMs, 86_400_000);
});

test("حدود اليوم بتوقيت الرياض: 21:30Z بعد منتصف الليل بالرياض مباشرة", () => {
  const bounds = riyadhDayBounds(new Date("2026-09-09T21:30:00Z"));
  assert.equal(bounds.dayKey, "2026-09-10");
  assert.equal(bounds.startIso, "2026-09-09T21:00:00.000Z");
});

test("حدود اليوم بتوقيت الرياض: 20:30Z ما زالت في اليوم نفسه", () => {
  const bounds = riyadhDayBounds(new Date("2026-09-09T20:30:00Z"));
  assert.equal(bounds.dayKey, "2026-09-09");
  assert.equal(bounds.startIso, "2026-09-08T21:00:00.000Z");
  assert.equal(bounds.endIso, "2026-09-09T21:00:00.000Z");
});

test("الحد الأدنى شامل والأعلى غير شامل، والصيغة بإزاحة صريحة تُقارن كلحظة", () => {
  const bounds = riyadhDayBounds(new Date("2026-09-09T10:00:00Z"));
  assert.equal(inRiyadhDay("2026-09-08T21:00:00.000Z", bounds), true);
  assert.equal(inRiyadhDay("2026-09-08T20:59:59.999Z", bounds), false);
  assert.equal(inRiyadhDay("2026-09-09T21:00:00.000Z", bounds), false);
  assert.equal(inRiyadhDay("2026-09-09T00:00:00+03:00", bounds), true);
  assert.equal(inRiyadhDay("2026-09-10T00:00:00+03:00", bounds), false);
  assert.equal(inRiyadhDay(null, bounds), false);
  assert.equal(inRiyadhDay("ليس تاريخًا", bounds), false);
});

test("مفاتيح الأيام الأخيرة تنتهي باليوم الحالي بالرياض وتعبر حدود الشهر", () => {
  assert.equal(riyadhDayKey("2026-09-30T21:30:00Z"), "2026-10-01");
  assert.deepEqual(riyadhDayKeys(3, new Date("2026-10-01T22:00:00Z")), ["2026-09-30", "2026-10-01", "2026-10-02"]);
});
