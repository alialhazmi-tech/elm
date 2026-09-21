import assert from "node:assert/strict";
import test from "node:test";

import { publicEmailLinkMarkup } from "../lib/content/public-email.ts";

test("public email markup keeps a valid mailto inside Cloudflare email_off comments", () => {
  const markup = publicEmailLinkMarkup({ email: "alelm@trenddc.com" });
  assert.match(markup, /^<!--email_off--><a href="mailto:alelm@trenddc\.com"/);
  assert.match(markup, /<!--\/email_off-->$/);
  assert.doesNotMatch(markup, /cdn-cgi\/l\/email-protection/);
});

test("public email markup escapes labels and refuses invalid addresses", () => {
  const markup = publicEmailLinkMarkup({ email: "not-an-email", label: "<بريد>" });
  assert.equal(markup, "<!--email_off-->&lt;بريد&gt;<!--/email_off-->");
});
