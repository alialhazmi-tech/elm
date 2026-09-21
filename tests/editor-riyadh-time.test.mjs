import assert from "node:assert/strict";
import test from "node:test";

import { formatRiyadhDateTime, formatRiyadhTime, isoToRiyadhWallTime, riyadhDayStartIso, riyadhWallTimeToIso } from "../lib/tahrir/riyadh-time.ts";
import { describeRecoveryDiff, recoveryDiffLabel } from "../lib/tahrir/editor/recovery-diff.ts";

test("الموعد المحفوظ يملأ حقل المحرر بالرياض ويعبر منتصف الليل دون إزاحة إضافية", () => {
  assert.equal(isoToRiyadhWallTime("2026-09-10T11:30:00.000Z"), "2026-09-10T14:30");
  assert.equal(isoToRiyadhWallTime("2025-12-31T22:30:00Z"), "2026-01-01T01:30");
  assert.equal(isoToRiyadhWallTime("2026-09-10T14:30:00+03:00"), "2026-09-10T14:30");
  assert.equal(riyadhWallTimeToIso(isoToRiyadhWallTime("2026-09-10T11:30:00.000Z")), "2026-09-10T11:30:00.000Z");
  for (const value of [null, undefined, "", "invalid"]) assert.equal(isoToRiyadhWallTime(value), "");
});

test("وقت الحائط المدخل يُعامل كتوقيت الرياض (+03:00) لا كتوقيت المتصفح", () => {
  assert.equal(riyadhWallTimeToIso("2026-09-09T14:30"), "2026-09-09T11:30:00.000Z");
  assert.equal(riyadhWallTimeToIso("2026-01-01T01:00:15"), "2025-12-31T22:00:15.000Z");
  assert.equal(riyadhWallTimeToIso(""), null);
  assert.equal(riyadhWallTimeToIso("2026-13-40T99:99"), null);
  assert.equal(riyadhWallTimeToIso("غير صالح"), null);
});

test("بداية اليوم بتوقيت الرياض تُحسب من اليوم المحلي هناك لا من UTC", () => {
  // 22:30Z يوم 8 سبتمبر = 01:30 يوم 9 سبتمبر بالرياض
  assert.equal(riyadhDayStartIso(Date.parse("2026-09-08T22:30:00Z")), "2026-09-08T21:00:00.000Z");
  assert.equal(riyadhDayStartIso(Date.parse("2026-09-08T12:00:00Z")), "2026-09-07T21:00:00.000Z");
});

test("عرض الوقت بالرياض بأرقام لاتينية والمدخل الفاسد يعيد فراغًا", () => {
  assert.equal(formatRiyadhTime("2026-09-09T11:30:00.000Z"), "14:30");
  assert.match(formatRiyadhDateTime("2026-09-09T11:30:00.000Z"), /14:30/);
  assert.doesNotMatch(formatRiyadhDateTime("2026-09-09T11:30:00.000Z"), /[٠-٩]/);
  assert.equal(formatRiyadhTime("x"), "");
});

test("فرق الاستعادة يعدّ لا يعرض: العنوان والموجز وفرق كلمات المتن", () => {
  const server = { title: "عنوان", excerpt: "موجز", body: "<p>كلمة واحدة اثنتان</p>" };
  const diff = describeRecoveryDiff(server, { title: "عنوان معدل", excerpt: "موجز", body: "<p>كلمة</p>" });
  assert.deepEqual(diff, { titleChanged: true, excerptChanged: false, bodyWordDelta: -2, same: false });
  assert.equal(recoveryDiffLabel(diff), "العنوان مختلف · الموجز مطابق · المتن −2 كلمة");
  assert.equal(describeRecoveryDiff(server, { ...server, body: "<p>كلمة  واحدة اثنتان</p>" }).same, true);
  assert.match(recoveryDiffLabel(describeRecoveryDiff(server, { ...server, body: "<p>كلمة واحدة اثنتان ثلاث</p>" })), /\+1 كلمة/);
});
