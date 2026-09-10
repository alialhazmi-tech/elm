import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createResetReceipt } from "../lib/membership/email/reset-receipt.ts";

const connectionString = process.env.TEST_DATABASE_URL;
if (
  !connectionString ||
  !/^alelm_test/.test(new URL(connectionString).pathname.slice(1))
)
  throw new Error("Isolated TEST_DATABASE_URL named alelm_test* required.");
const client = new pg.Client({ connectionString });
await client.connect();
const db = drizzle(client);
db.batch = async (queries) => {
  await client.query("begin");
  try {
    const result = [];
    for (const query of queries) result.push(await query);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
};
const context = new AsyncLocalStorage();
globalThis.__memberAccountDb = context;
globalThis.__memberAccountUser = {
  id: "account-a",
  name: "عضو أول",
  email: "account-a@example.invalid",
  emailVerified: true,
};
globalThis.__memberAccountCalls = [];
globalThis.__memberEmailNotifications = [];
const directory = `tmp/member-account-test-${process.pid}`;
const form = (values) => {
  const result = new FormData();
  for (const [key, value] of Object.entries(values))
    for (const entry of Array.isArray(value) ? value : [value])
      result.append(key, entry);
  return result;
};
let checks = 0;
try {
  await migrate(db, { migrationsFolder: "drizzle" });
  await client.query(
    "truncate stories, member_profiles, member_interests, interests, member_saved_stories, member_likes, member_story_stats, member_topic_scores, member_events, story_reading_sessions, newsletter_subscribers cascade",
  );
  await mkdir(directory, { recursive: true });
  await build({
    stdin: {
      contents: `export * from './app/account/actions'; export * from './lib/membership/account-data'; export {clearBehavioralData} from './lib/personalization/privacy'; export {saveMemberInterests,seedInterestCatalog} from './lib/membership/profile'; export {requestMemberPasswordReset,resetMemberPassword} from './app/join/actions';`,
      resolveDir: process.cwd(),
      loader: "ts",
    },
    outfile: `${directory}/subject.mjs`,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    plugins: [
      {
        name: "isolated-account",
        setup(builder) {
          builder.onResolve(
            {
              filter:
                /^(?:@\/lib\/db|next\/cache|next\/navigation|@\/lib\/membership\/auth|@\/lib\/membership\/email\/notifications)$/,
            },
            (args) => ({ path: args.path, namespace: "fixture" }),
          );
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            loader: "js",
            contents: {
              "@/lib/db":
                "export function getDb(){return globalThis.__memberAccountDb.getStore()}",
              "next/cache":
                "export const unstable_cache=load=>load; export function revalidateTag(){} export function revalidatePath(){}",
              "next/navigation":
                'export function redirect(url){throw new Error("REDIRECT:"+url)}',
              "@/lib/membership/email/notifications":
                "export function notifyAccountChange(input){globalThis.__memberEmailNotifications.push(input)}",
              "@/lib/membership/auth": `export const memberAuthConfigured=true; const call=method=>async body=>{globalThis.__memberAccountCalls.push({method,body}); return globalThis.__memberAccountFailure?{error:{message:'fixture'}}:{data:{}}}; export const memberAuth={getSession:async()=>({data:globalThis.__memberAccountUser?{user:globalThis.__memberAccountUser}:null}),updateUser:call('updateUser'),changePassword:call('changePassword'),emailOtp:{sendVerificationOtp:call('sendVerificationOtp'),verifyEmail:call('verifyEmail')},signOut:call('signOut'),requestPasswordReset:call('requestPasswordReset'),resetPassword:call('resetPassword')};`,
            }[args.path],
          }));
        },
      },
    ],
  });
  const subject = await import(`../${directory}/subject.mjs`);
  await context.run(db, async () => {
    await subject.seedInterestCatalog();
    await client.query(`insert into stories(id,slug,section,title,body,status,published_at)
      select 'account-story-'||lpad(i::text,2,'0'),'story-'||i,'health','خبر '||i,'متن عربي',case when i=15 then 'draft' else 'published' end,'2026-09-01T00:00:00Z' from generate_series(1,15)i`);
    await client.query(
      `insert into member_saved_stories(member_id,story_id,created_at) select 'account-a','account-story-'||lpad(i::text,2,'0'),'2026-09-04T00:00:00Z' from generate_series(1,13)i`,
    );
    await client.query(
      `insert into member_saved_stories(member_id,story_id,created_at) values('account-a','account-story-15','2026-09-04T00:00:00Z'),('account-b','account-story-01','2026-09-04T00:00:00Z')`,
    );
    await client.query(
      `insert into member_likes(member_id,story_id,created_at) values('account-a','account-story-02','2026-09-04T00:00:00Z'),('account-b','account-story-03','2026-09-04T00:00:00Z')`,
    );
    await client.query(
      `insert into member_story_stats(member_id,story_id,active_ms,max_progress,visits,last_visit_at,used_ai,ai_tools,updated_at) values('account-a','account-story-01',120000,100,1,'2026-09-04T00:00:00Z',1,'[]','2026-09-04T00:00:00Z'),('account-a','account-story-02',60000,40,1,'2026-09-04T00:00:00Z',0,'[]','2026-09-04T00:00:00Z'),('account-b','account-story-03',990000,100,1,'2026-09-04T00:00:00Z',1,'[]','2026-09-04T00:00:00Z')`,
    );
    await subject.saveMemberInterests("account-a", ["health", "science"]);
    // The clear control follows deletable data, not finished reads or explicit preferences.
    const hasHistory = async id => (await subject.getMemberAccountData(id, `${id}@example.invalid`, "عضو", "settings")).hasBehavioralData;
    assert.equal(subject.emptyAccountData("account-c", "c@example.invalid", "عضو").hasBehavioralData, false);
    assert.equal(await hasHistory("account-c"), false); // Other members already have activity.
    await subject.saveMemberInterests("account-c", ["health"]);
    await client.query("insert into member_saved_stories(member_id,story_id,created_at) values('account-c','account-story-01','2026-09-04T00:00:00Z')");
    await client.query("insert into member_likes(member_id,story_id,created_at) values('account-c','account-story-01','2026-09-04T00:00:00Z')");
    assert.equal(await hasHistory("account-c"), false);
    const activityFixtures = [
      "insert into story_reading_sessions(visitor_id,story_id,session_id,member_id,active_ms,max_progress,created_at,updated_at) values('visitor-c','account-story-01','session-c','account-c',1000,2,'2026-09-04T00:00:00Z','2026-09-04T00:00:00Z')",
      "insert into member_events(id,member_id,story_id,type,created_at) values('event-c','account-c','account-story-01','open','2026-09-04T00:00:00Z')",
      "insert into member_story_stats(member_id,story_id,active_ms,max_progress,visits,last_visit_at,ai_tools,updated_at) values('account-c','account-story-15',1000,2,1,'2026-09-04T00:00:00Z','[]','2026-09-04T00:00:00Z')", // Non-public story, incomplete reading.
      "insert into member_topic_scores(member_id,topic_key,kind,source,weight,updated_at) values('account-c','section:science','section','inferred',100,'2026-09-04T00:00:00Z')",
    ];
    for (const statement of activityFixtures) {
      await client.query(statement);
      assert.equal(await hasHistory("account-c"), true);
      await subject.clearBehavioralData("account-c");
      assert.equal(await hasHistory("account-c"), false);
      assert.equal(await hasHistory("account-a"), true);
    }
    assert.equal(Number((await client.query("select count(*) from member_topic_scores where member_id='account-c' and source='explicit'")).rows[0].count), 1);
    assert.equal(Number((await client.query("select count(*) from member_saved_stories where member_id='account-c'")).rows[0].count), 1);
    assert.equal(Number((await client.query("select count(*) from member_likes where member_id='account-c'")).rows[0].count), 1);
    checks++;
    for (const table of ["member_saved_stories", "member_likes", "member_interests", "member_topic_scores"]) {
      await client.query(`delete from ${table} where member_id='account-c'`);
    }
    const account = await subject.getMemberAccountData(
      "account-a",
      "account-a@example.invalid",
      "عضو أول",
      "saved",
      1,
    );
    assert.equal(account.available, true);
    assert.equal(account.hasBehavioralData, true);
    assert.equal(account.savedStories.length, 12);
    assert.equal(account.pageCount, 2);
    assert.deepEqual(account.stats, {
      articlesRead: 1,
      activeMinutes: 3,
      savedCount: 13,
      likedCount: 1,
      aiInteractions: 1,
    });
    checks++;
    const page2 = await subject.getMemberAccountData(
      "account-a",
      "account-a@example.invalid",
      "عضو أول",
      "saved",
      2,
    );
    assert.equal(page2.savedStories.length, 1);
    assert.equal(
      new Set(
        [...account.savedStories, ...page2.savedStories].map((x) => x.story.id),
      ).size,
      13,
    );
    checks++;
    const history = await subject.getMemberAccountData(
      "account-a",
      "account-a@example.invalid",
      "عضو أول",
      "history",
    );
    assert.equal(history.recentHistory.length, 2);
    assert.deepEqual(
      history.recentHistory.map((x) => x.progress),
      [100, 40],
    );
    checks++;
    const liked = await subject.getMemberAccountData(
      "account-a",
      "account-a@example.invalid",
      "عضو أول",
      "liked",
    );
    assert.equal(liked.likedStories.length, 1);
    assert.equal(liked.likedStories[0].story.id, "account-story-02");
    checks++;
    assert.ok(
      (
        await subject.removeSavedStory(
          {},
          form({ memberId: "account-b", storyId: "account-story-01" }),
        )
      ).success,
    );
    const saves = await client.query(
      "select member_id from member_saved_stories where story_id='account-story-01'",
    );
    assert.deepEqual(saves.rows, [{ member_id: "account-b" }]);
    checks++;
    globalThis.__memberAccountUser = null;
    for (const action of [
      "updateMemberDetails",
      "changeMemberPassword",
      "saveAccountInterests",
      "togglePersonalization",
      "toggleNewsletter",
      "removeSavedStory",
      "removeLikedStory",
      "clearInferredSignals",
    ])
      assert.ok(
        (
          await subject[action](
            {},
            form({
              name: "تعديل",
              enabled: "1",
              storyId: "account-story-02",
              confirm: "yes",
            }),
          )
        ).error,
        action,
      );
    assert.equal(globalThis.__memberAccountCalls.length, 0);
    checks++;
    globalThis.__memberAccountUser = {
      id: "account-a",
      name: "عضو أول",
      email: "account-a@example.invalid",
      emailVerified: true,
    };
    assert.ok(
      (await subject.updateMemberDetails({}, form({ name: "أ" }))).error,
    );
    assert.ok(
      (
        await subject.updateMemberDetails(
          {},
          form({ name: "اسم جديد", id: "account-b" }),
        )
      ).success,
    );
    assert.deepEqual(globalThis.__memberAccountCalls.at(-1), {
      method: "updateUser",
      body: { name: "اسم جديد" },
    });
    checks++;
    assert.ok(
      (
        await subject.changeMemberPassword(
          {},
          form({
            currentPassword: "test-old-password",
            newPassword: "test-new-password",
            confirmPassword: "mismatch",
          }),
        )
      ).error,
    );
    assert.ok(
      (
        await subject.changeMemberPassword(
          {},
          form({
            currentPassword: "test-old-password",
            newPassword: "test-new-password",
            confirmPassword: "test-new-password",
          }),
        )
      ).success,
    );
    assert.equal(
      globalThis.__memberAccountCalls.at(-1).body.revokeOtherSessions,
      true,
    );
    checks++;
    assert.ok(
      (await subject.saveAccountInterests({}, form({ interests: ["unknown"] })))
        .error,
    );
    assert.ok(
      (
        await subject.saveAccountInterests(
          {},
          form({ interests: ["health", "technology"] }),
        )
      ).success,
    );
    checks++;
    assert.ok(
      (await subject.togglePersonalization({}, form({ enabled: "0" }))).success,
    );
    const preferences = await client.query(
      "select personalization_enabled from member_profiles where auth_user_id='account-a'",
    );
    assert.equal(preferences.rows[0].personalization_enabled, 0);
    checks++;
    await subject.toggleNewsletter({}, form({ enabled: "1" }));
    await subject.toggleNewsletter({}, form({ enabled: "1" }));
    assert.equal(
      Number(
        (
          await client.query(
            "select count(*) from newsletter_subscribers where email='account-a@example.invalid'",
          )
        ).rows[0].count,
      ),
      1,
    );
    await subject.toggleNewsletter({}, form({ enabled: "0" }));
    assert.equal(
      Number(
        (await client.query("select count(*) from newsletter_subscribers"))
          .rows[0].count,
      ),
      0,
    );
    checks++;
    assert.ok((await subject.clearInferredSignals({}, form({}))).error);
    assert.equal(
      Number(
        (
          await client.query(
            "select count(*) from member_story_stats where member_id='account-a'",
          )
        ).rows[0].count,
      ),
      2,
    );
    assert.ok(
      (await subject.clearInferredSignals({}, form({ confirm: "yes" })))
        .success,
    );
    assert.equal(await hasHistory("account-a"), false);
    assert.deepEqual(
      (await client.query("select member_id from member_story_stats")).rows,
      [{ member_id: "account-b" }],
    );
    assert.equal(
      Number(
        (
          await client.query(
            "select count(*) from member_interests where member_id='account-a'",
          )
        ).rows[0].count,
      ),
      2,
    );
    assert.equal(
      Number(
        (
          await client.query(
            "select count(*) from member_saved_stories where member_id='account-a'",
          )
        ).rows[0].count,
      ),
      13,
    );
    checks++;
    globalThis.__memberAccountUser.emailVerified = false;
    globalThis.__memberEmailNotifications.length = 0;
    assert.ok((await subject.sendMemberVerification()).success);
    assert.equal(
      globalThis.__memberAccountCalls.at(-1).body.type,
      "email-verification",
    );
    assert.ok((await subject.verifyMemberEmail({}, form({ otp: "12" }))).error);
    assert.ok(
      (
        await subject.verifyMemberEmail(
          {},
          form({ otp: "123456", email: "other@example.invalid" }),
        )
      ).success,
    );
    assert.equal(
      globalThis.__memberAccountCalls.at(-1).body.email,
      "account-a@example.invalid",
    );
    assert.equal(globalThis.__memberEmailNotifications.length, 1);
    assert.equal(globalThis.__memberEmailNotifications[0].kind, "welcome");
    assert.equal(
      globalThis.__memberEmailNotifications[0].email,
      "account-a@example.invalid",
    );
    globalThis.__memberAccountFailure = true;
    assert.ok(
      (await subject.verifyMemberEmail({}, form({ otp: "123456" }))).error,
    );
    assert.equal(globalThis.__memberEmailNotifications.length, 1);
    globalThis.__memberAccountUser.emailVerified = true;
    checks++;
    assert.ok((await subject.signOutMember()).error);
    globalThis.__memberAccountFailure = false;
    await assert.rejects(subject.signOutMember(), /REDIRECT:\//);
    checks++;
    assert.ok(
      (await subject.requestMemberPasswordReset({}, form({ email: "invalid" })))
        .error,
    );
    assert.ok(
      (
        await subject.requestMemberPasswordReset(
          {},
          form({ email: "account-a@example.invalid" }),
        )
      ).success,
    );
    assert.equal(
      globalThis.__memberAccountCalls.at(-1).body.redirectTo,
      "https://alelm.net/join/reset",
    );
    assert.ok(
      (
        await subject.resetMemberPassword(
          {},
          form({ token: "", password: "test-new-password" }),
        )
      ).error,
    );
    checks++;
  });
  await context.run(db, async () => {
    const previousSecret = process.env.ACCOUNT_EMAIL_RECEIPT_SECRET;
    process.env.ACCOUNT_EMAIL_RECEIPT_SECRET =
      "isolated-test-receipt-secret-at-least-32-chars";
    try {
      globalThis.__memberEmailNotifications.length = 0;
      const receipt = createResetReceipt(
        {
          email: "reset-owner@example.invalid",
          token: "valid-reset-token",
          eventId: "test-reset-event",
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        },
        process.env.ACCOUNT_EMAIL_RECEIPT_SECRET,
      );
      const request = {
        token: "valid-reset-token",
        receipt,
        password: "test-new-password",
        confirmPassword: "test-new-password",
        email: "attacker@example.invalid",
      };
      globalThis.__memberAccountFailure = true;
      assert.ok((await subject.resetMemberPassword({}, form(request))).error);
      assert.equal(globalThis.__memberEmailNotifications.length, 0);
      globalThis.__memberAccountFailure = false;
      assert.ok((await subject.resetMemberPassword({}, form(request))).success);
      assert.equal(globalThis.__memberEmailNotifications.length, 1);
      assert.equal(
        globalThis.__memberEmailNotifications[0].email,
        "reset-owner@example.invalid",
      );
      assert.equal(
        globalThis.__memberEmailNotifications[0].kind,
        "password-changed",
      );
      assert.ok(
        (
          await subject.resetMemberPassword(
            {},
            form({ ...request, receipt: "forged" }),
          )
        ).success,
      );
      assert.equal(globalThis.__memberEmailNotifications.length, 1);
      globalThis.__memberAccountFailure = true;
      const change = {
        currentPassword: "old-password",
        newPassword: "different-new-password",
        confirmPassword: "different-new-password",
        email: "attacker@example.invalid",
      };
      assert.ok((await subject.changeMemberPassword({}, form(change))).error);
      assert.equal(globalThis.__memberEmailNotifications.length, 1);
      globalThis.__memberAccountFailure = false;
      assert.ok((await subject.changeMemberPassword({}, form(change))).success);
      assert.equal(globalThis.__memberEmailNotifications.length, 2);
      assert.equal(
        globalThis.__memberEmailNotifications[1].email,
        "account-a@example.invalid",
      );
      checks += 3;
    } finally {
      if (previousSecret === undefined)
        delete process.env.ACCOUNT_EMAIL_RECEIPT_SECRET;
      else process.env.ACCOUNT_EMAIL_RECEIPT_SECRET = previousSecret;
    }
  });
  await context.run(db, async () => {
    await client.query(
      "update member_profiles set status='suspended' where auth_user_id='account-a'",
    );
    const callsBefore = globalThis.__memberAccountCalls.length;
    assert.ok(
      (await subject.updateMemberDetails({}, form({ name: "blocked change" })))
        .error,
    );
    assert.ok(
      (await subject.toggleNewsletter({}, form({ enabled: "1" }))).error,
    );
    assert.equal(globalThis.__memberAccountCalls.length, callsBefore);
    await client.query(
      "update member_profiles set status='active' where auth_user_id='account-a'",
    );
    checks++;
  });
  await context.run(null, async () => {
    assert.equal(
      (
        await subject.getMemberAccountData(
          "account-a",
          "account-a@example.invalid",
        )
      ).available,
      false,
    );
    assert.ok(
      (await subject.toggleNewsletter({}, form({ enabled: "1" }))).error,
    );
    checks++;
  });
  console.log(
    `Member account integration: ${checks} checks passed; private pagination, history, likes, session-bound writes, credentials, preferences, failures, and confirmed clearing.`,
  );
} finally {
  await client.end();
  await rm(directory, { recursive: true, force: true });
  delete globalThis.__memberAccountDb;
  delete globalThis.__memberAccountUser;
  delete globalThis.__memberAccountCalls;
  delete globalThis.__memberAccountFailure;
  delete globalThis.__memberEmailNotifications;
}
