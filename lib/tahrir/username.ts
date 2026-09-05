import { eq, sql } from "drizzle-orm";

import { users } from "@/db/schema";

/** نفس تعبير الفهرس الفريد؛ المساواة حرفية ولا تفسّر _ أو % كأنماط بحث. */
export function usernameEquals(username: string) {
  return eq(sql`lower(btrim(${users.username}))`, username.trim().toLowerCase());
}
