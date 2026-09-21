import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import sharp from "sharp";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^alelm_test/.test(new URL(url).pathname.slice(1)))
  throw new Error("Isolated TEST_DATABASE_URL required");
const client = new pg.Client({ connectionString: url });
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
const memberId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
globalThis.__profiles = {
  db,
  user: {
    id: memberId,
    name: "عضو أول",
    email: "first@example.invalid",
    emailVerified: false,
  },
  actor: null,
  images: [],
};
const state = globalThis.__profiles;
const dir = `tmp/profiles-test-${process.pid}`;
const actor = {
  userId: "editor-profile-test",
  username: "profile-editor",
  displayName: "محرر",
  avatarUrl: null,
  can: (key) => key === "users.view",
};
function request(path, method = "POST", body, origin = "http://localhost") {
  const headers = { origin };
  if (body && !(body instanceof FormData))
    headers["content-type"] = "application/json";
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
}
function upload(file) {
  const data = new FormData();
  data.set("file", file);
  data.set("memberId", otherId);
  data.set("userId", "someone-else");
  return data;
}
let checks = 0;
try {
  await migrate(db, { migrationsFolder: "drizzle" });
  await client.query("create schema if not exists neon_auth");
  await client.query('drop table if exists neon_auth."user"');
  await client.query(
    'create table neon_auth."user" (id uuid primary key, name text, email text, "emailVerified" boolean not null default false, "createdAt" timestamptz not null default now())',
  );
  await client.query(
    'truncate neon_auth."user", member_profiles, audit_log, request_limits',
  );
  await client.query(
    'insert into neon_auth."user"(id,name,email) values($1,$2,$3),($4,$5,$6)',
    [
      memberId,
      "عضو أول",
      "first@example.invalid",
      otherId,
      "100% حساب",
      "second@example.invalid",
    ],
  );
  await client.query(
    "insert into users(id,username,display_name,password_hash,created_at) values('editor-profile-test','profile-editor','محرر','fixture',now()) on conflict(id) do nothing",
  );
  await mkdir(dir, { recursive: true });
  await build({
    stdin: {
      contents: `export * from './lib/membership/admin'; export * from './lib/membership/session'; export * from './lib/storage/avatar'; export {POST as memberUpload, DELETE as memberRemove} from './app/api/account/avatar/route'; export {PATCH as editorUpdate, POST as editorUpload} from './app/api/tahrir/account/profile/route'; export {POST as moderate} from './app/api/tahrir/audience/[id]/status/route'; export {GET as viewer} from './app/api/viewer/route'; export {GET as authGet,POST as authPost} from './app/api/auth/[...path]/route';`,
      resolveDir: process.cwd(),
      loader: "ts",
    },
    outfile: `${dir}/subject.mjs`,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    plugins: [
      {
        name: "isolated-profiles",
        setup(b) {
          b.onResolve(
            {
              filter:
                /^(?:@\/lib\/db|@\/lib\/membership\/auth|@\/lib\/tahrir\/access|\.\/images)$/,
            },
            (args) => ({ path: args.path, namespace: "fixture" }),
          );
          b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            loader: "js",
            contents: {
              "@/lib/db": "export const getDb=()=>globalThis.__profiles.db;",
              "@/lib/membership/auth":
                "export const memberAuthConfigured=true; export const memberAuth={handler:()=>({GET:async()=>Response.json({ok:true}),POST:async()=>Response.json({ok:true})}),getSession:async()=>({data:globalThis.__profiles.user?{user:globalThis.__profiles.user}:null})};",
              "@/lib/tahrir/access": `export const loadActor=async()=>globalThis.__profiles.actor; export async function requireActor(){const actor=await loadActor(); return actor?{ok:true,actor}:{ok:false,response:Response.json({error:'unauthorized'},{status:401})};} export async function requirePermission(key){const gate=await requireActor(); return !gate.ok?gate:gate.actor.can(key)?gate:{ok:false,response:Response.json({error:'forbidden'},{status:403})};}`,
              "./images":
                "export async function putStoredImage(image){globalThis.__profiles.images.push(image);}",
            }[args.path],
          }));
        },
      },
    ],
  });
  const s = await import(`../${dir}/subject.mjs`);
  const png = await sharp({
    create: { width: 100, height: 60, channels: 3, background: "#25457a" },
  })
    .png()
    .toBuffer();
  const file = new File([png], "avatar.png", { type: "text/plain" });
  assert.equal(
    (
      await s.memberUpload(
        request(
          "/api/account/avatar",
          "POST",
          upload(file),
          "https://evil.invalid",
        ),
      )
    ).status,
    403,
  );
  checks++;
  state.user = null;
  assert.equal(
    (await s.memberUpload(request("/api/account/avatar", "POST", upload(file))))
      .status,
    401,
  );
  checks++;
  state.user = {
    id: memberId,
    name: "عضو أول",
    email: "first@example.invalid",
    emailVerified: false,
  };
  const uploaded = await s.memberUpload(
    request("/api/account/avatar", "POST", upload(file)),
  );
  assert.equal(uploaded.status, 200);
  const image = (await uploaded.json()).image;
  const rows = (
    await client.query("select auth_user_id, avatar_url from member_profiles")
  ).rows;
  assert.deepEqual(rows, [{ auth_user_id: memberId, avatar_url: image }]);
  const metadata = await sharp(state.images[0].body).metadata();
  assert.equal(metadata.width, 384);
  assert.equal(metadata.height, 384);
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.exif, undefined);
  checks++;
  assert.equal((await s.getMemberSession()).data.user.image, image);
  assert.equal((await (await s.viewer()).json()).member.image, image);
  checks++;
  assert.equal(
    (
      await s.memberUpload(
        request(
          "/api/account/avatar",
          "POST",
          upload(new File(["<svg/>"], "fake.png", { type: "image/png" })),
        ),
      )
    ).status,
    415,
  );
  const oversize = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "huge.png");
  assert.equal(
    (
      await s.memberUpload(
        request("/api/account/avatar", "POST", upload(oversize)),
      )
    ).status,
    413,
  );
  checks++;
  const animated = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "red" },
  })
    .gif()
    .toBuffer();
  await assert.rejects(
    s.prepareAvatar(new File([animated], "animated.gif")),
    /الصورة غير صالحة/,
  );
  checks++;
  state.actor = actor;
  const update = await s.editorUpdate(
    request("/api/tahrir/account/profile", "PATCH", {
      name: "محرر جديد",
      userId: "someone-else",
      role: "admin",
    }),
  );
  assert.equal(update.status, 200);
  const editor = (
    await client.query("select display_name,role from users where id=$1", [
      actor.userId,
    ])
  ).rows[0];
  assert.equal(editor.display_name, "محرر جديد");
  assert.equal(editor.role, "editor");
  checks++;
  const editorAvatar = await s.editorUpload(
    request("/api/tahrir/account/profile", "POST", upload(file)),
  );
  assert.equal(editorAvatar.status, 200);
  checks++;
  assert.equal(
    (await (await s.viewer()).json()).editor.name,
    actor.displayName,
  );
  checks++;
  const denied = await s.moderate(
    request("/api/tahrir/audience/x/status", "POST", {
      status: "suspended",
      reason: "fixture",
    }),
    { params: Promise.resolve({ id: memberId }) },
  );
  assert.equal(denied.status, 403);
  checks++;
  actor.can = () => true;
  assert.equal(
    (
      await s.moderate(
        request("/api/tahrir/audience/x/status", "POST", {
          status: "suspended",
          reason: "",
        }),
        { params: Promise.resolve({ id: memberId }) },
      )
    ).status,
    400,
  );
  checks++;
  await s.setAudienceStatus(
    memberId,
    "suspended",
    "اختبار منع الوصول",
    actor.username,
  );
  assert.equal((await s.getMemberSession()).data, null);
  assert.equal(
    (await s.memberUpload(request("/api/account/avatar", "POST", upload(file))))
      .status,
    401,
  );
  const hiddenSession = await s.authGet(
    request("/api/auth/get-session", "GET"),
    { params: Promise.resolve({ path: ["get-session"] }) },
  );
  assert.equal(await hiddenSession.json(), null);
  assert.equal(hiddenSession.headers.get("cache-control"), "private, no-store");
  assert.equal(
    (
      await s.authPost(
        request("/api/auth/update-user", "POST", { name: "blocked" }),
        { params: Promise.resolve({ path: ["update-user"] }) },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await s.authPost(request("/api/auth/sign-out", "POST", {}), {
        params: Promise.resolve({ path: ["sign-out"] }),
      })
    ).status,
    200,
  );
  checks++;
  const suspended = await s.listAudience({ status: "suspended" });
  assert.equal(suspended.counts.total, 1);
  assert.equal(suspended.members[0].id, memberId);
  checks++;
  await s.setAudienceStatus(memberId, "active", "", actor.username);
  assert.equal((await s.getMemberSession()).data.user.image, image);
  assert.equal(
    (
      await client.query(
        "select count(*)::int as n from audit_log where action like 'members:%'",
      )
    ).rows[0].n,
    2,
  );
  checks++;
  assert.equal((await s.listAudience({ q: "%" })).counts.total, 1);
  assert.equal((await s.listAudience({ q: "' or 1=1 --" })).counts.total, 0);
  assert.equal((await s.listAudience({ verified: "yes" })).counts.total, 0);
  checks++;
  await client.query(
    'update neon_auth."user" set "emailVerified"=true where id=$1',
    [memberId],
  );
  assert.equal(
    (await s.listAudience({ verified: "yes" })).members[0].id,
    memberId,
  );
  checks++;
  for (let i = 0; i < 26; i++)
    await client.query(
      'insert into neon_auth."user"(id,name,email) values($1,$2,$3)',
      [crypto.randomUUID(), `Page ${i}`, `page-${i}@example.invalid`],
    );
  const page1 = await s.listAudience({}),
    page2 = await s.listAudience({ page: "2" });
  assert.equal(page1.members.length, 25);
  assert.equal(page2.members.length, 3);
  assert.ok(
    page2.members.every(
      (row) => !page1.members.some((other) => row.id === other.id),
    ),
  );
  checks++;
  assert.equal(
    (await s.memberRemove(request("/api/account/avatar", "DELETE"))).status,
    200,
  );
  assert.equal((await s.getMemberSession()).data.user.image, null);
  checks++;
  state.actor = null;
  assert.equal(
    (
      await s.editorUpdate(
        request("/api/tahrir/account/profile", "PATCH", {
          name: "unauthorized",
        }),
      )
    ).status,
    401,
  );
  checks++;
  console.log(
    `Profiles and audience: ${checks} checks passed (session ownership, moderation, permissions, pagination, safe image decoding, size limits, metadata stripping, editor profile and viewer).`,
  );
} finally {
  await client.end();
  await rm(dir, { recursive: true, force: true });
  delete globalThis.__profiles;
}
