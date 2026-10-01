import assert from "node:assert/strict";
import test from "node:test";

import { preferWithImages, takeUniqueStories } from "../lib/content/dedupe.ts";

/** مادة بأدنى الحقول التي يقرأها الترتيب. */
const video = (id, image = null) => ({ id, image });

test("صفّ «مرئي وصوتي» يقدّم المصوّر فلا تقع بطاقة فارغة بجانب صورة", () => {
  const withoutFirst = [video("a"), video("b", "/uploads/b.jpg"), video("c"), video("d", "/uploads/d.jpg")];

  assert.deepEqual(
    preferWithImages(withoutFirst).map((story) => story.id),
    ["b", "d", "a", "c"],
  );

  // الاختيار الفعلي للصفّ: بطاقتان مصوّرتان حين تتوفر صورتان.
  const picked = takeUniqueStories(preferWithImages(withoutFirst), new Set(), 2);
  assert.deepEqual(picked.map((story) => story.id), ["b", "d"]);
  assert.ok(picked.every((story) => story.image));
});

test("حين تقلّ الفيديوهات المصوّرة يبقى الصفّ مكتملًا بالبديل", () => {
  const onlyOneImage = [video("a", "/uploads/a.jpg"), video("b"), video("c")];

  const picked = takeUniqueStories(preferWithImages(onlyOneImage), new Set(), 2);
  assert.deepEqual(picked.map((story) => story.id), ["a", "b"]);
});

test("الترتيب لا يكرّر ما عُرض في الصفحة من قبل", () => {
  const seen = new Set(["b"]);
  const videos = [video("a"), video("b", "/uploads/b.jpg"), video("c", "/uploads/c.jpg")];

  const picked = takeUniqueStories(preferWithImages(videos), seen, 2);
  assert.deepEqual(picked.map((story) => story.id), ["c", "a"]);
});
