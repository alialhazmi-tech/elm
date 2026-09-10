#!/usr/bin/env node
/**
 * وكيل محلي يحاكي بروتوكول Neon SQL-over-HTTP فوق Postgres محلي — للتطوير والاختبار فقط.
 *
 * لماذا: عميل التطبيق `lib/db.ts` يستخدم `@neondatabase/serverless` عبر HTTP حصرًا، فلا يمكن
 * تشغيل خادم التطوير على قاعدة محلية (Homebrew Postgres) بلا وسيط. هذا الوكيل يستقبل
 * `POST /sql` بجسم `{query, params}` أو `{queries: [...]}` ويعيد الصيغة التي يتوقعها العميل
 * (`fields` + `rows` نصية بوضع المصفوفة)، والدفعات داخل معاملة واحدة.
 *
 *   NEON_LOCAL_TARGET=postgresql://USER@localhost:5432/alelm_ios node scripts/neon-local-proxy.mjs 4488
 *   ثم: NEON_LOCAL_PROXY=http://127.0.0.1:4488/sql DATABASE_URL=<أي رابط> npm run dev
 *
 * الوكيل يتجاهل `Neon-Connection-String` ويتصل دائمًا بـ NEON_LOCAL_TARGET، فلا يمكن توجيهه إلى
 * قاعدة بعيدة بالخطأ. لا يُشغَّل في الإنتاج.
 */

import { createServer } from "node:http";
import pg from "pg";

const port = Number(process.argv[2] ?? 4488);
const target = process.env.NEON_LOCAL_TARGET;
if (!target) {
  console.error("NEON_LOCAL_TARGET مطلوب (رابط Postgres محلي).");
  process.exit(2);
}
const host = new URL(target).hostname;
if (!["localhost", "127.0.0.1"].includes(host)) {
  console.error("الوكيل يعمل مع قاعدة محلية فقط.");
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: target, max: 8 });
// القيم تُعاد نصًا خامًا؛ العميل يحوّلها بحسب dataTypeID كما يفعل مع Neon.
const rawTypes = { getTypeParser: () => (value) => value };

async function runOne(client, item) {
  const result = await client.query({
    text: item.query,
    values: item.params ?? [],
    rowMode: "array",
    types: rawTypes,
  });
  return {
    command: result.command,
    rowCount: result.rowCount ?? 0,
    rows: result.rows.map((row) => row.map((value) => (value === null ? null : String(value)))),
    fields: result.fields.map((field) => ({
      name: field.name,
      dataTypeID: field.dataTypeID,
      tableID: field.tableID,
      columnID: field.columnID,
      dataTypeSize: field.dataTypeSize,
      dataTypeModifier: field.dataTypeModifier,
      format: "text",
    })),
    rowAsArray: true,
  };
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || !request.url?.startsWith("/sql")) {
    response.writeHead(404).end();
    return;
  }
  let payload;
  try {
    payload = JSON.parse(await readBody(request));
  } catch {
    response.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ message: "bad json" }));
    return;
  }
  const client = await pool.connect();
  try {
    if (Array.isArray(payload.queries)) {
      const level = request.headers["neon-batch-isolation-level"];
      const readOnly = request.headers["neon-batch-read-only"] === "true";
      await client.query(`begin${level ? ` isolation level ${String(level).replace(/[^a-z ]/gi, "")}` : ""}${readOnly ? " read only" : ""}`);
      try {
        const results = [];
        for (const item of payload.queries) results.push(await runOne(client, item));
        await client.query("commit");
        response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ results }));
      } catch (error) {
        await client.query("rollback").catch(() => null);
        throw error;
      }
    } else {
      const result = await runOne(client, payload);
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result));
    }
  } catch (error) {
    // نفس شكل خطأ Neon: العميل يقرأ message/code/… من الجسم عند 400.
    const body = {
      message: error.message,
      code: error.code,
      severity: error.severity,
      detail: error.detail,
      hint: error.hint,
      position: error.position,
      routine: error.routine,
    };
    response.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify(body));
  } finally {
    client.release();
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`neon-local-proxy على http://127.0.0.1:${port}/sql → ${host}`);
});
