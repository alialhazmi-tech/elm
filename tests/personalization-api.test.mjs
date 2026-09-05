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

/*
 * «أدوات القارئ» بعد طبقة الناعم v2: بطاقة واحدة تجمع الاستماع والتلخيص
 * والمشاركة وحقل السؤال، بدل شريط الأدوات و«اسأل عن المادة» المنفصلين.
 * الشرط الباقي: كل أداة ذكاء تمر بـ /api/me/ai، ولغير الأعضاء دعوة للانضمام
 * لا زر يستدعي الخدمة — فلا تُستهلك قبل التحقق من الجلسة.
 */
test("أدوات القارئ في بطاقة واحدة وأدوات الذكاء خلف العضوية", async () => {
  const client = await read("app/_components/article-experience.tsx");
  assert.match(client, /className="sa-tools"/);
  assert.match(client, /لخّص لي/);
  assert.match(client, /اسأل عن هذه المادة/);
  assert.match(client, /"\/api\/me\/ai"/);
  assert.match(client, /tool: "summary"|runTool\("summary"\)/);
  // لغير العضو: رابط انضمام مكان الأداة، لا زر ينادي الخدمة.
  assert.match(client, /state\.signedIn \? \([\s\S]*?لخّص لي[\s\S]*?<Link className="sa-tool" href=\{joinHref\}/);
  assert.doesNotMatch(client, /tool: "simplify"/);
});

test("صور ذات الصلة تمر عبر next/image حتى لا يحجبها CSP", async () => {
  const client = await read("app/_components/article-experience.tsx");
  assert.match(client, /from "next\/image"/);
  assert.match(client, /<Image className="c-img"/);
  assert.doesNotMatch(client, /<img className="c-img"/);
});

/* «أعجبني» صار «احفظ المادة» في صف البايلاين — نفس مكتبة العضو خلفه. */
test("حفظ المادة للزائر يقود إلى مسار الدخول الحالي", async () => {
  const [client, article] = await Promise.all([
    read("app/_components/article-experience.tsx"),
    read("app/[section]/[id]/[slug]/page.tsx"),
  ]);
  assert.match(client, /joinHref/);
  assert.match(client, /ArticleSaveButton/);
  assert.match(client, /"\/api\/me\/saved"/);
  assert.match(
    client,
    /!state\.signedIn[\s\S]*?<Link className="sa-save" href=\{joinHref\}[\s\S]*?احفظ المادة/,
    "زر الحفظ للزائر لا يقود إلى الانضمام",
  );
  assert.match(article, /\/join\?next=/);
});

test("سؤال الختام للجميع بلا أصوات محلية وهمية", async () => {
  const [poll, article, route, publicRoute] = await Promise.all([
    read("app/_components/poll.tsx"),
    read("app/[section]/[id]/[slug]/page.tsx"),
    read("app/api/me/closing/route.ts"),
    read("app/api/polls/closing/route.ts"),
  ]);
  assert.match(poll, /useArticleInteraction/);
  assert.doesNotMatch(poll, /localStorage|setBonus|displayCounts/);
  assert.doesNotMatch(poll, /النتائج لحظية/);
  assert.doesNotMatch(article, /votes:\s*34|votes:\s*12/);
  assert.match(route, /closing_answer/);
  assert.match(route, /closingAnswerCounts/);
  assert.match(publicRoute, /closingAnswerCounts/);
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
    read("app/account/account-view.tsx"),
    read("lib/personalization/interests.ts"),
  ]);
  assert.match(privacy, /clearBehavioralData/);
  assert.match(privacy, /setPersonalizationEnabled/);
  assert.match(account, /مسح الإشارات المستنتجة/);
  assert.match(interests, /ne\(memberTopicScores.source, "explicit"\)/);
});
