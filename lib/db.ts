/**
 * عميل قاعدة البيانات — Neon عبر HTTP: يعمل على Node محليًا
 * وعلى Cloudflare Workers (وجهة النشر) دون مقابس TCP.
 */

import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "../db/schema.ts";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let cached: Database | null | undefined;

/** يعيد العميل إن كان `DATABASE_URL` مضبوطًا، وإلا null — والمزود يسقط للبذرة. */
export function getDb(): Database | null {
  if (cached !== undefined) return cached;
  const url = process.env.DATABASE_URL;
  // تطوير محلي فقط: توجيه HTTP إلى وكيل يحاكي Neon فوق Postgres محلي (scripts/neon-local-proxy.mjs).
  const localProxy = process.env.NEON_LOCAL_PROXY;
  if (localProxy && process.env.NODE_ENV !== "production" && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/sql$/.test(localProxy)) {
    neonConfig.fetchEndpoint = localProxy;
  }
  cached = url ? drizzle(neon(url), { schema }) : null;
  return cached;
}
