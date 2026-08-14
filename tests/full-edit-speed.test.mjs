import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("التحرير الشامل يستخدم Sonnet وHaiku بالتوازي لا Opus في طلب واحد", async () => {
  const [editorial, settings, assist] = await Promise.all([
    read("lib/ai/editorial.ts"),
    read("lib/ai/settings.ts"),
    read("app/api/tahrir/ai/assist/route.ts"),
  ]);

  assert.match(settings, /fast: "claude-sonnet-5"/);
  assert.match(editorial, /settings\.models\.fast/);
  assert.match(editorial, /Promise\.all/);
  assert.match(editorial, /cache_control: \{ type: "ephemeral" \}/);
  assert.match(editorial, /أعد المتن المحرَّر فقط/);
  assert.doesNotMatch(editorial, /max_tokens: tool === "full_edit" \? 16_384/);
  assert.match(assist, /result\.usages/);
});
