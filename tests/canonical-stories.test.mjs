import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalStoryHref,
  isCanonicalStoryAlias,
  isCanonicalStoryAliasId,
  storedStoryHref,
} from "../lib/content/canonical-stories.ts";
import { storyHref } from "../lib/content/types.ts";

const duplicate = {
  id: "1658",
  section: "world",
  slug: "خطط-دولية-ربما-تجبر-الشركات-الكبرى-على-2",
};
const canonical = {
  id: "1660",
  section: "world",
  slug: "خطط-دولية-ربما-تجبر-الشركات-الكبرى-على",
};

test("verified duplicate story resolves to the clean canonical path", () => {
  assert.equal(storedStoryHref(duplicate), "/world/1658/خطط-دولية-ربما-تجبر-الشركات-الكبرى-على-2");
  assert.equal(canonicalStoryHref(duplicate), "/world/1660/خطط-دولية-ربما-تجبر-الشركات-الكبرى-على");
  assert.equal(storyHref(duplicate), canonicalStoryHref(duplicate));
  assert.equal(isCanonicalStoryAlias(duplicate), true);
  assert.equal(isCanonicalStoryAliasId("1658"), true);
});

test("canonical target and unrelated stories remain unchanged", () => {
  assert.equal(canonicalStoryHref(canonical), "/world/1660/خطط-دولية-ربما-تجبر-الشركات-الكبرى-على");
  assert.equal(isCanonicalStoryAlias(canonical), false);
  assert.equal(isCanonicalStoryAliasId("1660"), false);
  assert.equal(canonicalStoryHref({ id: "other", section: "politics", slug: "خبر" }), "/politics/other/خبر");
});
