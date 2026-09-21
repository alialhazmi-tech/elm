import assert from "node:assert/strict";
import test from "node:test";

import { imageObjectKey, isMissingStoredImage, resolveStorageConfig } from "../lib/storage/images.ts";

test("مخزن الصور يقبل أسماء UUID الآمنة فقط", () => {
  assert.equal(
    imageObjectKey("47ffde49-afc4-499d-b241-f5719ee33520.jpg"),
    "uploads/47ffde49-afc4-499d-b241-f5719ee33520.jpg",
  );
  assert.throws(() => imageObjectKey("../secret.jpg"), /غير صالح/);
  assert.throws(() => imageObjectKey("image.svg"), /غير صالح/);
});

test("مخزن الصور يفضّل متغيرات Railway AWS_* على BUCKET_*", () => {
  const config = resolveStorageConfig({
    AWS_ENDPOINT_URL: "https://t3.storageapi.dev",
    AWS_DEFAULT_REGION: "ams",
    AWS_S3_BUCKET_NAME: "portable-chamber-2hpffess",
    AWS_ACCESS_KEY_ID: "key",
    AWS_SECRET_ACCESS_KEY: "secret",
    BUCKET_NAME: "old-bucket",
    BUCKET_REGION: "auto",
  });
  assert.equal(config.bucket, "portable-chamber-2hpffess");
  assert.equal(config.endpoint, "https://t3.storageapi.dev");
  assert.equal(config.region, "auto");
});

test("مخزن الصور يميز أخطاء الملف المفقود", () => {
  assert.equal(isMissingStoredImage({ name: "NoSuchKey" }), true);
  assert.equal(isMissingStoredImage({ $metadata: { httpStatusCode: 404 } }), true);
  assert.equal(isMissingStoredImage(new Error("network")), false);
});
