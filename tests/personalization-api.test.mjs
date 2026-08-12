import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("المخطط يضيف الإعجاب والأحداث والملخص والموضوعات بفهارس", async () => {
  const schema = await read("db/schema.ts");
  assert.match(schema, /member_likes/);
  assert.match(schema, /member_events/);
  assert.match(schema, /member_story_stats/);
  assert.match(schema, /member_topic_scores/);
  assert.match(schema, /story_topics/);
  assert.match(schema, /primaryKey\(\{ columns: \[table.memberId, table.storyId\] \}\)/);
  assert.match(schema, /member_events_member_story_type_idx/);
});

test("واجهات العضو تستخرج المعرّف من الجلسة وتتجاهل memberId من العميل", async () => {
  const files = await Promise.all([
    read("app/api/me/like/route.ts"),
    read("app/api/me/events/route.ts"),
    read("app/api/me/closing/route.ts"),
    read("app/api/me/ai/route.ts"),
    read("app/api/me/related/route.ts"),
    read("lib/personalization/session.ts"),
  ]);
  for (const source of files) {
    assert.match(source, /getSessionMemberId/);
    assert.doesNotMatch(source, /body\.memberId\s*\|\|/);
    assert.doesNotMatch(source, /body\?\.memberId\s*\?\?/);
  }
  assert.match(files[0], /void body\?\.memberId/);
  assert.match(files[5], /private, no-store/);
});

test("التوصيات الشخصية لا تدخل كاش المحتوى العام", async () => {
  const [provider, recommend, article] = await Promise.all([
    read("lib/content/provider.ts"),
    read("lib/personalization/recommend.ts"),
    read("app/[section]/[id]/[slug]/page.tsx"),
  ]);
  assert.match(provider, /DB_CACHE_MS/);
  assert.doesNotMatch(provider, /memberId|personalization/);
  assert.doesNotMatch(recommend, /corpusCache|DB_CACHE_MS/);
  assert.match(article, /revalidate = 300/);
  assert.match(article, /PersonalizedRelated/);
  assert.match(article, /toRelatedCard/);
});

test("أدوات الذكاء تُسجَّل بعد النجاح فقط", async () => {
  const route = await read("app/api/me/ai/route.ts");
  const successIndex = route.indexOf("persistStatsAndSignal");
  const resultIndex = route.indexOf("runReaderTool");
  assert.ok(resultIndex >= 0 && successIndex > resultIndex);
  assert.match(route, /if \("error" in result\)/);
  assert.match(route, /EVENT\[tool\]/);
  assert.doesNotMatch(route, /question.*memberEvents|insert\(memberEvents\).*question/);
});

test("التتبع النشط لا يرسل في كل ثانية ويحترم الرؤية", async () => {
  const client = await read("app/_components/article-experience.tsx");
  assert.match(client, /visibilityState === "visible"/);
  assert.match(client, /hasFocus\(\)/);
  assert.match(client, /FLUSH_MS = 15_000/);
  assert.match(client, /keepalive/);
  assert.doesNotMatch(client, /setInterval\([^,]+,\s*1000\)/);
});

test("الإعجاب للزائر يقود إلى مسار الدخول الحالي", async () => {
  const [client, article] = await Promise.all([
    read("app/_components/article-experience.tsx"),
    read("app/[section]/[id]/[slug]/page.tsx"),
  ]);
  assert.match(client, /joinHref/);
  assert.match(client, /♡ أعجبني/);
  assert.match(article, /\/join\?next=/);
});

test("سؤال الختام مربوط بملف العضو", async () => {
  const [poll, client, route] = await Promise.all([
    read("app/_components/poll.tsx"),
    read("app/_components/article-experience.tsx"),
    read("app/api/me/closing/route.ts"),
  ]);
  assert.match(poll, /onVote\?/);
  assert.match(client, /\/api\/me\/closing/);
  assert.match(route, /closing_answer/);
});

test("Haiku للتصنيف وأدوات القارئ لا في مسار فتح المقال", async () => {
  const [article, classify, reader] = await Promise.all([
    read("app/[section]/[id]/[slug]/page.tsx"),
    read("lib/personalization/classify.ts"),
    read("lib/ai/reader.ts"),
  ]);
  assert.doesNotMatch(article, /runReaderTool|classifyWithHaiku|ANTHROPIC/);
  assert.match(classify, /claude|models\.light|haiku/);
  assert.match(reader, /models\.light/);
  assert.match(reader, /status: 503/);
});

test("الخصوصية: مسح الإشارات وإيقاف التخصيص دون لمس الاهتمامات الصريحة في المسح الجزئي", async () => {
  const [privacy, account, interests] = await Promise.all([
    read("lib/personalization/privacy.ts"),
    read("app/account/page.tsx"),
    read("lib/personalization/interests.ts"),
  ]);
  assert.match(privacy, /clearBehavioralData/);
  assert.match(privacy, /setPersonalizationEnabled/);
  assert.match(account, /مسح الإشارات المستنتجة/);
  assert.match(interests, /ne\(memberTopicScores.source, "explicit"\)/);
});
