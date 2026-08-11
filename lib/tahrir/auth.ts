/** جلسة «تحرير العلم» في مكونات الخادم ومسارات API — فوق نواة crypto.ts. */

import { cookies } from "next/headers";

import { readSessionToken, SESSION_COOKIE, type Session } from "./crypto";

export * from "./crypto";

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}
