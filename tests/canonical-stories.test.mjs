import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalStoryHref,
  isCanonicalStoryAlias,
  isCanonicalStoryAliasId,
  publicStoryId,
  shortStoryHref,
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

test("tahrir stories use their short public number in links; WordPress ids stay unchanged", () => {
  const tahrir = { id: "4a48f291-fe4a-4d46-9283-22530bd1e9d2", publicNumber: 300042, section: "politics", slug: "رحلة-السعودية" };
  assert.equal(publicStoryId(tahrir), "300042");
  assert.equal(canonicalStoryHref(tahrir), "/politics/300042/رحلة-السعودية");
  assert.equal(shortStoryHref(tahrir), "/politics/300042");
  assert.equal(publicStoryId({ id: "264651", publicNumber: null }), "264651");
  assert.equal(canonicalStoryHref({ id: "264651", section: "world", slug: "خبر" }), "/world/264651/خبر");
  assert.equal(shortStoryHref(duplicate), "/world/1660");
});
