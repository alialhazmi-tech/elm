import { revalidateTag, unstable_cache } from "next/cache";
import { PUBLIC_CONTENT_TAG } from "./cache-policy";
import { measureContentQuery } from "@/lib/performance/server";

// Next bundles readers and mutation handlers separately; share the race fence
// across those bundles in the same server process.
const cacheState = globalThis as typeof globalThis & { __alelmPublicCacheEpoch?: number };
const epoch = () => cacheState.__alelmPublicCacheEpoch ?? 0;

export function cachedPublicQuery<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  return unstable_cache(async () => {
    // A query started before publication must not refill the cache with old data.
    // Retry before Next persists its result if a write committed during that query.
    let started: number;
    let value: T;
    do {
      started = epoch();
      value = await measureContentQuery(key, load);
    } while (started !== epoch());
    return value;
  }, [PUBLIC_CONTENT_TAG, key], {
    tags: [PUBLIC_CONTENT_TAG],
    revalidate: Math.max(1, Math.ceil(ttlMs / 1000)),
  })();
}

/** Route Handlers need immediate expiration, not stale-while-revalidate. */
export function invalidatePublicContent() {
  cacheState.__alelmPublicCacheEpoch = epoch() + 1;
  revalidateTag(PUBLIC_CONTENT_TAG, { expire: 0 });
}
