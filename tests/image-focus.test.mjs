import assert from "node:assert/strict";
import test from "node:test";

import { allowsAutoImageFocus, imageFocusFromFaces, imageFocusStyle, normalizeImageFocus, parseImageFocus } from "../lib/content/image-focus.ts";

// صناديق وجوه حقيقية من كاشف MediaPipe على صور الأرشيف (بكسلات الصورة الأصلية).
const officer = { width: 1200, height: 700, faces: [{ originX: 544, originY: 115, width: 94, height: 94, score: 0.65 }] };
const handshake = { width: 679, height: 452, faces: [
  { originX: 158, originY: 97, width: 80, height: 80, score: 0.92 },
  { originX: 432, originY: 120, width: 85, height: 85, score: 0.76 },
] };

test("الصيغة القياسية فقط تُقبل، والمنتصف لا يُخزَّن", () => {
  assert.equal(normalizeImageFocus("49% 23%"), "49% 23%");
  assert.equal(normalizeImageFocus(" 0% 100% "), "0% 100%");
  assert.equal(normalizeImageFocus("50% 50%"), null);
  for (const bad of ["101% 20%", "49%", "49% 23%; background:red", "center", "", null, 42]) {
    assert.equal(normalizeImageFocus(bad), null, String(bad));
  }
  assert.deepEqual(parseImageFocus("30% 70%"), { x: 30, y: 70 });
  assert.deepEqual(imageFocusStyle("30% 70%"), { objectPosition: "30% 70%" });
  assert.equal(imageFocusStyle("url(x)"), undefined);
});

test("وجه واحد: النقطة على مركزه", () => {
  assert.equal(imageFocusFromFaces(officer.width, officer.height, officer.faces), "49% 23%");
});

test("وجهان متباعدان لا يتسع لهما الإطار الضيق: الأكبر لا المسافة بينهما", () => {
  assert.equal(imageFocusFromFaces(handshake.width, handshake.height, handshake.faces), "70% 36%");
});

test("وجوه متقاربة: مركز المجموعة", () => {
  const faces = [
    { originX: 400, originY: 100, width: 60, height: 60, score: 0.9 },
    { originX: 520, originY: 110, width: 60, height: 60, score: 0.9 },
  ];
  assert.equal(imageFocusFromFaces(1000, 600, faces), "49% 23%");
});

test("الثقة الضعيفة ووجوه الخلفية لا تحرّك القص", () => {
  assert.equal(imageFocusFromFaces(1080, 720, [{ originX: 512, originY: 494, width: 49, height: 49, score: 0.57 }]), null);
  const withBystander = [...officer.faces, { originX: 60, originY: 300, width: 30, height: 30, score: 0.95 }];
  assert.equal(imageFocusFromFaces(officer.width, officer.height, withBystander), "49% 23%");
  assert.equal(imageFocusFromFaces(0, 0, officer.faces), null);
  assert.equal(imageFocusFromFaces(1200, 700, []), null);
});

test("الإنفوجرافيك وجاك العلم خارج الكشف التلقائي", () => {
  assert.equal(allowsAutoImageFocus("news", "news"), true);
  assert.equal(allowsAutoImageFocus(undefined, null), true);
  assert.equal(allowsAutoImageFocus("infographics", "news"), false);
  assert.equal(allowsAutoImageFocus("news", "infographics"), false);
  assert.equal(allowsAutoImageFocus("jakalelm", "news"), false);
});
