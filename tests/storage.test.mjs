import assert from "node:assert/strict";
import test from "node:test";

import { imageObjectKey, isMissingStoredImage } from "../lib/storage/images.ts";

test("مخزن الصور يقبل أسماء UUID الآمنة فقط", () => {
  assert.equal(
    imageObjectKey("47ffde49-afc4-499d-b241-f5719ee33520.jpg"),
    "uploads/47ffde49-afc4-499d-b241-f5719ee33520.jpg",
  );
  assert.throws(() => imageObjectKey("../secret.jpg"), /غير صالح/);
  assert.throws(() => imageObjectKey("image.svg"), /غير صالح/);
});

test("مخزن الصور يميز أخطاء الملف المفقود", () => {
  assert.equal(isMissingStoredImage({ name: "NoSuchKey" }), true);
  assert.equal(isMissingStoredImage({ $metadata: { httpStatusCode: 404 } }), true);
  assert.equal(isMissingStoredImage(new Error("network")), false);
});
