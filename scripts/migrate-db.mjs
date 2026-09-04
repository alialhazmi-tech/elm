import { readFile } from "node:fs/promises";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

if (!process.argv.includes("--apply")) {
  console.log("Migrations in drizzle/: baseline adoption, stabilization, workflow lock, AI reservations, MFA. Run with --apply against a tested direct connection.");
  process.exit(0);
}
const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL_UNPOOLED is required (or TEST_DATABASE_URL for isolated tests).");
if (new URL(connectionString).hostname.includes("-pooler")) throw new Error("Use a direct connection for migrations.");
const client = new pg.Client({ connectionString });
await client.connect();
try {
  // لا نتبنى مخططًا قديمًا مختلفًا بصمت: افحص الأعمدة الموجودة قبل أي DDL.
  const baseline = JSON.parse(await readFile("drizzle/meta/0000_snapshot.json", "utf8"));
  const columns = (await client.query("select table_name,column_name,data_type from information_schema.columns where table_schema='public'")).rows;
  const present = new Map();
  for (const row of columns) { if (!present.has(row.table_name)) present.set(row.table_name, new Map()); present.get(row.table_name).set(row.column_name, row.data_type); }
  for (const table of Object.values(baseline.tables)) {
    if (!present.has(table.name)) continue;
    for (const column of Object.values(table.columns)) {
      if (present.get(table.name).get(column.name) !== column.type) throw new Error(`Baseline mismatch: ${table.name}.${column.name}; inspect schema before adopting migrations.`);
    }
  }
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log("Database migrations completed.");
} finally { await client.end(); }
