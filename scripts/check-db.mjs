import pg from "pg";
import { DATABASE_READINESS_SQL } from "../lib/db-readiness.ts";

const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("Database connection required for readiness check.");
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000, statement_timeout: 10000 });
try {
  await client.connect();
  await client.query("begin read only");
  const result = await client.query(DATABASE_READINESS_SQL);
  await client.query("rollback");
  console.log(JSON.stringify({ ready: result.rows.length === 0, missing: result.rows.map(row => row.missing) }, null, 2));
  if (result.rows.length) process.exitCode = 1;
} catch {
  console.error("Database readiness check failed; connection or schema is unavailable.");
  process.exitCode = 1;
} finally { await client.end(); }
